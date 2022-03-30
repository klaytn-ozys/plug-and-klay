const Caver = require('caver-js')
const { stripHexPrefix, hashPersonalMessage } = require('ethereumjs-util')

class InjectedProvider {

  constructor (executionContext) {
    this.executionContext = executionContext
  }

  getAccounts (cb) {
    return this.executionContext.web3().klay.getAccounts(cb)
  }

  newAccount (passwordPromptCb, cb) {
    passwordPromptCb((passphrase) => {
      this.executionContext.web3().personal.newAccount(passphrase, cb)
    })
  }

  resetEnvironment () {
  }

  getBalanceInKlay (address, cb) {
    address = stripHexPrefix(address)
    this.executionContext.web3().klay.getBalance(address, (err, res) => {
      if (err) {
        return cb(err)
      }
      cb(null, Caver.utils.fromPeb(res.toString(10), 'KLAY'))
    })
  }

  getGasPrice (cb) {
    this.executionContext.web3().klay.getGasPrice(cb)
  }

  signMessage (message, account, _passphrase, cb) {
    const messageHash = hashPersonalMessage(Buffer.from(message))
    try {
      this.executionContext.web3().klay.sign(message, account, (error, signedData) => {
        cb(error, '0x' + messageHash.toString('hex'), signedData)
      })
    } catch (e) {
      cb(e.message)
    }
  }

  getProvider () {
    return 'injected'
  }
}

module.exports = InjectedProvider
