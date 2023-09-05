import React from 'react'
import ReactDOM from 'react-dom'
import './index.css'
import '@fortawesome/fontawesome-free/css/all.min.css'
import {Provider} from 'react-redux'
import {addPublicKey, connectToNetwork, fetchCompilationResult, setError} from './actions'
import {getPluginDevMode, isDevelopment, loadFromLocalStorage} from './utils/EnvUtils'
import PluginUDapp from './blockchain/pluginUDapp'
import NetworkModule from './components/network-module'
import store from './redux/store'
import {makeUdapp} from './make-udapp'
import RunTab from './run-tab'
import Blockchain from './blockchain/bc'
import {CompilerArtefacts} from './compiler/compiler-artefacts'

import {PluginClient} from '@remixproject/plugin'
import {createClient} from '@remixproject/plugin-iframe'

let blockchain = {}
let pluginUDapp = {}
let networkModule = {}
global.artefacts = new CompilerArtefacts()


const allowedOrigins = [
  'http://remix.ethereum.org',
  'https://remix.ethereum.org',
  'http://localhost:8080',
  process.env['REACT_APP_END_POINT'],
  process.env['REACT_APP_END_POINT'].replace('http','https'),
  process.env['REACT_APP_IDE']
]

//iframe 설정된 allowOrigins만 연결
const client = createClient(new PluginClient({
  allowOrigins: allowedOrigins,
  devMode: getPluginDevMode({
    origins: allowedOrigins,
    port: 8080
  })
}))

async function setupDefaults () {
  blockchain = new Blockchain({})
  pluginUDapp = new PluginUDapp(blockchain)
  networkModule = new NetworkModule(blockchain)
  
  makeUdapp(blockchain, global.artefacts.compilersArtefacts, client.terminal.log)
  
  window.klaytn && (window.klaytn.autoRefreshOnNetworkChange = false)
  
  initPlugin(client, store.dispatch)
    .catch((e) => console.error('Error initializing plugin', e))
  
}

//plugin URL을 직접 path를 입력했을때 대응 (remix.ethereum.org) Link move
if (!client.isLoaded) {
  ReactDOM.render(
    <Provider store={store}>
      <div style={{ width: '100%', height: '100%', backgroundColor: '#2a2c3f' }}>
        <div style={{ color: '#fff', textAlign: 'center', top: '45%', position: 'relative', fontSize: '24px' }}>This is the plugin url. Direct
          connection is not possible. <br/>You need to connect the plugin from https://remix.ethereum.org
          <div style={{ marginTop: '20px' }}>
            <button className={'goToButton'} onClick={() => {window.open('https://remix.ethereum.org/')}}>Go to remix.ethereum.org</button>
          </div>
        </div>
      </div>
    </Provider>,
    document.getElementById('root'))
}
client.onload(async () => {
  await setupDefaults()
  ReactDOM.render(
    <Provider store={store}>
      <RunTab blockchain={blockchain} pluginUDapp={pluginUDapp} networkModule={networkModule} artefacts={global.artefacts}/>
    </Provider>,
    document.getElementById('root'))
}).catch(e => console.log({ err: e }))

// we only want to subscribe to these once, so we do it outside of components
async function initPlugin (client, dispatch) {
  if (isDevelopment()) {
    await initDev(client, dispatch)
  }
  
  global.client = client
  
  try {
    // test setting a value to find out if localStorage is blocked
    window.localStorage.initialized = 'true'
    
    const savedNetwork = JSON.parse(loadFromLocalStorage('network') || '{}')
    connectToNetwork(savedNetwork.endpoint)
    
    const savedPublicKeys = JSON.parse(loadFromLocalStorage('keysFromUser') || '[]')
    savedPublicKeys.forEach((key) => dispatch(addPublicKey(key)))
    
  } catch (e) {
    console.log(e)
    dispatch(setError('Warning: Could not access local storage. You can still use all the features of the plugin, but network urls will not be remembered between reloads. To fix, allow 3rd party cookies in the browser settings. The Klaytn plugin does not use cookies, however this setting also blocks the plugin from using local storage to remember settings.'))
  }
  
  fetchCompilationResult(client)
  client.solidity.on('compilationFinished',
    (fileName, source, languageVersion, data) => {
      // just refetching every time for now
      fetchCompilationResult(client)
    })
  
}

async function initDev(client) {}
