const Caver = require('caver-js')
const { stripHexPrefix, hashPersonalMessage } = require('ethereumjs-util')

class KENProvider {

  constructor (executionContext, config) {
    this.executionContext = executionContext
    this.config = config
  }

  personal () {
    return this.executionContext.caver().klay.personal
  }

  async importAccount (pk, password, cb) {
    try {
      let address

      if (password) {
        address = (await this.executionContext.caver().klay.accounts.wallet.decrypt([pk], password))[0].address
      } else {
        const res = (await this.executionContext.caver().klay.accounts.wallet.add(pk))
        address = res.address
      }

      cb(null, address)
    } catch (e) {
      cb(e, null)
    }
  }

  getAccounts (cb) {
    let accounts = []
    let error = null

    try {
      const wallet = this.executionContext.caver().klay.accounts.wallet

      for(let i = 0; i < wallet.length; i++) {
        accounts.push(wallet[i].address)
      }

    } catch (e) {
      error = e
    }

    return cb(error, accounts)
  }

  newAccount (passwordPromptCb, cb) {
    passwordPromptCb((passphrase, password) => {
      this.importAccount(passphrase, password, cb)
    })
  }

  resetEnvironment () {
  }

  getBalanceInKlay (address, cb) {
    address = stripHexPrefix(address)
    this.executionContext.caver().klay.getBalance(address, (err, res) => {
      if (err) {
        return cb(err)
      }
      cb(null, Caver.utils.fromPeb(res.toString(10), 'KLAY'))
    })
  }

  getGasPrice (cb) {
    this.executionContext.caver().klay.getGasPrice(cb)
  }

  signMessage (message, account, passphrase, cb) {
    const messageHash = hashPersonalMessage(Buffer.from(message))
    try {
      const personal = this.personal()
      personal.sign(message, account, passphrase, (error, signedData) => {
        cb(error, '0x' + messageHash.toString('hex'), signedData)
      })
    } catch (e) {
      cb(e.message)
    }
  }

  getProvider () {
    return this.executionContext.getProvider()
  }
}

module.exports = KENProvider
