import executionContext from './execution/wrapped-execution-context'
import {loadFromLocalStorage} from '../utils/EnvUtils'
import Txlistener from './execution/TxListener'

const remixLib = require('remix-lib')
const txFormat = remixLib.execution.txFormat
const txExecution = remixLib.execution.txExecution
const typeConversion = remixLib.execution.typeConversion
const TxRunner = require('./execution/txRunner')
const TxLogger = require('./execution/txLogger')
const txHelper = remixLib.execution.txHelper

const EventManager = require('./EventManager')
const Web3 = require('caver-js')


const async = require('async')
const { EventEmitter } = require('events')

const { resultToRemixTx } = require('./execution/txResultHelper')

const VMProvider = require('./providers/vm.js')
const KENProvider = require('./providers/ken')
const InjectedProvider = require('./providers/injected.js')
const NodeProvider = require('./providers/node.js')

class Blockchain {
  // NOTE: the config object will need to be refactored out in remix-lib
  constructor (config) {
    this.event = new EventManager()
    this.executionContext = executionContext
    this.events = new EventEmitter()
    this.config = Object.assign(config, {
      getUnpersistedProperty: (key) => {
        return false
      },
      get: (key) => {
        return loadFromLocalStorage(key)
      }
    })
    
    this.txRunner = new TxRunner({}, {
      config: config,
      detectNetwork: (cb) => {
        this.executionContext.detectNetwork(cb)
      },
      personalMode: () => {
        // Todo 원래 Web3였는데 injected로 봐야되나?
        return this.getProvider() === 'caver' ? this.config.get('settings/personal-mode') : false
      }
    }, this.executionContext)
    
    this.executionContext.event.register('contextChanged', this.resetEnvironment.bind(this))
    this.vmEnabled = false
    this.networkcallid = 0
    this.setupEvents()
    this.setupProviders()
  
    this.txLogger = new TxLogger(this)
  }
  
  setupEvents () {
    this.executionContext.event.register('contextChanged', (context, silent) => {
      this.event.trigger('contextChanged', [context, silent])
    })
    
    this.executionContext.event.register('addProvider', (network) => {
      this.event.trigger('addProvider', [network])
    })
    
    this.executionContext.event.register('removeProvider', (name) => {
      this.event.trigger('removeProvider', [name])
    })
  }
  
  setupProviders () {
    this.providers = {}
    this.providers.vm = null
    this.providers.baobab = new KENProvider(this.executionContext, this.config)
    this.providers.cypress = new KENProvider(this.executionContext, this.config)
    this.providers.caver = new NodeProvider(this.executionContext, this.config)

    if (window.caver) {
      this.providers.injected = new InjectedProvider(this.executionContext)
    }
    if (this.vmEnabled) {
      this.providers.vm = new VMProvider(this.executionContext)
    }
  }
  
  getCurrentProvider () {
    const provider = this.getProvider()
    return this.providers[provider]
  }
  
  /** Return the list of accounts */
  // note: the dual promise/callback is kept for now as it was before
  getAccounts (cb) {
    const provider = this.getProvider()
    if(provider === 'injectedWeb3'){
      this.providers.injectedWeb3 = new InjectedProvider(this.executionContext)
    }
    return new Promise((resolve, reject) => {
      this.getCurrentProvider().getAccounts((error, accounts) => {
        if (cb) {
          return cb(error, accounts)
        }
        if (error) {
          reject(error)
        }
        resolve(accounts)
      }, provider)
    })
  }
  
  deployContractAndLibraries (selectedContract, args, contractMetadata, compilerContracts, callbacks, confirmationCb) {
    const { continueCb, promptCb, statusCb, finalCb } = callbacks
    const constructor = selectedContract.getConstructorInterface()
    txFormat.buildData(selectedContract.name, selectedContract.object, compilerContracts, true, constructor, args, (error, data) => {
      if (error) return statusCb(`creation of ${selectedContract.name} errored: ` + error)
      statusCb(`creation of ${selectedContract.name} pending...`)
      this.createContract(selectedContract, data, continueCb, promptCb, confirmationCb, finalCb)
    }, statusCb, (data, runTxCallback) => {
      // called for libraries deployment
      this.runTx(data, confirmationCb, continueCb, promptCb, runTxCallback)
      
    })
  }
  
  deployContractWithLibrary (selectedContract, args, contractMetadata, compilerContracts, callbacks, confirmationCb) {
    const { continueCb, promptCb, statusCb, finalCb } = callbacks
    const constructor = selectedContract.getConstructorInterface()
    txFormat.encodeConstructorCallAndLinkLibraries(selectedContract.object, args, constructor, contractMetadata.linkReferences, selectedContract.bytecodeLinkReferences, (error, data) => {
      if (error) return statusCb(`creation of ${selectedContract.name} errored: ` + error)
      
      statusCb(`creation of ${selectedContract.name} pending...`)
      this.createContract(selectedContract, data, continueCb, promptCb, confirmationCb, finalCb)
    })
  }
  
  createContract (selectedContract, data, continueCb, promptCb, confirmationCb, finalCb) {
  
    if (data) {
      data.contractName = selectedContract.name
      data.linkReferences = selectedContract.bytecodeLinkReferences
      data.contractABI = selectedContract.abi
    }
    
    this.runTx({ data: data, useCall: false }, confirmationCb, continueCb, promptCb,
      (error, txResult, address) => {
        if (error) {
          return finalCb(`creation of ${selectedContract.name} errored: ${error}`)
        }
        if (txResult.result.status && txResult.result.status === '0x0') {
          return finalCb(`creation of ${selectedContract.name} errored: transaction execution failed`)
        }
        finalCb(null, selectedContract, address)
      }
    )
  }
  
  determineGasPrice (cb) {
    this.getCurrentProvider().getGasPrice((error, gasPrice) => {
      const warnMessage = ' Please fix this issue before sending any transaction. '
      if (error) {
        return cb('Unable to retrieve the current network gas price.' + warnMessage + error)
      }
      try {
        const gasPriceValue = this.fromPeb(gasPrice, false, 'gPeb')
        cb(null, gasPriceValue)
      } catch (e) {
        cb(warnMessage + e.message, null, false)
      }
    })
  }
  
  getInputs (funABI) {
    if (!funABI.inputs) {
      return ''
    }
    return txHelper.inputParametersDeclarationToString(funABI.inputs)
  }
  
  fromPeb (value, doTypeConversion, unit) {
    if (doTypeConversion) {
      return Web3.utils.fromPeb(typeConversion.toInt(value), unit || 'KLAY')
    }
    return Web3.utils.fromWei(value.toString(10), unit || 'KLAY')
  }
  
  toPeb (value, unit) {
    return Web3.utils.toWei(value, unit || 'Gpeb')
  }
  
  calculateFee (gas, gasPrice, unit) {
    return Web3.utils.toBN(gas).mul(Web3.utils.toBN(Web3.utils.toWei(gasPrice.toString(10), unit || 'Gpeb')))
  }
  
  determineGasFees (tx) {
    const determineGasFeesCb = (gasPrice, cb) => {
      let txFeeText, priceStatus
      // TODO: this try catch feels like an anti pattern, can/should be
      // removed, but for now keeping the original logic
      try {
        const fee = this.calculateFee(tx.gas, gasPrice)
        txFeeText = ' ' + this.fromWei(fee, false, 'KLAY') + ' KLAY'
        priceStatus = true
      } catch (e) {
        txFeeText = ' Please fix this issue before sending any transaction. ' + e.message
        priceStatus = false
      }
      cb(txFeeText, priceStatus)
    }
    
    return determineGasFeesCb
  }
  
  changeExecutionContext (context, confirmCb, infoCb, cb) {
    return this.executionContext.executionContextChange(context, null, confirmCb, infoCb, cb)
  }
  
  setProviderFromEndpoint (target, context, cb) {
    return this.executionContext.setProviderFromEndpoint(target, context, cb)
  }
  
  updateNetwork (cb) {
    this.executionContext.detectNetwork((err, { id, name } = {}) => {
      if (err) {
        return cb(err)
      }
      cb(null, { id, name })
    })
  }
  
  detectNetwork (cb) {
    return this.executionContext.detectNetwork(cb)
  }
  
  getProvider () {
    return this.executionContext.getProvider()
  }
  
  isWeb3Provider () {
    const isVM = this.getProvider() === 'vm'
    const isInjected = this.getProvider() === 'injected'
    return (!isVM && !isInjected)
  }
  
  isCaverProvider () {
    const isVM = this.getProvider() === 'vm'
    const isInjected = this.getProvider() === 'injected'
    return (!isVM && !isInjected)
  }
  
  isInjectedWeb3 () {
    return this.getProvider() === 'injected'
  }
  
  signMessage (message, account, passphrase, cb) {
    this.getCurrentProvider().signMessage(message, account, passphrase, cb)
  }
  
  web3 () {
    return this.executionContext.web3()
  }
  
  caver () {
    return this.web3()
  }
  
  getTxListener (opts) {
    opts.event = {
      // udapp: this.udapp.event
      udapp: this.event
    }
    const txlistener = new Txlistener(opts, this.executionContext, this.txLogger)
    return txlistener
  }
  
  runOrCallContractMethod (contractName, contractAbi, funABI, value, address, callType, lookupOnly, logMsg, logCallback, outputCb, confirmationCb, continueCb, promptCb, resultCb) {
    // contractsDetails is used to resolve libraries
    txFormat.buildData(contractName, contractAbi, {}, false, funABI, callType, (error, data) => {
        if (error) {
          return logCallback({
            type: 'error',
            value: `${logMsg} errored: ${error} `
          })
        }
        if (!lookupOnly) {
          logCallback(`${logMsg} pending ... `)
        } else {
          logCallback(`${logMsg}`)
        }
        if (funABI.type === 'fallback') data.dataHex = value
        
        const useCall = funABI.stateMutability === 'view' || funABI.stateMutability === 'pure'
        this.runTx({ to: address, data, useCall }, confirmationCb, continueCb, promptCb, (error, txResult, _address, returnValue) => {
          if (error) {
            return global.client.terminal.log({
              type: 'error',
              value: `${logMsg} errored: ${error}`
            })
          }
          if (lookupOnly) {
            outputCb(returnValue)
          }
          
          resultCb && resultCb({
            ...txResult,
            contractName,
            to: address, data, useCall
          })
        })
      },
      (msg) => {
        logCallback(msg)
      },
      (data, runTxCallback) => {
        // called for libraries deployment
        this.runTx(data, confirmationCb, runTxCallback, promptCb, () => {})
      })
  }
  
  context () {
    return (this.executionContext.isVM() ? 'memory' : 'blockchain')
  }
  
  // NOTE: the config is only needed because exectuionContext.init does
  // if config.get('settings/always-use-vm'), we can simplify this later
  resetAndInit (config, transactionContextAPI) {
    this.transactionContextAPI = transactionContextAPI
    this.executionContext.init(config)
    this.executionContext.stopListenOnLastBlock()
    this.executionContext.listenOnLastBlock()
    this.resetEnvironment()
  }
  
  addNetwork (customNetwork) {
    this.executionContext.addProvider(customNetwork)
  }
  
  removeNetwork (name) {
    this.executionContext.removeProvider(name)
  }
  
  // TODO : event should be triggered by Udapp instead of TxListener
  /** Listen on New Transaction. (Cannot be done inside constructor because txlistener doesn't exist yet) */
  startListening (txlistener) {
    txlistener.event.register('newTransaction', (tx) => {
      this.events.emit('newTransaction', tx)
    })
  }
  
  resetEnvironment () {
    this.getCurrentProvider().resetEnvironment()
    // TODO: most params here can be refactored away in txRunner
    // this.txRunner = new TxRunner(this.providers.vm.accounts, {
    this.txRunner = new TxRunner(this.providers.vm ? this.providers.vm.RemixSimulatorProvider.Accounts.accounts : {}, {
      // TODO: only used to check value of doNotShowTransactionConfirmationAgain property
      config: this.config,
      // TODO: to refactor, TxRunner already has access to executionContext
      detectNetwork: (cb) => {
        this.executionContext.detectNetwork(cb)
      },
      personalMode: () => {
        return this.getProvider() === 'caver' ? this.config.get('settings/personal-mode') : false
      }
    }, this.executionContext)
    this.txRunner.event.register('transactionBroadcasted', (txhash) => {
      this.executionContext.detectNetwork((error, network) => {
        if (error || !network) return
        this.event.trigger('transactionBroadcasted', [txhash, network.name])
      })
    })
  }
  
  /**
   * Create a VM Account
   * @param {{privateKey: string, balance: string}} newAccount The new account to create
   */
  createVMAccount (newAccount) {
    if (this.getProvider() !== 'vm') {
      throw new Error('plugin API does not allow creating a new account through web3 connection. Only vm mode is allowed')
    }
    return this.providers.vm.createVMAccount(newAccount)
  }
  
  newAccount (_password, passwordPromptCb, cb) {
    return this.getCurrentProvider().newAccount(passwordPromptCb, cb)
  }
  
  newFeePayer (_password, passwordPromptCb, cb) {
    return this.executionContext.newFeePayer(passwordPromptCb, cb)
  }
  
  /** Get the balance of an address, and convert wei to ether */
  getBalanceInKlay (address, cb) {
    this.getCurrentProvider().getBalanceInKlay(address, cb)
  }
  
  /** Get the balance of an address, and convert wei to ether */
  getBalanceInEther (address, cb) {
    this.getCurrentProvider().getBalanceInEther(address, cb)
  }
  
  pendingTransactionsCount () {
    return Object.keys(this.txRunner.pendingTxs).length
  }
  
  /**
   * This function send a tx only to javascript VM or testnet, will return an error for the mainnet
   * SHOULD BE TAKEN CAREFULLY!
   *
   * @param {Object} tx    - transaction.
   */
  sendTransaction (tx) {
    return new Promise((resolve, reject) => {
      this.executionContext.detectNetwork((error, network) => {
        if (error) return reject(error)
        if (network.name === 'Cypress' && network.id === '8217') {
          return reject(new Error('It is not allowed to make this action against mainnet'))
        }
        
        this.txRunner.rawRun(
          tx,
          (network, tx, gasEstimation, continueTxExecution, cancelCb) => { continueTxExecution() },
          (error, continueTxExecution, cancelCb) => { if (error) { reject(error) } else { continueTxExecution() } },
          (okCb, cancelCb) => { okCb() },
          (error, result) => {
            if (error) return reject(error)
            try {
              resolve(resultToRemixTx(result))
            } catch (e) {
              reject(e)
            }
          }
        )
      })
    })
  }
  
  runTx (args, confirmationCb, continueCb, promptCb, cb) {
    let txFeePayer = document.getElementById('txFeePayer')
    let txFeeRatio = document.getElementById('txFeeRatio')
    
    let feePayerAccount = null
    let feePayerRatio = null
    
    if (txFeePayer && txFeePayer.value) {
      feePayerAccount = this.executionContext.getFeePayerAccount(txFeePayer.value)
      
      if (txFeePayer.value !== 'none' && Number(txFeeRatio.value) > 0) {
        this.executionContext.caver().klay.accounts.wallet.clear()
        this.executionContext.caver().klay.accounts.wallet.add(feePayerAccount.privateKey, feePayerAccount.address)
      }
    }
    
    if (txFeeRatio && txFeeRatio.value) {
      feePayerRatio = Number(txFeeRatio.value)
    }
    if (feePayerAccount && feePayerRatio && !args.useCall) {
      return this.runFeeDelegatedTx(feePayerAccount, feePayerRatio, args, confirmationCb, continueCb, promptCb, cb)
    }
    
    const self = this
    async.waterfall([
        function getGasLimit (next) {
          if (self.transactionContextAPI.getGasLimit) {
            return self.transactionContextAPI.getGasLimit(next)
          }
          next(null, 3000000)
        },
        function queryValue (gasLimit, next) {
          if (args.value) {
            return next(null, args.value, gasLimit)
          }
          if (args.useCall || !self.transactionContextAPI.getValue) {
            return next(null, 0, gasLimit)
          }
          self.transactionContextAPI.getValue(function (err, value) {
            next(err, value, gasLimit)
          })
        },
        function getAccount (value, gasLimit, next) {
          if (args.from) {
            return next(null, args.from, value, gasLimit)
          }
          if (self.transactionContextAPI.getAddress) {
            return self.transactionContextAPI.getAddress(function (err, address) {
              next(err, address, value, gasLimit)
            })
          }
          self.getAccounts(function (err, accounts) {
            let address = accounts[0]
            
            if (err) return next(err)
            if (!address) return next('No accounts available')
            // if (self.executionContext.isVM() && !self.providers.vm.accounts[address]) {
            if (self.executionContext.isVM() && !self.providers.vm.RemixSimulatorProvider.Accounts.accounts[address]) {
              return next('Invalid account selected')
            }
            next(null, address, value, gasLimit)
          })
        },
        function applyTxType (fromAddress, value, gasLimit, next) {
          args.type = args.to ? 'SMART_CONTRACT_EXECUTION' : 'SMART_CONTRACT_DEPLOY'
          next(null, fromAddress, value, gasLimit)
        },
        function runTransaction (fromAddress, value, gasLimit, next) {
          const tx = {
            to: args.to,
            data: args.data.dataHex,
            useCall: args.useCall,
            from: fromAddress,
            value: value,
            gasLimit: gasLimit,
            timestamp: args.data.timestamp,
            type: args.type
          }
          const payLoad = {
            funAbi: args.data.funAbi,
            funArgs: args.data.funArgs,
            contractBytecode: args.data.contractBytecode,
            contractName: args.data.contractName,
            contractABI: args.data.contractABI,
            linkReferences: args.data.linkReferences
          }
          
          let timestamp = Date.now()
          if (tx.timestamp) {
            timestamp = tx.timestamp
          }

          self.event.trigger('initiatingTransaction', [timestamp, tx, payLoad])
          self.txRunner.rawRun(tx, confirmationCb, continueCb, promptCb,
            function (error, result) {
              if (error) return next(error)
              
              const rawAddress = self.executionContext.isVM() ? result.result.createdAddress : result.result.contractAddress
              let eventName = (tx.useCall ? 'callExecuted' : 'transactionExecuted')

              self.event.trigger(eventName, [error, tx.from, tx.to, tx.data, tx.useCall, result, timestamp, payLoad, rawAddress])
              
              if (error && (typeof (error) !== 'string')) {
                if (error.message) error = error.message
                else {
                  try { error = 'error: ' + JSON.stringify(error) } catch (e) {}
                }
              }
              
              next(error, result)
            }
          )
        }
      ],
      (error, txResult) => {
        if (error) {
          return cb(error)
        }
        
        const isVM = this.executionContext.isVM()
        if (isVM) {
          const vmError = txExecution.checkVMError(txResult)
          if (vmError.error) {
            return cb(vmError.message)
          }
        }
        
        let address = null
        let returnValue = null
        if (txResult && txResult.result) {
          address = isVM ? txResult.result.createdAddress : txResult.result.contractAddress
          // if it's not the VM, we don't have return value. We only have the transaction, and it does not contain the return value.
          returnValue = (txResult.result.execResult && isVM) ? txResult.result.execResult.returnValue : txResult.result
        }
        
        cb(error, txResult, address, returnValue)
      })
  }
  
  runEthere (args, confirmationCb, continueCb, promptCb, cb) {
    const self = this
    async.waterfall([
        function getGasLimit (next) {
          if (self.transactionContextAPI.getGasLimit) {
            return self.transactionContextAPI.getGasLimit(next)
          }
          next(null, 3000000)
        },
        function queryValue (gasLimit, next) {
          if (args.value) {
            return next(null, args.value, gasLimit)
          }
          if (args.useCall || !self.transactionContextAPI.getValue) {
            return next(null, 0, gasLimit)
          }
          self.transactionContextAPI.getValue(function (err, value) {
            next(err, value, gasLimit)
          })
        },
        function getAccount (value, gasLimit, next) {
          if (args.from) {
            return next(null, args.from, value, gasLimit)
          }
          if (self.transactionContextAPI.getAddress) {
            return self.transactionContextAPI.getAddress(function (err, address) {
              next(err, address, value, gasLimit)
            })
          }
          self.getAccounts(function (err, accounts) {
            let address = accounts[0]
            
            if (err) return next(err)
            if (!address) return next('No accounts available')
            // if (self.executionContext.isVM() && !self.providers.vm.accounts[address]) {
            if (self.executionContext.isVM() && !self.providers.vm.RemixSimulatorProvider.Accounts.accounts[address]) {
              return next('Invalid account selected')
            }
            next(null, address, value, gasLimit)
          })
        },
        function runTransaction (fromAddress, value, gasLimit, next) {
          const tx = {
            to: args.to,
            data: args.data.dataHex,
            useCall: args.useCall,
            from: fromAddress,
            value: value,
            gasLimit: gasLimit,
            timestamp: args.data.timestamp
          }
          const payLoad = {
            funAbi: args.data.funAbi,
            funArgs: args.data.funArgs,
            contractBytecode: args.data.contractBytecode,
            contractName: args.data.contractName,
            contractABI: args.data.contractABI,
            linkReferences: args.data.linkReferences
          }
          let timestamp = Date.now()
          if (tx.timestamp) {
            timestamp = tx.timestamp
          }
          
          self.event.trigger('initiatingTransaction', [timestamp, tx, payLoad])
          self.txRunner.rawRun(tx, confirmationCb, continueCb, promptCb,
            function (error, result) {
              if (error) return next(error)
              
              const rawAddress = self.executionContext.isVM() ? result.result.createdAddress : result.result.contractAddress
              let eventName = (tx.useCall ? 'callExecuted' : 'transactionExecuted')
              self.event.trigger(eventName, [error, tx.from, tx.to, tx.data, tx.useCall, result, timestamp, payLoad, rawAddress])
              
              if (error && (typeof (error) !== 'string')) {
                if (error.message) error = error.message
                else {
                  try { error = 'error: ' + JSON.stringify(error) } catch (e) {}
                }
              }
              next(error, result)
            }
          )
        },
      ]
    )
  }
  runFeeDelegatedTx (feePayerAccount, feePayerRatio, args, confirmationCb, continueCb, promptCb, cb) {
    const fullDelegated = feePayerRatio >= 100
    
    const self = this
    
    async.waterfall([
        function getGasLimit (next) {
          if (self.transactionContextAPI.getGasLimit) {
            return self.transactionContextAPI.getGasLimit(next)
          }
          next(null, 3000000)
        },
        function queryValue (gasLimit, next) {
          if (args.value) {
            return next(null, args.value, gasLimit)
          }
          if (args.useCall || !self.transactionContextAPI.getValue) {
            return next(null, 0, gasLimit)
          }
          self.transactionContextAPI.getValue(function (err, value) {
            next(err, value, gasLimit)
          })
        },
        function getAccount (value, gasLimit, next) {
          if (args.from) {
            return next(null, args.from, value, gasLimit)
          }
          if (self.transactionContextAPI.getAddress) {
            return self.transactionContextAPI.getAddress(function (err, address) {
              next(err, address, value, gasLimit)
            })
          }
          self.getAccounts(function (err, accounts) {
            let address = accounts[0]
            
            if (err) return next(err)
            if (!address) return next('No accounts available')
            // if (self.executionContext.isVM() && !self.providers.vm.accounts[address]) {
            if (self.executionContext.isVM() && !self.providers.vm.RemixSimulatorProvider.Accounts.accounts[address]) {
              return next('Invalid account selected')
            }
            next(null, address, value, gasLimit)
          })
        },
        function applyTxType (fromAddress, value, gasLimit, next) {
      
          args.type = args.to ? 'SMART_CONTRACT_EXECUTION' : 'SMART_CONTRACT_DEPLOY'
          next(null, fromAddress, value, gasLimit)
        },
        function setFeePayer (fromAddress, value, gasLimit, next) {
          args.type = `FEE_DELEGATED_${args.type}${fullDelegated ? '' : '_WITH_RATIO'}`
          
          if (!(feePayerAccount && feePayerAccount.privateKey)) {
            return next('invalid fee payer account')
          }
          
          next(null, fromAddress, value, gasLimit)
        },
        function signTransaction (fromAddress, value, gasLimit, next) {
          // const tx = { to: args.to, data: args.data.dataHex, useCall: args.useCall, from: fromAddress, value: value, gasLimit: gasLimit, timestamp: args.data.timestamp, type: args.type, feeRatio: feePayerRatio }
          new Promise(async (resolve, reject) => {
            const tx = {
              to: args.to,
              data: args.data.dataHex,
              useCall: args.useCall,
              from: fromAddress,
              value: value,
              gasLimit: gasLimit,
              timestamp: args.data.timestamp,
              type: args.type,
              feeRatio: feePayerRatio
            }
            if (fullDelegated) {
              delete tx.feeRatio
            }

            try {
              const res = await self.executionContext.caver().klay.signTransaction(tx)
              const result = {
                senderRawTransaction: res.rawTransaction,
                feePayer: feePayerAccount.address,
                type: args.type,
                from: feePayerAccount.address
              }
              
              return resolve([result, fromAddress, value, gasLimit])
            } catch (e) {
              console.log(e)
              throw e
            }
          }).then((data) => {
            next(null, data)
          }).catch(e => {
            console.log(e)
          })
        },
      
        function runTransaction ([signedTx, fromAddress, value, gasLimit], next) {
          const tx = signedTx
          
          const payLoad = {
            funAbi: args.data.funAbi,
            funArgs: args.data.funArgs,
            contractBytecode: args.data.contractBytecode,
            contractName: args.data.contractName,
            contractABI: args.data.contractABI,
            linkReferences: args.data.linkReferences
          }
          
          let timestamp = Date.now()
          if (tx.timestamp) {
            timestamp = tx.timestamp
          }

          self.event.trigger('initiatingTransaction', [timestamp, tx, payLoad])
          self.txRunner.rawRun({ signed: tx, gasLimit }, confirmationCb, continueCb, promptCb,
            function (error, result) {
              if (error) return next(error)
              
              const rawAddress = self.executionContext.isVM() ? result.result.createdAddress : result.result.contractAddress
              let eventName = (tx.useCall ? 'callExecuted' : 'transactionExecuted')

              self.event.trigger(eventName, [error, tx.from, tx.to, tx.data, tx.useCall, result, timestamp, payLoad, rawAddress])
              
              if (error && (typeof (error) !== 'string')) {
                if (error.message) error = error.message
                else {
                  try { error = 'error: ' + JSON.stringify(error) } catch (e) {}
                }
              }
              next(error, result)
            }
          )
        }
      ],
      (error, txResult) => {
        if (error) {
          return cb(error)
        }
        
        const isVM = this.executionContext.isVM()
        if (isVM) {
          const vmError = txExecution.checkVMError(txResult)
          if (vmError.error) {
            return cb(vmError.message)
          }
        }
        
        let address = null
        let returnValue = null
        if (txResult && txResult.result) {
          address = isVM ? txResult.result.createdAddress : txResult.result.contractAddress
          // if it's not the VM, we don't have return value. We only have the transaction, and it does not contain the return value.
          returnValue = (txResult.result.execResult && isVM) ? txResult.result.execResult.returnValue : txResult.result
        }
        
        cb(error, txResult, address, returnValue)
      })
  }
  
}

export default Blockchain