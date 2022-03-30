import {ADD_ACCOUNT, ADD_PROVIDER, REMOVE_ACCOUNT, REMOVE_PROVIDER} from '../actions/actionTypes'

const initialState = {
  endpoint: '',
  tesseraEndpoint: '',
  accounts: [],
  editing: true,
  status: 'Disconnected',
}

export function networkReducer (state = initialState, action) {
  switch (action.type) {
    case ADD_PROVIDER:
      return state
    case REMOVE_PROVIDER:
      return state
    case ADD_ACCOUNT:
      return state
    case REMOVE_ACCOUNT:
      return state
    default:
      return state
  }
}
