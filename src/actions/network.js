import {getAccounts, testUrl, updateCaverKaikas, updateCaverUrl,} from '../api'
import {setError} from './error'
import {resetTransactionResults} from './contracts'

export function editNetwork (edit) {
  return { type: 'EDIT_NETWORK', payload: edit }
}

function setNetwork (endpoint, accounts, status, editing) {
  return {
    type: 'SET_NETWORK',
    payload: {
      endpoint,
      accounts,
      status,
      editing
    }
  }
}

/**
 * This action attempts to connect to the network, gets accounts, and gets the
 * tessera party keys if a url is provided. It then updates the current
 * network whether or not there were errors. If there were errors, it shows
 * them. It also resets transaction results in the deployed contract widgets
 * after connection to prevent confusion when switching nodes.
 *
 * @param endpoint Geth RPC Url (http://localhost:22000)
 * @param tesseraEndpoint Tessera endpoint (http://localhost:9081)
 * @returns thunk middleware dispatch function
 */
export function connectToNetwork (endpoint) {
  return async dispatch => {
    dispatch({ type: 'SET_NETWORK_CONNECTING' })
    let accounts = [], status = 'Disconnected', editing = true, error = ''
    try {
      if (endpoint) {
        if (endpoint !== 'kaikas') {
          await updateCaverUrl(endpoint)
        } else {
          await updateCaverKaikas()
        }

        status = 'Connected'
        editing = false
        accounts = await getAccounts()
      } else {
        error = 'Please connect to a quorum node'
      }

    } catch (e) {
      console.log('Error fetching network data', e.message)
      error = e.message
    }

    dispatch(setError(error))

    dispatch(setNetwork(endpoint, accounts, status, editing))

    dispatch(resetTransactionResults())
  }
}

/**
 * This action attempts to connect to the given network, connecting if
 * successful and showing an error if unsuccessful.
 *
 * @param endpoint Geth RPC Url (http://localhost:22000)
 * @param tesseraEndpoint Tessera endpoint (http://localhost:9081)
 * @returns thunk middleware dispatch function
 */
export function saveNetwork (endpoint = '') {
  return async dispatch => {
    try {

      await testUrl(endpoint)
      dispatch(connectToNetwork(endpoint))

    } catch (e) {
      console.log('Error fetching network data', e.message)
      dispatch(setError(e.message))
    }
  }
}
