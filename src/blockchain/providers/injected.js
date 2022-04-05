const Caver = require('caver-js')
const { stripHexPrefix, hashPersonalMessage } = require('ethereumjs-util')

class InjectedProvider {
  
  accounts = []
  
  constructor (executionContext, pkg) {
    this.executionContext = executionContext
    
    if (pkg === 'web3') {
      executionContext.event.register('addInjectedWeb3Accounts', (accounts) => {
        if (accounts) {
          this.accounts = accounts
        }
      })
    }
  }
  
 async getAccounts (cb, context) {
    if (context === 'injectedWeb3') {
      return cb(null, this.accounts)
      // return this.executionContext.web3().eth.getAccounts(cb)
    } else if(context === 'injected'){
      return this.executionContext.caver().klay.getAccounts(cb)
    }
  }
  
  newAccount (passwordPromptCb, cb) {
    passwordPromptCb((passphrase) => {
      this.executionContext.caver().personal.newAccount(passphrase, cb)
    })
  }
  
  resetEnvironment () {
  }
  
  getBalanceInKlay (address, cb) {
    address = stripHexPrefix(address)
    this.executionContext.caver().eth.getBalance(address, (err, res) => {
      if (err) {
        return cb(err)
      }
      cb(null, Caver.utils.fromPeb(res.toString(10), 'KLAY'))
    })
  }
  
  getBalanceInEther (address, cb) {
    address = stripHexPrefix(address)
    this.executionContext.web3().eth.getBalance(address, (err, res) => {
      if (err) {
        return cb(err)
      }
      cb(null, Caver.utils.fromPeb(res.toString(10), 'KLAY'))
      
    })
  }
  
  getGasPrice (cb) {
    this.executionContext.caver().klay.getGasPrice(cb)
  }
  
  signMessage (message, account, _passphrase, cb) {
    const messageHash = hashPersonalMessage(Buffer.from(message))
    try {
      this.executionContext.caver().klay.sign(message, account, (error, signedData) => {
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
