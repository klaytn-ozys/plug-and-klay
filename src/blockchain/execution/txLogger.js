'use strict'
var yo = require('yo-yo')

// -------------- styling ----------------------
var csjs = require('csjs-inject')
var remixLib = require('remix-lib')

var EventManager = require('../EventManager')
var helper = require('../../lib/helper')
var modalDialog = require('../../components/modal-dialog-custom')
var typeConversion = remixLib.execution.typeConversion

const styles = {
  log: "display: flex; cursor: pointer; align-items: center; cursor: pointer;",
  txStatus: "display: flex; font-size: 20px; margin-right: 20px; float: left;",
  tx: 'color: var(--text-info); font-weight: bold; float: left; margin-right: 10px;',
  txItem: ' color: var(--text-info); margin-right: 5px; float: left;',
  txItemTitle: ' font-weight: bold;',
  common: "border-collapse: collapse;font-size: 10px;color: var(--text-info);border: 1px solid var(--text-info);",
  tr: "padding: 4px; vertical-align: baseline;",
  td: "padding: 4px; vertical-align: baseline;display: inline-block;",
  td_first_child: "padding: 4px; vertical-align: baseline;display: inline-block; min-width: 30%; width: 30%; align-items: baseline; font-weight: bold;",
  txTable: "width: 100%;list-style:none;"
}

var css = csjs`
  .log {
    display: flex;
    cursor: pointer;
    align-items: center;
    cursor: pointer;
  }
  .log:hover {
    opacity: 0.8;
  }
  .arrow {
    color: var(--text-info);
    font-size: 20px;
    cursor: pointer;
    display: flex;
    margin-left: 10px;
  }
  .arrow:hover {
    color: var(--secondary);
  }
  .txLog {
  }
  .txStatus {
    display: flex;
    font-size: 20px;
    margin-right: 20px;
    float: left;
  }
  .succeeded {
    color: var(--success);
  }
  .failed {
    color: var(--danger);
  }
  .notavailable {
  }
  .call {
    font-size: 7px;
    border-radius: 50%;
    min-width: 20px;
    min-height: 20px;
    display: flex;
    justify-content: center;
    align-items: center;
    color: var(--text-info);
    text-transform: uppercase;
    font-weight: bold;
  }
  .txItem {
    color: var(--text-info);
    margin-right: 5px;
    float: left;
  }
  .txItemTitle {
    font-weight: bold;
  }
  .tx {
    color: var(--text-info);
    font-weight: bold;
    float: left;
    margin-right: 10px;
  }
  .txTable,
  .tr,
  .td {
    border-collapse: collapse;
    font-size: 10px;
    color: var(--text-info);
    border: 1px solid var(--text-info);
  }
  #txTable {
    margin-top: 1%;
    margin-bottom: 5%;
    align-self: center;
    width: 85%;
  }
  .tr, .td {
    padding: 4px;
    vertical-align: baseline;
  }
  .td:first-child {
    display: inline-block;
    min-width: 30%;
    width: 30%;
    align-items: baseline;
    font-weight: bold;
  }
  .tableTitle {
    width: 25%;
  }
  .buttons {
    display: flex;
    margin-left: auto;
  }
  .debug {
    white-space: nowrap;
  }
  .debug:hover {
    opacity: 0.8;
  }`
/**
  * This just export a function that register to `newTransaction` and forward them to the logger.
  *
  */
class TxLogger {
  constructor (blockchain) {
    this.event = new EventManager()
    this.seen = {}
    function filterTx (value, query) {
      if (value.length) {
        return helper.find(value, query)
      }
      return false
    }
    
    this.logKnownTX = (args, cmds, append) => {
      var data = args
      var el
      if (data.tx.isCall) {
        el = renderCall(this, data)
      } else {
        el = renderKnownTransaction(this, data, blockchain)
      }

      return el
    }
    this.logUnknownTX = (args, cmds, append) => {
      // liiggered for transaction AND call
      var data = args
      var el = renderUnknownTransaction(this, data, blockchain)

      return el
    }
    
  }
}

function debug (e, data, self) {
  e.stopPropagation()
  if (data.tx.isCall && data.tx.envMode !== 'vm') {
    modalDialog.alert('Cannot debug this call. Debugging calls is only possible in JavaScript VM mode.')
  } else {
    self.event.trigger('debuggingRequested', [data.tx.hash])
  }
}

function log (self, tx, receipt) {
  var resolvedTransaction = self.txListener.resolvedTransaction(tx.hash)
  if (resolvedTransaction) {
    var compiledContracts = null
    if (self._deps.compilersArtefacts['__last']) {
      compiledContracts = self._deps.compilersArtefacts['__last'].getContracts()
    }
    self.eventsDecoder.parseLogs(tx, resolvedTransaction.contractName, compiledContracts, (error, logs) => {
      if (!error) {
        self.logKnownTX({ tx: tx, receipt: receipt, resolvedData: resolvedTransaction, logs: logs })
      }
    })
  } else {
    // contract unknown - just displaying raw tx.
    self.logUnknownTX({ tx: tx, receipt: receipt })
  }
}

function renderKnownTransaction (self, data, blockchain) {
  var from = data.tx.from
  var to = data.resolvedData.contractName + '.' + data.resolvedData.fn
  var obj = {from, to}
  var txType = 'knownTx'
  var tx = yo`
    <span id="tx${data.tx.hash}" data-id="txLogger${data.tx.hash}">
      <div class="${css.log}" style="${styles.log}" onclick=${e => txDetails(e, tx, data, obj)}>
        ${checkTxStatus(data.receipt, txType)}
        ${context(self, {from, to, data}, blockchain)}
      </div>
      ${txDetails(data, obj)}
    </span>
  `

  /*
    <div class=${css.buttons}>
      <button class="${css.debug} btn btn-primary btn-sm" data-shared="txLoggerDebugButton" data-id="txLoggerDebugButton${data.tx.hash}" onclick=${(e) => debug(e, data, self)}>Debug</div>
    </div>
   */

  return tx.outerHTML
}

function renderCall (self, data) {
  var to = data.resolvedData.contractName + '.' + data.resolvedData.fn
  var from = data.tx.from ? data.tx.from : ' - '
  var input = data.tx.input ? helper.shortenHexData(data.tx.input) : ''
  var obj = {from, to}
  var txType = 'call'
  var tx = yo`
    <span id="tx${data.tx.hash}">
      <div class="${css.log}" style="${styles.log}" onclick=${e => txDetails(e, tx, data, obj)}>
        ${checkTxStatus(data.tx, txType)}
        <span class=${css.txLog}>
          <span class=${css.tx} style="${styles.tx}">[call]</span>
          <div class=${css.txItem} style="${styles.txItem}"><span class=${css.txItemTitle} style="${styles.txItemTitle}">from:</span> ${from}</div>
          <div class=${css.txItem} style="${styles.txItem}"><span class=${css.txItemTitle} style="${styles.txItemTitle}">to:</span> ${to}</div>
          <div class=${css.txItem} style="${styles.txItem}"><span class=${css.txItemTitle} style="${styles.txItemTitle}">data:</span> ${input}</div>
        </span>
      </div>
      ${txDetails(data, obj)}
    </span>
  `
  return tx.outerHTML
}

function renderUnknownTransaction (self, data, blockchain) {
  var from = data.tx.from
  var to = data.tx.to
  var obj = {from, to}
  var txType = 'unknown' + (data.tx.isCall ? 'Call' : 'Tx')
  var tx = yo`
    <span id="tx${data.tx.hash}">
      <div class="${css.log}" style="${styles.log}" onclick=${e => txDetails(e, tx, data, obj)}>
        ${checkTxStatus(data.receipt || data.tx, txType)}
        ${context(self, {from, to, data}, blockchain)}
        ${txDetails(data, obj)}
      </div>
    </span>
  `
  return tx.outerHTML
}

function renderEmptyBlock (self, data) {
  return yo`
    <span class=${css.txLog}>
      <span class='${css.tx}'><div class=${css.txItem} style="${styles.txItem}">[<span class=${css.txItemTitle} style="${styles.txItemTitle}">block:${data.block.number} - </span> 0 transactions]</span></span>
    </span>`
}

function checkTxStatus (tx, type) {
  if (tx.status === '0x1' || tx.status === true) {
    return yo`<span style="${styles.txStatus}" class="${css.txStatus} ${css.succeeded} fas fa-check-circle"></span>`
  }
  if (type === 'call' || type === 'unknownCall') {
    return yo`<span style="${styles.txStatus}" class="${css.txStatus} ${css.call}">call</span>`
  } else if (tx.status === '0x0' || tx.status === false) {
    return yo`<span style="${styles.txStatus}" class="${css.txStatus} ${css.failed} fas fa-times-circle"></span>`
  } else {
    return yo`<span style="${styles.txStatus}" class="${css.txStatus} ${css.notavailable} fas fa-circle-thin" title='Status not available' ></span>`
  }
}

function context (self, opts, blockchain) {
  
  var data = opts.data || ''
  var from = opts.from ? helper.shortenHexData(opts.from) : ''
  var to = opts.to
  if (data.tx.to) to = to + ' ' + helper.shortenHexData(data.tx.to)
  var val = data.tx.value
  var hash = data.tx.hash ? helper.shortenHexData(data.tx.hash) : ''
  var input = data.tx.input ? helper.shortenHexData(data.tx.input) : ''
  var logs = data.logs && data.logs.decoded && data.logs.decoded.length ? data.logs.decoded.length : 0
  var block = data.receipt ? data.receipt.blockNumber : data.tx.blockNumber || ''
  var i = data.receipt ? data.receipt.transactionIndex : data.tx.transactionIndex
  var value = val ? typeConversion.toInt(val) : 0
  let unit = data.tx.unit || 'wei'
  let provider = blockchain.getProvider()
  if (provider === 'vm') {
    return yo`
      <div>
        <span class=${css.txLog}>
          <span class=${css.tx} style="${styles.tx}">[vm]</span>
          <div class=${css.txItem} style="${styles.txItem}"><span class=${css.txItemTitle} style="${styles.txItemTitle}">from:</span> ${from}</div>
          <div class=${css.txItem} style="${styles.txItem}"><span class=${css.txItemTitle} style="${styles.txItemTitle}">to:</span> ${to}</div>
          <div class=${css.txItem} style="${styles.txItem}"><span class=${css.txItemTitle} style="${styles.txItemTitle}">value:</span> ${value} ${unit}</div>
          <div class=${css.txItem} style="${styles.txItem}"><span class=${css.txItemTitle} style="${styles.txItemTitle}">data:</span> ${input}</div>
          <div class=${css.txItem} style="${styles.txItem}"><span class=${css.txItemTitle} style="${styles.txItemTitle}">logs:</span> ${logs}</div>
          <div class=${css.txItem} style="${styles.txItem}"><span class=${css.txItemTitle} style="${styles.txItemTitle}">hash:</span> ${hash}</div>
        </span>
      </div>`
  } else if (provider !== 'vm' && data.resolvedData) {
    return yo`
      <div>
        <span class=${css.txLog}>
        <span class='${css.tx}'>[block:${block} txIndex:${i}]</span>
          <div class=${css.txItem} style="${styles.txItem}"><span class=${css.txItemTitle} style="${styles.txItemTitle}">from:</span> ${from}</div>
          <div class=${css.txItem} style="${styles.txItem}"><span class=${css.txItemTitle} style="${styles.txItemTitle}">to:</span> ${to}</div>
          <div class=${css.txItem} style="${styles.txItem}"><span class=${css.txItemTitle} style="${styles.txItemTitle}">value:</span> ${value} ${unit}</div>
          <div class=${css.txItem} style="${styles.txItem}"><span class=${css.txItemTitle} style="${styles.txItemTitle}">data:</span> ${input}</div>
          <div class=${css.txItem} style="${styles.txItem}"><span class=${css.txItemTitle} style="${styles.txItemTitle}">logs:</span> ${logs}</div>
          <div class=${css.txItem} style="${styles.txItem}"><span class=${css.txItemTitle} style="${styles.txItemTitle}">hash:</span> ${hash}</div>
        </span>
      </div>`
  } else {
    to = helper.shortenHexData(to)
    hash = helper.shortenHexData(data.tx.blockHash)
    return yo`
      <div>
        <span class=${css.txLog}>
          <span class='${css.tx}'>[block:${block} txIndex:${i}]</span>
          <div class=${css.txItem} style="${styles.txItem}"><span class=${css.txItemTitle} style="${styles.txItemTitle}">from:</span> ${from}</div>
          <div class=${css.txItem} style="${styles.txItem}"><span class=${css.txItemTitle} style="${styles.txItemTitle}">to:</span> ${to}</div>
          <div class=${css.txItem} style="${styles.txItem}"><span class=${css.txItemTitle} style="${styles.txItemTitle}">value:</span> ${value} ${unit}</div>
        </span>
      </div>`
  }
}

module.exports = TxLogger

// helpers

function txDetails (data, obj) {
  const from = obj.from
  const to = obj.to
  const arrowUp = yo`<i class="${css.arrow} fas fa-angle-up"></i>`
  const arrowDown = yo`<i class="${css.arrow} fas fa-angle-down"></i>`

  // let blockElement = e.target
  // while (true) { // get the parent block element
  //   if (blockElement.className.startsWith('block')) break
  //   else if (blockElement.parentElement) {
  //     blockElement = blockElement.parentElement
  //   } else break
  // }

  // let table = blockElement.querySelector(`#${tx.id} [class^="txTable"]`)
  // const log = blockElement.querySelector(`#${tx.id} [class^='log']`)
  // const arrow = blockElement.querySelector(`#${tx.id} [class^='arrow']`)

  // if (table && table.parentNode) {
  //   tx.removeChild(table)
  //   log.removeChild(arrow)
  //   log.appendChild(arrowDown)
  // } else {
  //   log.removeChild(arrow)
  //   log.appendChild(arrowUp)
    return createTable({
      hash: data.tx.hash,
      status: data.receipt ? data.receipt.status : null,
      isCall: data.tx.isCall,
      contractAddress: data.tx.contractAddress,
      data: data.tx,
      from,
      to,
      gas: data.tx.gas,
      input: data.tx.input,
      'decoded input': data.resolvedData && data.resolvedData.params ? JSON.stringify(typeConversion.stringify(data.resolvedData.params), null, '\t') : ' - ',
      'decoded output': data.resolvedData && data.resolvedData.decodedReturnValue ? JSON.stringify(typeConversion.stringify(data.resolvedData.decodedReturnValue), null, '\t') : ' - ',
      logs: data.logs,
      val: data.tx.value,
      transactionCost: data.tx.transactionCost,
      executionCost: data.tx.executionCost
    })
    // tx.appendChild(table)
  // }
}

function createTable (opts) {
  var table = yo`<ul class="${css.txTable}" style="${styles.txTable}" id="txTable" data-id="txLoggerTable${opts.hash}"></ul>`
  if (!opts.isCall) {
    var msg = ''
    if (opts.status !== undefined && opts.status !== null) {
      if (opts.status === '0x0' || opts.status === false) {
        msg = ' Transaction mined but execution failed'
      } else if (opts.status === '0x1' || opts.status === true) {
        msg = ' Transaction mined and execution succeed'
      }
    } else {
      msg = ' Status not available at the moment'
      msg = ' Status not available at the moment'
    }
    table.appendChild(yo`
      <li class="${css.tr}" style="${styles.common}${styles.tr}">
        <span class="${css.td}" style="${styles.common}${styles.td_first_child}" data-shared="key_${opts.hash}"> status </span>
        <span class="${css.td}" style="${styles.common}${styles.td}" data-id="txLoggerTableStatus${opts.hash}" data-shared="pair_${opts.hash}">${opts.status}${msg}</span>
      </li>`)
  }

  var transactionHash = yo`
    <li class="${css.tr}" style="${styles.common}${styles.tr}">
      <span class="${css.td}" style="${styles.common}${styles.td_first_child}" data-shared="key_${opts.hash}"> transaction hash </span>
      <span class="${css.td}" style="${styles.common}${styles.td}" data-id="txLoggerTableHash${opts.hash}" data-shared="pair_${opts.hash}">${opts.hash}
      </span>
    </li>
  `
  table.appendChild(transactionHash)

  var contractAddress = yo`
    <li class="${css.tr}" style="${styles.common}${styles.tr}">
      <span class="${css.td}" style="${styles.common}${styles.td_first_child}" data-shared="key_${opts.hash}"> contract address </span>
      <span class="${css.td}" style="${styles.common}${styles.td}" data-id="txLoggerTableConliactAddress${opts.hash}" data-shared="pair_${opts.hash}">${opts.contractAddress}
      </span>
    </li>
  `
  if (opts.contractAddress) table.appendChild(contractAddress)

  var from = yo`
    <li class="${css.tr}" style="${styles.common}${styles.tr}">
      <span class="${css.td} ${css.tableTitle}" style="${styles.common}${styles.td_first_child}" data-shared="key_${opts.hash}"> from </span>
      <span class="${css.td}" style="${styles.common}${styles.td}" data-id="txLoggerTableFrom${opts.hash}" data-shared="pair_${opts.hash}">${opts.from}
      </span>
    </li>
  `
  if (opts.from) table.appendChild(from)

  var toHash
  var data = opts.data  // opts.data = data.tx
  if (data.to) {
    toHash = opts.to + ' ' + data.to
  } else {
    toHash = opts.to
  }

  var unit = data.unit || 'wei'

  var to = yo`
    <li class="${css.tr}" style="${styles.common}${styles.tr}">
    <span class="${css.td}" style="${styles.common}${styles.td_first_child}" data-shared="key_${opts.hash}"> to </span>
    <span class="${css.td}" style="${styles.common}${styles.td}" data-id="txLoggerTableTo${opts.hash}" data-shared="pair_${opts.hash}">${toHash}
    </span>
    </li>
  `
  if (opts.to) table.appendChild(to)

  var gas = yo`
    <li class="${css.tr}" style="${styles.common}${styles.tr}">
      <span class="${css.td}" style="${styles.common}${styles.td_first_child}" data-shared="key_${opts.hash}"> gas </span>
      <span class="${css.td}" style="${styles.common}${styles.td}" data-id="txLoggerTableGas${opts.hash}" data-shared="pair_${opts.hash}">${opts.gas} gas
      </span>
    </li>
  `
  if (opts.gas) table.appendChild(gas)

  var callWarning = ''
  if (opts.isCall) {
    callWarning = '(Cost only applies when called by a contract)'
  }
  if (opts.transactionCost) {
    table.appendChild(yo`
    <li class="${css.tr}" style="${styles.common}${styles.tr}">
      <span class="${css.td}" style="${styles.common}${styles.td_first_child}" data-shared="key_${opts.hash}"> transaction cost </span>
      <span class="${css.td}" style="${styles.common}${styles.td}" data-id="txLoggerTabletransactionCost${opts.hash}" data-shared="pair_${opts.hash}">${opts.transactionCost} gas ${callWarning}
      </span>
    </li>`)
  }

  if (opts.executionCost) {
    table.appendChild(yo`
    <li class="${css.tr}" style="${styles.common}${styles.tr}">
      <span class="${css.td}" style="${styles.common}${styles.td_first_child}" data-shared="key_${opts.hash}"> execution cost </span>
      <span class="${css.td}" style="${styles.common}${styles.td}" data-id="txLoggerTableExecutionHash${opts.hash}" data-shared="pair_${opts.hash}">${opts.executionCost} gas ${callWarning}
      </span>
    </li>`)
  }

  var hash = yo`
    <li class="${css.tr}" style="${styles.common}${styles.tr}">
      <span class="${css.td}" style="${styles.common}${styles.td_first_child}" data-shared="key_${opts.hash}"> hash </span>
      <span class="${css.td}" style="${styles.common}${styles.td}" data-id="txLoggerTableHash${opts.hash}" data-shared="pair_${opts.hash}">${opts.hash}
      </span>
    </li>
  `
  if (opts.hash) table.appendChild(hash)

  var input = yo`
    <li class="${css.tr}" style="${styles.common}${styles.tr}">
      <span class="${css.td}" style="${styles.common}${styles.td_first_child}" data-shared="key_${opts.hash}"> input </span>
      <span class="${css.td}" style="${styles.common}${styles.td}" data-id="txLoggerTableInput${opts.hash}" data-shared="pair_${opts.hash}">${helper.shortenHexData(opts.input)}
      </span>
    </li>
  `
  if (opts.input) table.appendChild(input)

  if (opts['decoded input']) {
    var inputDecoded = yo`
    <li class="${css.tr}" style="${styles.common}${styles.tr}">
      <span class="${css.td}" style="${styles.common}${styles.td_first_child}" data-shared="key_${opts.hash}"> decoded input </span>
      <span class="${css.td}" style="${styles.common}${styles.td}" data-id="txLoggerTableDecodedInput${opts.hash}" data-shared="pair_${opts.hash}">${opts['decoded input']}
      </span>
    </li>`
    table.appendChild(inputDecoded)
  }

  if (opts['decoded output']) {
    var outputDecoded = yo`
    <li class="${css.tr}" style="${styles.common}${styles.tr}">
      <span class="${css.td}" style="${styles.common}${styles.td_first_child}" data-shared="key_${opts.hash}"> decoded output </span>
      <span class="${css.td}" style="${styles.common}${styles.td}" id="decodedoutput" data-id="txLoggerTableDecodedOutput${opts.hash}" data-shared="pair_${opts.hash}">${opts['decoded output']}
      </span>
    </li>`
    table.appendChild(outputDecoded)
  }

  var stringified = ' - '
  if (opts.logs && opts.logs.decoded) {
    stringified = typeConversion.stringify(opts.logs.decoded)
  }
  var logs = yo`
    <li class="${css.tr}" style="${styles.common}${styles.tr}">
      <span class="${css.td}" style="${styles.common}${styles.td_first_child}" data-shared="key_${opts.hash}"> logs </span>
      <span class="${css.td}" style="${styles.common}${styles.td}" id="logs" data-id="txLoggerTableLogs${opts.hash}" data-shared="pair_${opts.hash}">
        ${JSON.stringify(stringified, null, '\t')}
      </span>
    </li>
  `
  if (opts.logs) table.appendChild(logs)

  var val = opts.val != null ? typeConversion.toInt(opts.val) : 0
  const txValue = `${val} ${unit}`
  val = yo`
    <li class="${css.tr}" style="${styles.common}${styles.tr}">
      <span class="${css.td}" style="${styles.common}${styles.td_first_child}" data-shared="key_${opts.hash}"> value </span>
      <span class="${css.td}" style="${styles.common}${styles.td}" data-id="txLoggerTableValue${opts.hash}" data-shared="pair_${opts.hash}">${txValue}
      </span>
    </li>
  `
  if (opts.val) table.appendChild(val)

  return table
}
