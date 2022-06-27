import React from 'react'
import {Dispatch} from 'redux'
import {newContractInstance as newInstanceAction} from '../redux/actions/contract'
import {connect} from "react-redux";
import publishToStorage from './publishToStorage'
import MultiParamManager from './multiParamManager'
import {select} from 'async'

const yo = require('yo-yo')

var css = require('../styles/run-tab-styles')
const Caver = require('caver-js')
var modalDialogCustom = require('./modal-dialog-custom')
var remixLib = require('remix-lib')
var EventManager = remixLib.EventManager
var confirmDialog = require('./confirmDialog')
var modalDialog = require('./modaldialog')
var addTooltip = require('./tooltip')

function IpfsCheckbox (props) {
  const { checked, changeAction } = props

  return checked === true
      ? <input id="deployAndRunPublishToIPFS" data-id="contractDropdownIpfsCheckbox" className="mr-2" checked type="checkbox" onChange={ changeAction } />
      : <input id="deployAndRunPublishToIPFS" data-id="contractDropdownIpfsCheckbox" className="mr-2" type="checkbox" onChange={ changeAction } />
}

class ContractDropdownUI extends React.Component {
  constructor (props) {
    super(props)

    const { blockchain, dropdownLogic, runView } = props
    let savedConfig
    
    try{
       savedConfig = window.localStorage.getItem(`ipfs/${this.exEnvironment}/${this.networkName}`)
    }catch(e){

    }

    this.state = {
      ipfsChecked: savedConfig === 'true',
      addressBarInput: '',
      contracts: props.list,
      selected: undefined,
      compFails: undefined
    }

    this.blockchain = blockchain
    this.dropdownLogic = dropdownLogic
    this.runView = runView
    this.event = new EventManager()
    this.logCallback = (msg) => {
      if (typeof msg === 'string') {
        global.client.terminal.log({ type: 'html', value: msg })
      } else {
        global.client.terminal.log(msg)
      }
    }
    this.listenToEvents()
    this.ipfsCheckedState = false
    this.exEnvironment = blockchain.getProvider()
    this.listenToContextChange()
  }

  componentDidUpdate (prevProps: Readonly<P>, prevState: Readonly<S>, snapshot: SS) {
    const { updatedAt } = this.props

    if (updatedAt !== prevProps.updatedAt) {
      this.setState({
        contracts: this.props.list,
        compFails: this.props.compFails,
        selected: (this.props.list.length > 0 ? this.dropdownLogic.getSelectedContract(this.props.list[0].name, this.props.list[0].compiler) : undefined) || this.state.selected
      })

      this.selectContractNames && (this.selectContractNames.selectedIndex = 0)
    }
  }

  listenToEvents = () => {
    this.dropdownLogic.event.register('newlyCompiled', (success, data, source, compiler, compilerFullName, file) => {
      if (success) {
        this.compFails.style.display = 'none'
      } else {
        this.compFails.style.display = 'block'
      }
    })
  }

  listenToContextChange = () => {
    this.blockchain.event.register('contextChanged', () => {
      this.blockchain.updateNetwork((err, {name} = {}) => {
        if (err) {
          console.log(`can't detect network`)
          return
        }
        this.exEnvironment = this.blockchain.getProvider()
        this.networkName = name
        let savedConfig = null
        
        try{
          savedConfig = window.localStorage.getItem(`ipfs/${this.exEnvironment}/${this.networkName}`)
        }catch(e){}
        
        // check if an already selected option exist else use default workflow
        if (savedConfig !== null) {
          this.setCheckedState(savedConfig)
        } else {
          this.setCheckedState(this.networkName === 'Main')
        }
      })
    })
  }

  setCheckedState = (value) => {
    value = value === 'true' ? true : value === 'false' ? false : value
    this.ipfsCheckedState = value
  }

  toggleCheckedState = () => {
    if (this.exEnvironment === 'vm') this.networkName = 'VM'
    this.ipfsCheckedState = !this.ipfsCheckedState
    
    try{
      window.localStorage.setItem(`ipfs/${this.exEnvironment}/${this.networkName}`, this.ipfsCheckedState)
    }catch(e){}
   
  }

  updateSelectedContract = (e) => {
    const name = e.target ? e.target.value || (e.name || '') : ''
    const contract = this.state.contracts.find(it => it.name === name)

    if (!contract) {
      return
    }

    const selected = this.dropdownLogic.getSelectedContract(contract.name, contract.compiler)
    

    this.setState({
      selected: selected
    })
  }

  render () {
    const { contracts, selected, compFails, addressBarInput } = this.state
    
    return <div className={css.container} data-id="contractDropdownContainer">
      <label className={css.settingsLabel}>Contract</label>
      <div className={css.subcontainer}>
        <select onLoad={ this.setInputParamsPlaceHolder } onChange={ this.updateSelectedContract } ref={ ref => this.selectContractNames = ref } className={`${css.contractNames} custom-select`} disabled={ this.state.compFails }>
          {
            contracts.map((contract, idx) => {
              return <option key={ idx } value={ contract.name } compiler={ contract.compilerFullName }>{contract.name} - {contract.fileName}</option>
            })
          }
        </select>
        {
          (contracts.length < 1 && compFails) && <i
              title="No contract compiled yet or compilation failed. Please check the compile tab for more information."
              className={`m-2 ml-3 fas fa-times-circle ${css.errorIcon}`} ref={ ref => this.compFails = ref }/>
        }
        <i className={`fas fa-info ${css.infoDeployAction}`} aria-hidden="true" title="*.sol files allows deploying and accessing contracts. *.abi files only allows accessing contracts." />
      </div>
      <div>
        <div ref={ ref => this.createPanel = ref } className={ css.deployDropdown }>
          { contracts.length < 1 && 'No compiled contracts' }
          { (selected !== undefined) && <MultiParamManager currentItem={ selected.name } lookupOnly={false} funABI={ selected.getConstructorInterface() } clickCallBack={ this.deployClickCallback } inputs={ selected.getConstructorInputs() } title={ 'Deploy' }
                                                           evmBC={ selected.bytecodeObject } isDeploy={ true } /> }
        </div>
        <div ref={ ref => this.orLabel = ref } className={ css.orLabel }>or</div>
        <div className={`${css.button} ${css.atAddressSect}`}>
          <button className={`${css.atAddress} btn btn-sm btn-info`} id="runAndDeployAtAdressButton"
                  onClick={ this.loadFromAddress } ref={ ref => this.atAddress = ref } disabled={ addressBarInput.length < 1 }>At Address
          </button>
          <input className={`${css.input} ${css.ataddressinput} ataddressinput form-control`}
                 ref={ ref => this.atAddressButtonInput = ref }
                 placeholder="Load contract from Address" title="address of contract"
                 onChange={ this.atAddressChanged } />
        </div>
      </div>
    </div>
  }

  deployClickCallback = async (valArray, inputsValues) => {
    var selectedContract = this.getSelectedContract()
    this.createInstance(selectedContract, inputsValues)
  }

  atAddressChanged = (event) => {
    this.setState({
      addressBarInput: event.target.value
    })
  }

  changeCurrentFile = (currentFile) => {
    if (!document.querySelector(`.${css.contractNames}`)) return
    var contractNames = document.querySelector(`.${css.contractNames.classNames[0]}`)

    if (/.(.abi)$/.exec(currentFile)) {
      this.createPanel.style.display = 'none'
      this.orLabel.style.display = 'none'
      this.compFails && (this.compFails.style.display = 'none')

      // contractNames.appendChild(yo`<option>(abi)</option>`)
      contractNames.disabled = true
    } else if (/.(.sol)$/.exec(currentFile)) {
      this.createPanel.style.display = 'block'
      this.orLabel.style.display = 'block'
      contractNames.disabled = false
    }

    this.updateSelectedContract(currentFile.slice('/')[1])
  }

  setInputParamsPlaceHolder = () => {
    Array.from(this.createPanel.children).forEach(child => child.remove())
    this.createPanel.value = ''

    if (this.selectContractNames.selectedIndex < 0 || this.selectContractNames.children.length <= 0) {
      this.createPanel.value = 'No compiled contracts'
      return
    }
  }

  getSelectedContract = () => {
    const { selected } = this.state

    return selected
  }

  async createInstance (selectedContract, args) {
    
    if (selectedContract.bytecodeObject.length === 0) {
      return modalDialogCustom.alert('This contract may be abstract, not implement an abstract parent\'s methods completely or not invoke an inherited contract\'s constructor correctly.')
    }

    var continueCb = (error, continueTxExecution, cancelCb) => {
      if (error) {
        var msg = typeof error !== 'string' ? error.message : error
        modalDialog('Gas estimation failed', yo`<div>Gas estimation errored with the following message (see below).
            The transaction execution will likely fail. Do you want to force sending? <br/>
            ${msg}
          </div>`,
            {
              label: 'Send Transaction',
              fn: () => {
                continueTxExecution()
              }}, {
              label: 'Cancel Transaction',
              fn: () => {
                cancelCb()
              }
            })
      } else {
        continueTxExecution()
      }
    }

    var promptCb = (okCb, cancelCb) => {
      modalDialogCustom.promptPassphrase('Passphrase requested', 'Personal mode is enabled. Please provide passphrase of account', '', okCb, cancelCb)
    }

    var statusCb = (msg) => {
      return this.logCallback({
        value: msg,
        type: 'html'
      })
    }

    var finalCb = (error, contractObject, address) => {
      this.event.trigger('clearInstance')

      if (error) {
        return this.logCallback({
          value: error,
          type: 'error'
        })
      }

      this.props.newInstance({
        ...contractObject,
        address,
        created: new Date().getTime()
      })
      // this.event.trigger('newContractInstanceAdded', [contractObject, address, contractObject.name])
      if (this.ipfsCheckedState) {
        publishToStorage('ipfs', this.runView.fileProvider, this.runView.fileManager, selectedContract)
      }
    }
    const confirmationCb = this.getConfirmationCb(modalDialog, confirmDialog)

    let contractMetadata = undefined
    const compilerContracts = this.dropdownLogic.getCompilerContracts()

    if (selectedContract.isOverSizeLimit()) {
      return modalDialog('Contract code size over limit', yo`<div>Contract creation initialization returns data with length of more than 24576 bytes. The deployment will likely fails. <br/>
            More info: <a href="https://github.com/ethereum/EIPs/blob/master/EIPS/eip-170.md" target="_blank" rel="noopener noreferrer">eip-170</a>
          </div>`,
          {
            label: 'Force Send',
            fn: () => {
              this.deployContract(selectedContract, args, contractMetadata, compilerContracts, {continueCb, promptCb, statusCb, finalCb}, confirmationCb)
            }}, {
            label: 'Cancel',
            fn: () => {
              this.logCallback({
                type: 'info',
                value: `creation of ${selectedContract.name} canceled by user.`
              })
            }
          })
    }
    this.deployContract(selectedContract, args, contractMetadata, compilerContracts, {continueCb, promptCb, statusCb, finalCb}, confirmationCb)
  }

  getConstructor (abi) {
    const constructorMethods = abi.filter(
        (method) => method.type === 'constructor')
    if (constructorMethods.length > 0) {
      return constructorMethods[0]
    }
    return {
      type: 'constructor',
      inputs: [],
      payable: false,
      constant: false,
      name: '',
    }
  }

  fromAscii = (value) => {
    return Array.isArray(value)
        ? value.map((v) => this.fromAscii(v))
        : Caver.utils.fromAscii(value)
  }

  deploy = async (contract, params, txMetadata) => {
    let abi = contract.abi
    const constructor = this.getConstructor(abi)
    const bytecode = '0x' + contract.bytecodeObject
    const orderedParams = constructor.inputs.map(({ name, type }) => {
      const value = params[name]
      if (type.startsWith('bytes')) {
        // web3js doesn't automatically convert string to bytes32
        return this.fromAscii(value)
      }
      return value
    })

    const caver = this.blockchain.caver()
    const caverContract = new caver.klay.Contract(abi)

    const deployableContract = await caverContract.deploy({
      data: bytecode,
      arguments: orderedParams,
      from: caver.address
    })

    let tx = {
      ...txMetadata,
      value: Caver.utils.toPeb(txMetadata.value, txMetadata.valueDenomination),
    }

    tx.gasPrice = (txMetadata.gasLimit !== '') ? parseInt(txMetadata.gasLimit, 10) : await deployableContract.estimateGas(tx)

    return await deployableContract.send(tx)
  }

  deployContract = (selectedContract, args, contractMetadata, compilerContracts, callbacks, confirmationCb) => {
    const { statusCb } = callbacks
    if (!contractMetadata || (contractMetadata && contractMetadata.autoDeployLib)) {
      return this.blockchain.deployContractAndLibraries(selectedContract, args, contractMetadata, compilerContracts, callbacks, confirmationCb)
    }
    if (Object.keys(selectedContract.bytecodeLinkReferences).length) statusCb(`linking ${JSON.stringify(selectedContract.bytecodeLinkReferences, null, '\t')} using ${JSON.stringify(contractMetadata.linkReferences, null, '\t')}`)
    this.blockchain.deployContractWithLibrary(selectedContract, args, contractMetadata, compilerContracts, callbacks, confirmationCb)
  }

  getConfirmationCb = (modalDialog, confirmDialog) => {
    // this code is the same as in recorder.js. TODO need to be refactored out
    const confirmationCb = (network, tx, gasEstimation, continueTxExecution, cancelCb) => {
      if (network.name !== 'Main') {
        return continueTxExecution(null)
      }
      const amount = this.blockchain.fromWei(tx.value, true, 'ether')
      const content = confirmDialog(tx, amount, gasEstimation, null, this.blockchain.determineGasFees(tx), this.blockchain.determineGasPrice.bind(this.blockchain))

      modalDialog('Confirm transaction', content,
          { label: 'Confirm',
            fn: () => {
              this.blockchain.config.setUnpersistedProperty('doNotShowTransactionConfirmationAgain', content.querySelector('input#confirmsetting').checked)
              // TODO: check if this is check is still valid given the refactor
              if (!content.gasPriceStatus) {
                cancelCb('Given gas price is not correct')
              } else {
                var gasPrice = this.blockchain.toWei(content.querySelector('#gasprice').value, 'gwei')
                continueTxExecution(gasPrice)
              }
            }}, {
            label: 'Cancel',
            fn: () => {
              return cancelCb('Transaction canceled by user.')
            }
          }
      )
    }

    return confirmationCb
  }

  loadFromAddress = async () => {
    let initFileName = await global.client.fileManager.getCurrentFile() || '/'
    let fileName

    if(initFileName.includes('/')){
      fileName = (initFileName).split('/')[1].split('.')[0];
    }else{
      fileName = (initFileName).split('.')[0];
    }

    const selectedContract = this.getSelectedContract()
    
    var address = this.atAddressButtonInput.value

    this.dropdownLogic.loadContractFromAddress(address,
        (cb) => {
          modalDialogCustom.confirm(null, 'Do you really want to interact with ' + address + ' using the current ABI definition?', cb)
        },
        (error, loadType, abi) => {
          if (error) {
            return addTooltip(error)
          }
          let data = {
            address,
            abi,
            name: fileName
          }

          if (loadType !== 'abi') {
            Object.assign(data, {
              name: selectedContract.name,
              ...selectedContract.object
            })
          }
          this.props.newInstance(data)
        }
    )
  }
}

const mapStateToProps = ({ contract }: ReduxState) => ({
  list: contract.contracts,
  compFails: contract.newlyCompiled.success === false,
  updatedAt: contract.updatedAt.contracts
})


const mapDispatchToProps = (dispatch: Dispatch) => ({
  newInstance: (contract) => dispatch(newInstanceAction(contract))
  // change: (pin, newPin) => dispatch(changeAction(pin, newPin)),
  // dismiss: (name) => dispatch(dismissAction(name)),
})

export default connect(
    mapStateToProps,
    mapDispatchToProps,
    null,
    { forwardRef: true }
)(ContractDropdownUI)
