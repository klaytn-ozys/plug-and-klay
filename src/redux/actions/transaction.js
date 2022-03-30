import {NEW_TRANSACTION_BROADCASTED} from './actionTypes'

export const txBroadcasted: ReduxAction = (payload: {}) => ({
  type: NEW_TRANSACTION_BROADCASTED,
  payload: payload
})