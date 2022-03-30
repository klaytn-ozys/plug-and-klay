import {errorReducer} from './error'
import {networkReducer} from './network'
import {txMetadataReducer} from './txMetadata'
import {compilationReducer} from './compilation'
import {deployedReducer} from './deployed'
import {combineReducers} from 'redux'
import contractReducer from './contract'

const reducers = combineReducers({
    error: errorReducer,
    network: networkReducer,
    txMetadata: txMetadataReducer,
    compilation: compilationReducer,
    deployed: deployedReducer,
    contract: contractReducer
  })

export default reducers