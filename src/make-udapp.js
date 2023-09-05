var remixLib = require('remix-lib')
var EventsDecoder = remixLib.execution.EventsDecoder
var TransactionReceiptResolver = require('./lib/transactionReceiptResolver')

const transactionDetailsLinks = {
  'Cypress': 'https://scope.klaytn.com/tx/',
  'Baobab': 'https://baobab.scope.klaytn.com/tx/'
}

function txDetailsLink (network, hash) {
  if (transactionDetailsLinks[network]) {
    return transactionDetailsLinks[network] + hash
  }
}

export function makeUdapp (blockchain, compilersArtefacts, logHtmlCallback) {
  // ----------------- UniversalDApp -----------------
  // TODO: to remove when possible
  blockchain.event.register('transactionBroadcasted', (txhash, networkName) => {
    var txLink = txDetailsLink(networkName, txhash)
    // if (txLink && logHtmlCallback) logHtmlCallback(yo`<a href="${txLink}" target="_blank">${txLink}</a>`)
    // TODO 체크해야댐 (logLink?)
    if (global.client && global.client.terminal && global.client.terminal.log) {
      global.client.terminal.log({
        type: 'log',
        value: txLink
      })
    }
  })

  // ----------------- Tx listener -----------------
  const transactionReceiptResolver = new TransactionReceiptResolver(blockchain)

  const txlistener = blockchain.getTxListener({
    api: {
      contracts: function () {
        if (compilersArtefacts['__last']) return compilersArtefacts['__last'].getContracts()
        return null
      },
      resolveReceipt: function (tx, cb) {
        transactionReceiptResolver.resolve(tx, cb)
      }
    }
  })
  
  blockchain.startListening(txlistener)

  const eventsDecoder = new EventsDecoder({
    api: {
      resolveReceipt: function (tx, cb) {
        transactionReceiptResolver.resolve(tx, cb)
      }
    }
  })
  txlistener.startListening()
  global.eventsDecoder = eventsDecoder
}
