import EventManager from '../EventManager'
import * as defaultExecutionContext from './wrapped-execution-context'
import {execution} from 'remix-lib'

const { txFormat, txHelper } = execution
const async = require('async')
const ethers = require('ethers')
const ethJSUtil = require('ethereumjs-util')
const codeUtil = require('remix-lib').util
/**
 * poll web3 each 2s if web3
 * listen on transaction executed event if VM
 * attention: blocks returned by the event `newBlock` have slightly different json properties whether web3 or the VM is used
 * trigger 'newBlock'
 *
 */
class TxListener {

  constructor (opt, executionContext, logger) {
    this.event = new EventManager()
    // has a default for now for backwards compatability
    this.executionContext = executionContext || defaultExecutionContext
    this._api = opt.api
    this._resolvedTransactions = {}
    this._resolvedContracts = {}
    this._isListening = false
    this._listenOnNetwork = false
    this._loopId = null
    this.logger = logger;
    this.init()
    this.executionContext.event.register('contextChanged', (context) => {
      if (this._isListening) {
        this.stopListening()
        this.startListening()
      }
    })

    opt.event.udapp.register('callExecuted', (error, from, to, data, lookupOnly, txResult) => {
      if (error) return
      // we go for that case if
      // in VM mode
      // in web3 mode && listen remix txs only
      if (!this._isListening) return // we don't listen
      if (this._loopId && this.executionContext.getProvider() !== 'vm') return // we seems to already listen on a "web3" network

      const call = {
        from: from,
        to: to,
        input: data,
        hash: txResult.transactionHash ? txResult.transactionHash : 'call' + (from || '') + to + data,
        isCall: true,
        returnValue: this.executionContext.isVM() ? txResult.result.execResult.returnValue : ethJSUtil.toBuffer(txResult.result),
        envMode: this.executionContext.getProvider()
      }

      addExecutionCosts(txResult, call)
      this._resolveTx(call, call, (error, resolvedData) => {
        if (!resolvedData) return

        if (!error) {
          try {
            this.log(call, null)
          } catch(e) {

          }
          // this.event.trigger('newCall', [call])
        }
      })
    })

    opt.event.udapp.register('transactionExecuted', (error, from, to, data, lookupOnly, txResult) => {
      if (error) return
      if (lookupOnly) return
      // we go for that case if
      // in VM mode
      // in web3 mode && listen remix txs only
      if (!this._isListening) return // we don't listen
      if (this._loopId && this.executionContext.getProvider() !== 'vm') return // we seems to already listen on a "web3" network

      this.executionContext.web3().eth.getTransaction(txResult.transactionHash, (error, tx) => {
        if (error) return console.log(error)

        addExecutionCosts(txResult, tx)
        tx.envMode = this.executionContext.getProvider()
        tx.status = txResult.result.status // 0x0 or 0x1
        this._resolve([tx], () => {
        })
      })
    })

    function addExecutionCosts (txResult, tx) {
      if (txResult && txResult.result) {
        if (txResult.result.execResult) {
          tx.returnValue = txResult.result.execResult.returnValue
          if (txResult.result.execResult.gasUsed) tx.executionCost = txResult.result.execResult.gasUsed.toString(10)
        }
        if (txResult.result.gasUsed) tx.transactionCost = txResult.result.gasUsed.toString(10)
      }
    }
  }

  debug (e, data) {
    e.stopPropagation()
    if (data.tx.isCall && data.tx.envMode !== 'vm') {
      // modalDialog.alert('Cannot debug this call. Debugging calls is only possible in JavaScript VM mode.')
    } else {
      this.event.trigger('debuggingRequested', [data.tx.hash])
    }
  }

  log (tx, receipt) {
    var resolvedTransaction = this.resolvedTransaction(tx.hash)

    tx.debuggable = false
    tx.provider = this.executionContext.getProvider()
    tx.unit = 'peb'

    if (resolvedTransaction) {
      var compiledContracts = null
      if (global.artefacts.compilersArtefacts['__last']) {
        compiledContracts = global.artefacts.compilersArtefacts['__last'].getContracts()
      }
      global.eventsDecoder.parseLogs(tx, resolvedTransaction.contractName, compiledContracts, (error, logs) => {
        if (!error) {
          // global.terminalSupported && global.terminal.logTx(JSON.stringify({
          //   tx, receipt, logs, resolvedData: resolvedTransaction
          //   //, resolvedData: resolvedTransaction, logs: logs
          // }))
          let log = this.logger.logKnownTXAsJSON({ tx: tx, receipt: receipt, resolvedData: resolvedTransaction, logs: logs })

          if (global.client && global.client.terminal && global.client.terminal.log) {
            global.client.terminal.log({
              type: 'log',
              value: JSON.stringify(log, null, 2)
            })
          }
        }
      })
    } else {
      // contract unknown - just displaying raw tx.
      // global.terminalSupported && global.terminal.logTx(JSON.stringify({
      //   tx, receipt
      // }))
      let log = this.logger.logUnknownTXAsJSON({ tx: tx, receipt: receipt })

      if (global.client && global.client.terminal && global.client.terminal.log) {
        global.client.terminal.log({
          type: 'log',
          value: JSON.stringify(log, null, 2)
        })
      }
    }
  }

  /**
   * define if txlistener should listen on the network or if only tx created from remix are managed
   *
   * @param {Bool} type - true if listen on the network
   */
  setListenOnNetwork (listenOnNetwork) {
    this._listenOnNetwork = listenOnNetwork
    if (this._loopId) {
      clearInterval(this._loopId)
    }
    if (this._listenOnNetwork) {
      this._startListenOnNetwork()
    }
  }

  /**
   * reset recorded transactions
   */
  init () {
    this.blocks = []
    this.lastBlock = null
  }

  /**
   * start listening for incoming transactions
   *
   * @param {String} type - type/name of the provider to add
   * @param {Object} obj  - provider
   */
  startListening () {
    this.init()
    this._isListening = true
    if (this._listenOnNetwork && this.executionContext.getProvider() !== 'vm') {
      this._startListenOnNetwork()
    }
  }

  /**
   * stop listening for incoming transactions. do not reset the recorded pool.
   *
   * @param {String} type - type/name of the provider to add
   * @param {Object} obj  - provider
   */
  stopListening () {
    if (this._loopId) {
      clearInterval(this._loopId)
    }
    this._loopId = null
    this._isListening = false
  }

  _startListenOnNetwork () {
    this._loopId = setInterval(() => {
      const currentLoopId = this._loopId
      this.executionContext.web3().eth.getBlockNumber((error, blockNumber) => {
        if (this._loopId === null) return
        if (error) return console.log(error)
        if (currentLoopId === this._loopId && (!this.lastBlock || blockNumber > this.lastBlock)) {
          if (!this.lastBlock) this.lastBlock = blockNumber - 1
          let current = this.lastBlock + 1
          this.lastBlock = blockNumber
          while (blockNumber >= current) {
            try {
              this._manageBlock(current)
            } catch (e) {
              console.log(e)
            }
            current++
          }
        }
      })
    }, 2000)
  }

  _manageBlock (blockNumber) {
    this.executionContext.web3().eth.getBlock(blockNumber, true, (error, result) => {
      if (!error) {
        this._newBlock(Object.assign({type: 'web3'}, result))
      }
    })
  }

  /**
   * try to resolve the contract name from the given @arg address
   *
   * @param {String} address - contract address to resolve
   * @return {String} - contract name
   */
  resolvedContract (address) {
    if (this._resolvedContracts[address]) return this._resolvedContracts[address].name
    return null
  }

  /**
   * try to resolve the transaction from the given @arg txHash
   *
   * @param {String} txHash - contract address to resolve
   * @return {String} - contract name
   */
  resolvedTransaction (txHash) {
    return this._resolvedTransactions[txHash]
  }

  _newBlock (block) {
    this.blocks.push(block)
    this._resolve(block.transactions, () => {
      this.event.trigger('newBlock', [block])
    })
  }

  _resolve (transactions, callback) {
    async.each(transactions, (tx, cb) => {
      this._api.resolveReceipt(tx, (error, receipt) => {
        if (error) return cb(error)
        this._resolveTx(tx, receipt, (error, resolvedData) => {
          if (error) cb(error)
          if (resolvedData) {
            tx.debuggable = false
            tx.provider = this.executionContext.getProvider()
            tx.unit = 'peb'

            // return this.logTx(JSON.stringify({tx, receipt, resolvedData}))
          }

          try {
            this.log(tx, receipt)
          } catch(e) {}
          cb()
        })
      })
    }, () => {
      callback()
    })
  }

  _resolveTx (tx, receipt, cb) {
    const contracts = this._api.contracts()
    if (!contracts) return cb()
    let fun
    let contract
    if (!tx.to || tx.to === '0x0') { // testrpc returns 0x0 in that case
      // contract creation / resolve using the creation bytes code
      // if web3: we have to call getTransactionReceipt to get the created address
      // if VM: created address already included
      const code = tx.input
      contract = this._tryResolveContract(code, contracts, true)
      if (contract) {
        let address = receipt.contractAddress
        fun = this._resolveFunction(contract, tx, true)
        if (this._resolvedTransactions[tx.hash]) {
          this._resolvedTransactions[tx.hash].contractAddress = address
        }
        return cb(null, {to: null, contractName: contract.name, ...fun, creationAddress: address, function: fun })
      }
      return cb()
    } else {
      // first check known contract, resolve against the `runtimeBytecode` if not known
      contract = this._resolvedContracts[tx.to]
      if (!contract) {
        this.executionContext.web3().eth.getCode(tx.to, (error, code) => {
          if (error) return cb(error)
          if (code) {
            const contract = this._tryResolveContract(code, contracts, false)
            if (contract) {
              this._resolvedContracts[tx.to] = contract
              const fun = this._resolveFunction(contract, tx, false)
              return cb(null, {to: tx.to, contractName: contract.name, ...fun, function: fun })
            }
          }
          return cb()
        })
        return
      }
      if (contract) {
        fun = this._resolveFunction(contract, tx, false)
        return cb(null, {to: tx.to, contractName: contract.name, ...fun, function: fun})
      }
      return cb()
    }
  }

  _resolveFunction (contract, tx, isCtor) {
    if (!contract) {
      console.log('txListener: cannot resolve contract - contract is null')
      return
    }
    const abi = contract.object.abi
    const inputData = tx.input.replace('0x', '')
    if (!isCtor) {
      const methodIdentifiers = contract.object.evm.methodIdentifiers
      for (let fn in methodIdentifiers) {
        if (methodIdentifiers[fn] === inputData.substring(0, 8)) {
          const fnabi = txHelper.getFunction(abi, fn)
          this._resolvedTransactions[tx.hash] = {
            contractName: contract.name,
            to: tx.to,
            fn: fn,
            params: this._decodeInputParams(inputData.substring(8), fnabi)
          }
          if (tx.returnValue) {
            this._resolvedTransactions[tx.hash].decodedReturnValue = txFormat.decodeResponse(tx.returnValue, fnabi)
          }
          return this._resolvedTransactions[tx.hash]
        }
      }
      // receive function
      if (!inputData && txHelper.getReceiveInterface(abi)) {
        this._resolvedTransactions[tx.hash] = {
          contractName: contract.name,
          to: tx.to,
          fn: '(receive)',
          params: null
        }
      } else {
        // fallback function
        this._resolvedTransactions[tx.hash] = {
          contractName: contract.name,
          to: tx.to,
          fn: '(fallback)',
          params: null
        }
      }
    } else {
      const bytecode = contract.object.evm.bytecode.object
      let params = null
      if (bytecode && bytecode.length) {
        params = this._decodeInputParams(inputData.substring(bytecode.length), txHelper.getConstructorInterface(abi))
      }
      this._resolvedTransactions[tx.hash] = {
        contractName: contract.name,
        to: null,
        fn: '(constructor)',
        params: params
      }
    }
    return this._resolvedTransactions[tx.hash]
  }

  _tryResolveContract (codeToResolve, compiledContracts, isCreation) {
    let found = null
    txHelper.visitContracts(compiledContracts, (contract) => {
      if (!contract.object.hasOwnProperty('evm')) return

      const bytes = isCreation ? contract.object.evm.bytecode.object : contract.object.evm.deployedBytecode.object
      if (codeUtil.compareByteCode(codeToResolve, '0x' + bytes)) {
        found = contract
        return true
      }
    })
    return found
  }

  _decodeInputParams (data, abi) {
    data = ethJSUtil.toBuffer('0x' + data)
    if (!data.length) data = new Uint8Array(32 * abi.inputs.length) // ensuring the data is at least filled by 0 cause `AbiCoder` throws if there's not engouh data

    const inputTypes = []
    for (let i = 0; i < abi.inputs.length; i++) {
      const type = abi.inputs[i].type
      inputTypes.push(type.indexOf('tuple') === 0 ? txHelper.makeFullTypeDefinition(abi.inputs[i]) : type)
    }
    const abiCoder = new ethers.utils.AbiCoder()
    const decoded = abiCoder.decode(inputTypes, data)
    const ret = {}
    for (var k in abi.inputs) {
      ret[abi.inputs[k].type + ' ' + abi.inputs[k].name] = decoded[k]
    }
    return ret
  }
}

export default TxListener
