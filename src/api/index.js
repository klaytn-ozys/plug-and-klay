import Caver from 'caver-js'
import {fromAscii} from '../utils/TypeUtils'
import {getConstructor} from '../utils/ContractUtils'
import axios from 'axios'

axios.defaults.headers.post['Content-Type'] = 'application/json'

let caver

export async function updateCaverUrl (endpoint) {
  caver = createCaver(endpoint)
  await testUrl(endpoint)
}

export async function updateCaverKaikas () {
  caver = new Caver(window.klaytn)
}

function prepareForAxiosCall (url, path = '/'){
  const parsed = new URL(url)
  const username = parsed.username
  const password = parsed.password
  const config = {}
  if (username) {
    config.auth = {
      username: username,
      password: password
    }
  }
  parsed.username = ''
  parsed.password = ''
  parsed.pathname = path
  return [parsed.toString(), config]
}

export async function testUrl (rpcEndpoint) {
  if (!rpcEndpoint) {
    throw new Error('RPC url must not be blank.')
  }
  try {
    if (rpcEndpoint.startsWith('http')) {
      const [url, config] = prepareForAxiosCall(rpcEndpoint)
      // test with axios because we get more detailed errors back than web3
      
      await axios.post(url,
        { 'jsonrpc': '2.0', 'method': 'eth_protocolVersion', 'params': [] },
        config)
    }

    // test with Web3 because there are slight differences in how it connects
    const testCaver = createCaver(rpcEndpoint)
    await testCaver.klay.getProtocolVersion()

  } catch (e) {
    if (e.response) {
      if(e.response.status === 401) {
        throw new Error(`401 Unauthorized. Did you include Basic Auth credentials in the URL? (https://username:password@example.com)`)
      }
      throw new Error(
        `Error response from ${rpcEndpoint}: ${e.response.status} ${e.response.statusText} ${e.response.data}`)
    } else {
      throw new Error(
        `Could not connect to ${rpcEndpoint}: ${e.message}. This could be: a. geth is not running at this address, b. the port is not accessible, or c. CORS settings on geth do not allow this url (check the developer console for CORS errors)`)
    }
  }
}

function createCaver (endpoint) {
  let provider
  if (endpoint.startsWith('http')) {
    const parsed = new URL(endpoint)
    const headers = []
    if (parsed.username) {
      const encoded = new Buffer(
        `${parsed.username}:${parsed.password}`).toString('base64')
      parsed.username = ''
      parsed.password = ''
      headers.push({ name: 'Authorization', value: `Basic ${encoded}` })
    }
    provider = new Caver.providers.HttpProvider(parsed.toString(), {
      headers: headers,
    })
  } else if (endpoint.startsWith('ws')) {
    // ws provider creates auth header automatically
    provider = new Caver.providers.WebsocketProvider(endpoint)

  } else {
    provider = endpoint
  }
  return new Caver(provider)
}

export async function getAccounts () {
  return caver.klay.getAccounts()
}

export async function deploy (contract, params, txMetadata) {
  let abi = contract.abi
  const constructor = getConstructor(abi)
  const bytecode = '0x' + contract.evm.bytecode.object
  const orderedParams = constructor.inputs.map(({ name, type }) => {
    const value = params[name]
    if (type.startsWith('bytes')) {
      // web3js doesn't automatically convert string to bytes32
      return fromAscii(value)
    }
    return value
  })

  const caverContract = new caver.klay.Contract(abi)
  const deployableContract = await caverContract.deploy({
    data: bytecode,
    arguments: orderedParams,
  })

  const tx = {
    from: txMetadata.account,
    gasPrice: txMetadata.gasPrice,
    value: Caver.utils.toPeb(txMetadata.value, txMetadata.valueDenomination),
  }

  tx.gas = txMetadata.gasLimit !== '' ? parseInt(txMetadata.gasLimit, 10) : await deployableContract.estimateGas(tx)

  if (txMetadata.privateTransaction) {
    tx.privateFrom = txMetadata.privateFrom
    tx.privateFor = txMetadata.privateFor
  }

  const response = await deployableContract.send(tx)
  return response
}

export async function contractMethod (txMetadata, params, method, privateFor,
  selectedPrivateFor, contract) {
  const { account, gasLimit, gasPrice, value, valueDenomination } = txMetadata
  var _params = Object.values(params)
  var _sig_params = _params.map((value) => JSON.stringify(value)).join(', ')
  var methodSig = method.name + '(' + _sig_params + ')'

  await verifyContract(contract.address)

  let caverContract = new caver.klay.Contract(contract.abi, contract.address)
  let caverMethod = caverContract.methods[method.name](..._params)

  var methodArgs = {
    from: account,
    gasPrice,
    value: Caver.utils.toPeb(value, valueDenomination),
    args: _params,
    privateFor: privateFor && selectedPrivateFor.filter(
      ({ enabled }) => enabled).map(({ key }) => key)
  }

  methodArgs.gas = gasLimit !== '' ? parseInt(gasLimit, 10) : await caverMethod.estimateGas(methodArgs)

  let callOrSend = method.constant ? 'call' : 'send'
  const res = await caverMethod[callOrSend](methodArgs)
  return { methodSig, methodArgs, res }
}

export async function verifyContract(address) {
  const contractBinary = await caver.klay.getCode(address)
  if (contractBinary === '0x') {
    throw new Error(`Contract does not exist at ${address}`)
  }
}
