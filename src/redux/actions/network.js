import {ADD_ACCOUNT, ADD_PROVIDER, REMOVE_ACCOUNT, REMOVE_PROVIDER} from './actionTypes'

export const addProvider: ReduxAction = (payload: {}) => ({
  type: ADD_PROVIDER,
  payload: payload
})

export const removeProvider: ReduxAction = (payload: {}) => ({
  type: REMOVE_PROVIDER,
  payload: payload
})

export const addAccount: ReduxAction = (payload: {}) => ({
  type: ADD_ACCOUNT,
  payload: payload
})

export const removeAccount: ReduxAction = (payload: {}) => ({
  type: REMOVE_ACCOUNT,
  payload: payload
})