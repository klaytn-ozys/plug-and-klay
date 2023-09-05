const yo = require('yo-yo')
const remixLib = require('remix-lib')
const confirmDialog = require('./confirmDialog')
const modalCustom = require('./modal-dialog-custom')
const modalDialog = require('./modaldialog')
const typeConversion = remixLib.execution.typeConversion
const Caver = require('caver-js')

module.exports = {
  getCallBacksWithContext: (udappUI, blockchain) => {
    let callbacks = {}
    callbacks.confirmationCb = confirmationCb
    callbacks.continueCb = continueCb
    callbacks.promptCb = promptCb
    callbacks.udappUI = udappUI
    callbacks.blockchain = blockchain
    return callbacks
  }
}

const continueCb = function (error, continueTxExecution, cancelCb) {
  if (error) {
    const msg = typeof error !== 'string' ? error.message : error
    modalDialog(
      'Gas estimation failed',
      yo`
        <div>Gas estimation errored with the following message (see below).
        The transaction execution will likely fail. Do you want to force sending? <br>${msg}</div>
      `,
      {
        label: 'Send Transaction',
        fn: () => continueTxExecution()
      },
      {
        label: 'Cancel Transaction',
        fn: () => cancelCb()
      }
    )
  } else {
    continueTxExecution()
  }
}

const promptCb = function (okCb, cancelCb) {
  modalCustom.promptPassphrase('Passphrase requested', 'Personal mode is enabled. Please provide passphrase of account', '', okCb, cancelCb)
}

const confirmationCb = function (network, tx, gasEstimation, continueTxExecution, cancelCb) {
  let self = this
  if (network.name !== 'Cypress') {
    return continueTxExecution(null)
  }
  var amount = Caver.utils.fromPeb(typeConversion.toInt(tx.value), 'KLAY')
  var content = confirmDialog(tx, amount, gasEstimation, self.udappUI,
    (gasPrice, cb) => {
      let txFeeText, priceStatus
      // TODO: this try catch feels like an anti pattern, can/should be
      // removed, but for now keeping the original logic
      try {
        var fee = Caver.utils.toBN(tx.gas).mul(Caver.utils.toBN(Caver.utils.toPeb(gasPrice.toString(10), 'Gpeb')))
        txFeeText = ' ' + Caver.utils.fromPeb(fee.toString(10), 'KLAY') + ' KLAY'
        priceStatus = true
      } catch (e) {
        txFeeText = ' Please fix this issue before sending any transaction. ' + e.message
        priceStatus = false
      }
      cb(txFeeText, priceStatus)
    },
    (cb) => {
      self.blockchain.caver().klay.getGasPrice((error, gasPrice) => {
        const warnMessage = ' Please fix this issue before sending any transaction. '
        if (error) {
          return cb('Unable to retrieve the current network gas price.' + warnMessage + error)
        }
        try {
          var gasPriceValue = Caver.utils.fromPeb(gasPrice.toString(10), 'Gpeb')
          cb(null, gasPriceValue)
        } catch (e) {
          cb(warnMessage + e.message, null, false)
        }
      })
    }
  )
  modalDialog(
    'Confirm transaction',
    content,
    { label: 'Confirm',
      fn: () => {
        // TODO: check if this is check is still valid given the refactor
        if (!content.gasPriceStatus) {
          cancelCb('Given gas price is not correct')
        } else {
          var gasPrice = Caver.utils.toPeb(content.querySelector('#gasprice').value, 'Gpeb')
          continueTxExecution(gasPrice)
        }
      }
    },
    {
      label: 'Cancel',
      fn: () => {
        return cancelCb('Transaction canceled by user.')
      }
    }
  )
}
