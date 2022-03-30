import {all} from 'redux-saga/effects'
import {contractSagas} from './contract'

export default function* rootSaga() {
  yield all([
    ...contractSagas
  ])
}
