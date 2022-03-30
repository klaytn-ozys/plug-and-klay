// @flow
import {applyMiddleware, compose, createStore} from 'redux'
import {composeWithDevTools} from 'redux-devtools-extension'
import createSagaMiddleware from 'redux-saga'

import rootSaga from './sagas'
import reducers from './reducers'
import {isDevelopment} from '../utils/EnvUtils'

const composeEnhancer = isDevelopment() ? composeWithDevTools : compose
const sagaMiddleware = createSagaMiddleware()
const middlewares = [
  sagaMiddleware,
]

const store = createStore(
  reducers,
  {},
  composeEnhancer(
    applyMiddleware(...middlewares)
  )
)

sagaMiddleware.run(rootSaga)

export default store