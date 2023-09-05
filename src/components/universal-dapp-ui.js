import React from 'react'
import MultiParamManager from './multiParamManager'
import TreeView from './TreeView'
import {Dispatch} from 'redux'
import {removeContractInstance as removeAction} from '../redux/actions/contract'
import {connect} from 'react-redux'
import {dismissPopup as dismissAction, displayPopup as displayAction} from '../redux/actions/popup'
import CopyToClipboard from './copy-to-clipboard'

var $ = require('jquery')
var yo = require('yo-yo')
var ethJSUtil = require('ethereumjs-util')
var helper = require('../lib/helper')
var css = require('../universal-dapp-styles')
var remixLib = require('remix-lib')
var txFormat = remixLib.execution.txFormat
const txHelper = remixLib.execution.txHelper
var txCallBacks = require('./sendTxCallbacks')


function DecodedResponseTreeView (props) {
  const { response, fnabi } = props
  return <TreeView json={ txFormat.decodeResponse(response, fnabi) } />
}

function CallButton(props) {
  const { funABI, decoded, self } = props
  const args = {
    address: self.state.address,
    contractName: self.state.contractName,
    contractAbi: self.state.abi,
    funABI
  }
  const isConstant = funABI.constant !== undefined ? funABI.constant : false
  const lookupOnly = funABI.stateMutability === 'view' || funABI.stateMutability === 'pure' || isConstant
  return (
      <div className={css.contractActionsContainer}>
        <MultiParamManager lookupOnly={ lookupOnly } funABI={ funABI } clickCallBack={ (valArray, inputsValues) => self.runTransaction(lookupOnly, args, valArray, inputsValues)}
                           inputs={ self.blockchain.getInputs(funABI) } args={args}  />
        <div className={css.value}>{
          decoded && <DecodedResponseTreeView response={ decoded.response } fnabi={ decoded.abi } />
        }</div>
      </div>
  )
}

class UniversalDAppUI extends React.Component {

  static convert(contract: Contract) {
    return {
      abi: txHelper.sortAbiFunction(contract.abi),
      name: contract.name,
      address: contract.address
    }
  }

  constructor(props) {
    super(props)

    
    let { blockchain, contractName, abi, address, created } = props

    this.blockchain = blockchain

    address = (address.slice(0, 2) === '0x' ? '' : '0x') + address.toString('hex')
    address = ethJSUtil.toChecksumAddress(address)

    this.state = {
      abi,
      address,
      contractName,
      created,
      decoded: {}
    }
  }

  renderInstanceFromABI = (contractABI, address, contractName) => {
   
    let self = this
    address = (address.slice(0, 2) === '0x' ? '' : '0x') + address.toString('hex')
    address = ethJSUtil.toChecksumAddress(address)
    var instance = yo`<div class="instance run-instance border-dark ${css.instance} ${css.hidesub}" id="instance${address}" data-shared="universalDappUiInstance"></div>`
    const context = this.blockchain.context()

    var shortAddress = helper.shortenAddress(address)
    var title = yo`
    <div class="${css.title} alert alert-secondary">
      <button data-id="universalDappUiTitleExpander" class="btn ${css.titleExpander}" onclick="${(e) => { toggleClass(e) }}">
        <i class="fas fa-angle-right" aria-hidden="true"></i>
      </button>
      <div class="input-group ${css.nameNbuts}">
        <div class="${css.titleText} input-group-prepend">
          <span class="input-group-text ${css.spanTitleText}">
            ${contractName} at ${shortAddress} (${context})
          </span>
        </div>
        <div class="btn-group">
          <button class="btn p-1 btn-secondary">
          <CopyToClipboard getContent={ () => address) } />
</button>
        </div>
      </div>
    </div>
  `

    var close = yo`
    <button
      class="${css.udappClose} mr-2 p-1 btn btn-secondary"
      data-id="universalDappUiUdappClose"
      onclick=${remove}
      title="Remove from the list"
    >
      <i class="${css.closeIcon} fas fa-times" aria-hidden="true"></i>
    </button>`
    title.querySelector('.btn-group').appendChild(close)

    var contractActionsWrapper = yo`
    <div class="${css.cActionsWrapper}" data-id="universalDappUiContractActionWrapper">
    </div>
  `

    function remove () {
      instance.remove()
      // @TODO perhaps add a callack here to warn the caller that the instance has been removed
    }

    function toggleClass (e) {
      $(instance).toggleClass(`${css.hidesub} bg-light`)
      // e.currentTarget.querySelector('i')
      e.currentTarget.querySelector('i').classList.toggle(`fa-angle-right`)
      e.currentTarget.querySelector('i').classList.toggle(`fa-angle-down`)
    }

    instance.appendChild(title)
    instance.appendChild(contractActionsWrapper)

    $.each(contractABI, (i, funABI) => {
      if (funABI.type !== 'function') {
        return
      }
      // @todo getData cannot be used with overloaded functions
      contractActionsWrapper.appendChild(this.getCallButton({
        funABI: funABI,
        address: address,
        contractABI: contractABI,
        contractName: contractName
      }))
    })

    const calldataInput = yo`
    <input id="deployAndRunLLTxCalldata" class="${css.calldataInput} form-control" title="The Calldata to send to fallback function of the contract.">
  `
    const llIError = yo`
    <label id="deployAndRunLLTxError" class="text-danger my-2"></label>
  `
    // constract LLInteractions elements
    const lowLevelInteracions = yo`
    <div class="d-flex flex-column">
      <div class="d-flex flex-row justify-content-between mt-2">
        <div class="py-2 border-top d-flex justify-content-start flex-grow-1">
          Low level interactions
        </div>
        <a
          href="https://solidity.readthedocs.io/en/v0.6.2/contracts.html#receive-ether-function"
          title="check out docs for using 'receive'/'fallback'"
          target="_blank"
        >
          <i aria-hidden="true" class="fas fa-info my-2 mr-1"></i>
        </a>
      </div>
      <div class="d-flex flex-column align-items-start">
        <label class="">CALLDATA</label>
        <div class="d-flex justify-content-end w-100 align-items-center">
          ${calldataInput}
          <button id="deployAndRunLLTxSendTransaction" data-id="pluginManagerSettingsDeployAndRunLLTxSendTransaction" class="${css.instanceButton} p-0 w-50 btn border-warning text-warning" title="Send data to contract." onclick=${() => sendData()}>Transact</button>
        </div>
      </div>
      <div>
        ${llIError}
      </div>
    </div>
  `

    function sendData () {
      function setLLIError (text) {
        llIError.innerText = text
      }

      setLLIError('')
      const fallback = txHelper.getFallbackInterface(contractABI)
      const receive = txHelper.getReceiveInterface(contractABI)
      const args = {
        funABI: fallback || receive,
        address: address,
        contractName: contractName,
        contractABI: contractABI
      }
      const amount = document.querySelector('#value').value
      if (amount !== '0') {
        // check for numeric and receive/fallback
        if (!helper.isNumeric(amount)) {
          return setLLIError('Value to send should be a number')
        } else if (!receive && !(fallback && fallback.stateMutability === 'payable')) {
          return setLLIError("In order to receive Ether transfer the contract should have either 'receive' or payable 'fallback' function")
        }
      }
      let calldata = calldataInput.value
      if (calldata) {
        if (calldata.length < 2 || (calldata.length < 4 && helper.is0XPrefixed(calldata))) {
          return setLLIError('The calldata should be a valid hexadecimal value with size of at least one byte.')
        } else {
          if (helper.is0XPrefixed(calldata)) {
            calldata = calldata.substr(2, calldata.length)
          }
          if (!helper.isHexadecimal(calldata)) {
            return setLLIError('The calldata should be a valid hexadecimal value.')
          }
        }
        if (!fallback) {
          return setLLIError("'Fallback' function is not defined")
        }
      }

      if (!receive && !fallback) return setLLIError(`Both 'receive' and 'fallback' functions are not defined`)

      // we have to put the right function ABI:
      // if receive is defined and that there is no calldata => receive function is called
      // if fallback is defined => fallback function is called
      if (receive && !calldata) args.funABI = receive
      else if (fallback) args.funABI = fallback

      if (!args.funABI) return setLLIError(`Please define a 'Fallback' function to send calldata and a either 'Receive' or payable 'Fallback' to send ethers`)
      self.runTransaction(false, args, null, calldataInput.value, null)
    }

    contractActionsWrapper.appendChild(lowLevelInteracions)
    return instance
  }

  render () {
    const { abi, address, contractName, decoded } = this.state
    const context = this.blockchain.context()
 
    if (!decoded) {
      return this.renderInstanceFromABI(abi, address, contractName)
    }
 
    return <div ref={ ref => this.instance = ref} className={`instance run-instance border-dark ${css.instance} ${css.hidesub}`}
                id={`instance${address}`} data-shared="universalDappUiInstance">
      <div className={`${css.title} alert alert-secondary`}>
        <button data-id="universalDappUiTitleExpander" className={`btn ${css.titleExpander}`}
                onClick={ this.toggleClass }>
          <i className="fas fa-angle-right" aria-hidden="true"></i>
        </button>
        <div className={`input-group ${css.nameNbuts}`}>
          <div className={`${css.titleText} input-group-prepend`}>
          <span className={`input-group-text ${css.spanTitleText}`}>
            {contractName} at {helper.shortenAddress(address)} ({context})
          </span>
          </div>
          <div className="btn-group">
            <button className="btn p-1 btn-secondary">
              <CopyToClipboard getContent={ () => address } />
            </button>
            <button
                className={`${css.udappClose} mr-2 p-1 btn btn-secondary`}
                data-id="universalDappUiUdappClose"
                onClick={this.remove}
                title="Remove from the list"
            >
              <i className={`${css.closeIcon} fas fa-times`} aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
      <div className={`${css.cActionsWrapper}`} data-id="universalDappUiContractActionWrapper">
        {
          abi.filter(it => {return it.type === 'function' && it.stateMutability !=='view' && it.stateMutability !== 'pure'}).map((funABI ,idx) => {
            return <CallButton key={ `${contractName}_${funABI.name}_${idx}` } decoded={ decoded[funABI.name] } funABI={ funABI } self={ this } />
          })
        }
        {
          abi.filter(it => {return (it.type === 'function' && it.stateMutability ==='view') || it.stateMutability === 'pure' }).map((funABI ,idx) => {
            return <CallButton key={ `${contractName}_${funABI.name}_${idx}` } decoded={ decoded[funABI.name] } funABI={ funABI } self={ this } />
          })
        }
        <div className="d-flex flex-column">
          <div className="d-flex flex-row justify-content-between mt-2">
            <div className="py-2 border-top d-flex justify-content-start flex-grow-1">
              Low level interactions
            </div>
            <a
                href="https://solidity.readthedocs.io/en/v0.6.2/contracts.html#receive-ether-function"
                title="check out docs for using 'receive'/'fallback'"
                rel="noopener noreferrer"
                target="_blank"
            >
              <i aria-hidden="true" className="fas fa-info my-2 mr-1" />
            </a>
          </div>
          <div className="d-flex flex-column align-items-start">
            <label className="">CALLDATA</label>
            <div className="d-flex justify-content-end w-100 align-items-center">
              <input id="deployAndRunLLTxCalldata" className={`${css.calldataInput} form-control`}
                     title="The Calldata to send to fallback function of the contract." />
              <button id="deployAndRunLLTxSendTransaction" data-id="pluginManagerSettingsDeployAndRunLLTxSendTransaction"
                      className={`${css.instanceButton} p-0 w-50 btn border-warning text-warning"
                    title="Send data to contract.`} onClick={ this.sendData }>Transact</button>
            </div>
          </div>
          <div>
            <label id="deployAndRunLLTxError" className="text-danger my-2"></label>
          </div>
        </div>
      </div>
    </div>
  }

  remove = () => {
    // @TODO perhaps add a callack here to warn the caller that the instance has been removed
    this.props.removeInstance(this.props.idx)
  }

  toggleClass = (e) => {
    if (!this.instance) {
      return
    }

    $(this.instance).toggleClass(`${css.hidesub} bg-light`)
    // e.currentTarget.querySelector('i')
    e.currentTarget.querySelector('i').classList.toggle(`fa-angle-right`)
    e.currentTarget.querySelector('i').classList.toggle(`fa-angle-down`)
  }

  displayReceipt = (txOutput) => {
  }

  sendData = () => {
  }
// TODO this is used by renderInstance when a new instance is displayed.
// this returns a DOM element.

  runTransaction = (lookupOnly, args, valArr, inputsValues) => {
    const functionName = args.funABI.type === 'function' ? args.funABI.name : `(${args.funABI.type})`
    const logMsg = `${lookupOnly ? 'call' : 'transact'} to ${args.contractName}.${functionName}`

    const callbacksInContext = txCallBacks.getCallBacksWithContext(this, this.blockchain)

    const params = args.funABI.type !== 'fallback' ? inputsValues : ''

    this.blockchain.runOrCallContractMethod(
        args.contractName,
        args.contractAbi,
        args.funABI,
        inputsValues,
        args.address,
        params,
        lookupOnly,
        logMsg,
        (msg) => {
          if (typeof msg === 'string') {
            global.client.terminal.log({ type: 'html', value: msg })
          } else {
            global.client.terminal.log(msg)
          }
        },
        (returnValue) => {
          this.setState({
            decoded: {
              ...this.state.decoded,
              [args.funABI.name]: {
                response: returnValue,
                abi: args.funABI
              }
            }
          }, () => {

          })
        },
        callbacksInContext.confirmationCb.bind(callbacksInContext),
        callbacksInContext.continueCb.bind(callbacksInContext),
        callbacksInContext.promptCb.bind(callbacksInContext),
        this.displayReceipt)
  }
}

const mapDispatchToProps = (dispatch: Dispatch) => ({
  removeInstance: (idx) => dispatch(removeAction({idx})),
  display: (name, output) => dispatch(displayAction({ name, closable: true, params: output })),
  dismiss: (name) => dispatch(dismissAction(name)),
})

export default connect(
    null,
    mapDispatchToProps,
    null,
    { forwardRef: true }
)(UniversalDAppUI)
