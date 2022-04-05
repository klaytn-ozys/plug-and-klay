import LogsManager from '../logsManager'
import EventManager from '../EventManager'
import { loadFromLocalStorage } from '../../utils/EnvUtils'

const Web3 = require('web3')
const Caver = require('caver-js')

const BAOBAB_EN = 'https://public-node-api.klaytnapi.com/v1/baobab'
const CYPRESS_EN = 'https://public-node-api.klaytnapi.com/v1/cypress'


let web3
let injectedProvider
web3 = new Caver(new Caver.providers.HttpProvider(BAOBAB_EN))
web3.eth = new Proxy(web3.klay, {})

const blankWeb3 = new Caver()

const mainNetGenesisHash = '0xc72e5293c3c3ba38ed8ae910f780e4caaa9fb95e79784f7ab74c3c262ea7137e'

/*
  trigger contextChanged, web3EndpointChanged
*/

function ExecutionContext () {
  this.event = new EventManager()
  
  this.logsManager = new LogsManager()
  
  let executionContext = null
  
  this.feePayers = []
  this.blockGasLimitDefault = 4300000
  this.blockGasLimit = this.blockGasLimitDefault
  this.customNetWorks = {
    baobab: { url: BAOBAB_EN },
    cypress: { url: CYPRESS_EN }
  }
  this.blocks = {}
  this.latestBlockNumber = 0
  this.txs = {}
  
  this.init = function (config) {
    executionContext = 'baobab'
    // executionContext = injectedProvider ? 'injected' : null
    // if (executionContext === 'injected') this.askPermission()
  }
  
  this.askPermission = function (provider) {
    if (provider === 'injectedWeb3') {
      // metaMask
      if (window.ethereum && typeof window.ethereum.enable === 'function') return new Promise((resolve, reject) => {
        window.ethereum.sendAsync({ method: "wallet_requestPermissions", params: [{ eth_accounts: {} }] }, function (err, response) {
          if (err) {
            return reject(err)
          }
          try {
            if (response) {
              let matches = ((response.result[0] || []).caveats || []).find(it => it.type === 'restrictReturnedAccounts')
    
              if (matches) {
                return resolve(matches.value)
              }
            }
          } catch (e) {
            reject(e)
          }
          
          return reject('NO_ADDRESS')
        })
      })
    } else {
      // kaikas
      if (window.klaytn && typeof window.klaytn.enable === 'function') return window.klaytn.enable()
    }
    
  }
  
  this.getProvider = function () {
    return executionContext
  }
  
  this.web3 = function () {
    return web3
  }
  
  this.caver = function () {
    return web3
  }
  
  this.detectNetwork = function (callback) {
    let provider = this.getProvider()
    if (provider === 'injectedWeb3') {
      web3 = new Web3(injectedProvider)
      web3.klay = new Proxy(web3.eth, {})

      web3.eth.net.getId((err, id) => {
        let name = null
        if (err) name = 'Unknown'
        else if (id === 1) name = 'ETH Main'
        else if (id === 2) name = 'ETH Morden (deprecated)'
        else if (id === 3) name = 'ETH Ropsten'
        else if (id === 4) name = 'ETH Rinkeby'
        else if (id === 5) name = 'ETH Goerli'
        else if (id === 42) name = 'ETH Kovan'
        else if (id === 56) name = 'BNB Main'
        else if (id === 256) name = 'HECO Main'
        else if (id === 2017) name = 'Orbit Main'
        else if (id === 8217) name = 'Cypress'
        else if (id === 1001) name = 'Baobab'
        else name = 'Custom'

        if (id === '1') {
          web3.eth.getBlock(0, (error, block) => {
            if (error) console.log('cant query first block')
            if (block && block.hash !== mainNetGenesisHash) name = 'Custom'
            callback(err, { id, name })
          })
        } else {
          callback(err, { id, name })
        }
      })
    } else {
      injectedProvider = window.caver ? window.caver.currentProvider : null
      web3.klay.net.getId((err, id) => {
        let name = null
        if (err) name = 'Unknown'
        // https://github.com/ethereum/EIPs/blob/master/EIPS/eip-155.md
        else if (id === 8217) name = 'Cypress'
        else if (id === 1001) name = 'Baobab'
        else name = 'Custom'
        if (id === '8217') {
          web3.klay.getBlock(0, (error, block) => {
            if (error) console.log('cant query first block')
            if (block && block.hash !== mainNetGenesisHash) name = 'Custom'
            callback(err, { id, name })
          })
        } else {
          callback(err, { id, name })
        }
      })
    }
    
  }
  
  this.removeProvider = (name) => {
    if (name && this.customNetWorks[name]) {
      delete this.customNetWorks[name]
      this.event.trigger('removeProvider', [name])
    }
  }
  
  this.addProvider = (network) => {
    if (network && network.name && network.url) {
      this.customNetWorks[network.name] = network
      this.event.trigger('addProvider', [network])
    }
  }
  
  this.isVM = () => {
    return false
  }
  
  this.internalWeb3 = () => {
    return web3
  }
  
  this.blankWeb3 = () => {
    return blankWeb3
  }
  
  this.newFeePayer = (passwordPromptCb, cb) => {
    passwordPromptCb(async (privateKey, address) => {
      try {
        const account = await this.caver().klay.accounts.privateKeyToAccount(privateKey, address)
        this.feePayers.push(account)
        cb(null, account)
      } catch (e) {
        cb(e, null)
      }
    })
  }
  
  this.getFeePayerAccount = (address) => {
    return this.feePayers.find(acc => acc.address === address)
  }
  
  this.setContext = (context, endPointUrl, confirmCb, infoCb) => {
    executionContext = context
    this.executionContextChange(context, endPointUrl, confirmCb, infoCb)
  }

  this.executionContextChange = async (context, endPointUrl, confirmCb, infoCb, cb) => {
    if (!cb) cb = () => {}
    
    let oldContext = executionContext;
    
    this.feePayers = []
    if (context === 'injectedWeb3') {
      injectedProvider = window.web3.currentProvider
      web3 = new Web3(injectedProvider)
      web3.klay = new Proxy(web3.eth, {})

      executionContext = context
      
      try {
        let resolved = await this.askPermission(context)
        
        if (resolved) {
          this.event.trigger('addInjectedWeb3Accounts', [resolved])
        }
      } catch (e) {
        console.error(e)
        return this.executionContextChange(oldContext)
      }
      
    } else if (context === 'injected') {
      injectedProvider = window.caver ? window.caver.currentProvider : null
      web3 = new Caver(new Caver.providers.HttpProvider(BAOBAB_EN))
      web3.eth = new Proxy(web3.klay, {})
      
      if (injectedProvider === undefined) {
        infoCb('No injected Caver provider found. Make sure your provider (Kaikas) is active and running (when recently activated you may have to reload the page).')
        return cb()
      } else {
        this.askPermission()
        executionContext = context
        web3.setProvider(injectedProvider)
        this._updateBlockGasLimit()
        this.event.trigger('contextChanged', ['injected'])
        return cb()
      }
    } else {
      try{
        this.caver().klay.accounts.wallet.clear()
      }catch(e){}
    }
    
    if (context === 'caver') {
      confirmCb(cb)
    }
    
    if (this.customNetWorks[context]) {
      var provider = this.customNetWorks[context]
      setProviderFromEndpoint(provider.url, context, () => { cb() })
    }
  }
  
  this.currentblockGasLimit = () => {
    return this.blockGasLimit
  }
  
  this.stopListenOnLastBlock = () => {
    if (this.listenOnLastBlockId) clearInterval(this.listenOnLastBlockId)
    this.listenOnLastBlockId = null
  }
  
  this._updateBlockGasLimit = () => {
    if (this.getProvider() === 'injectedWeb3') {
      web3.eth.getBlock('latest', (err, block) => {
        if (!err) {
          // we can't use the blockGasLimit cause the next blocks could have a lower limit : https://github.com/ethereum/remix/issues/506
          this.blockGasLimit = (block && block.gasLimit) ? Math.floor(block.gasLimit - (5 * block.gasLimit) / 1024) : this.blockGasLimitDefault
        } else {
          this.blockGasLimit = this.blockGasLimitDefault
        }
      })
    } else if(this.getProvider() === 'injected'){
      web3.klay.getBlock('latest', (err, block) => {
        if (!err) {
          // we can't use the blockGasLimit cause the next blocks could have a lower limit : https://github.com/ethereum/remix/issues/506
          this.blockGasLimit = (block && block.gasLimit) ? Math.floor(block.gasLimit - (5 * block.gasLimit) / 1024) : this.blockGasLimitDefault
        } else {
          this.blockGasLimit = this.blockGasLimitDefault
        }
      })
    }
  }
  
  this.listenOnLastBlock = () => {
    this.listenOnLastBlockId = setInterval(() => {
      this._updateBlockGasLimit()
    }, 15000)
  }
  
  // TODO: remove this when this function is moved
  const self = this
  
  // TODO: not used here anymore and needs to be moved
  function setProviderFromEndpoint (endpoint, context, cb) {
    const oldProvider = web3.currentProvider
    
    if (endpoint === 'ipc') {
      web3.setProvider(new web3.providers.IpcProvider())
    } else {
      web3.setProvider(new web3.providers.HttpProvider(endpoint))
    }
    web3.klay.net.isListening((err, isConnected) => {
      if (!err && isConnected) {
        executionContext = context
        self._updateBlockGasLimit()
        self.event.trigger('contextChanged', [context])
        self.event.trigger('caver3EndpointChanged')
        cb()
      } else {
        web3.setProvider(oldProvider)
        cb('Not possible to connect to the Caver provider. Make sure the provider is running and a connection is open (via IPC or RPC).')
      }
    })
  }
  
  this.setProviderFromEndpoint = setProviderFromEndpoint
  
  this.txDetailsLink = (network, hash) => {
    if (transactionDetailsLinks[network]) {
      return transactionDetailsLinks[network] + hash
    }
  }
  
  this.addBlock = (block) => {
    let blockNumber = '0x' + block.header.number.toString('hex')
    if (blockNumber === '0x') {
      blockNumber = '0x0'
    }
    blockNumber = web3.utils.toHex(web3.utils.toBN(blockNumber))
    
    this.blocks['0x' + block.hash().toString('hex')] = block
    this.blocks[blockNumber] = block
    this.latestBlockNumber = blockNumber
    
    this.logsManager.checkBlock(blockNumber, block, this.web3())
  }
  
  this.trackTx = (tx, block) => {
    this.txs[tx] = block
  }
}

const transactionDetailsLinks = {
  'Cypress': 'https://scope.klaytn.com/tx/',
  'Baobab': 'https://baobab.scope.klaytn.com/tx/'
}

const executionContext = new ExecutionContext()

export default executionContext
