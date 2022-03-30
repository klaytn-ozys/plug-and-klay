import {
    CLEAR_CONTRACT_INSTANCE,
    NEW_CONTRACT_COMPILED,
    NEW_CONTRACT_INSTANCE,
    REMOVE_CONTRACT_INSTANCE
} from './actionTypes'

export const newContractCompiled: ReduxAction = (payload: CompiledContract) => ({
  type: NEW_CONTRACT_COMPILED,
  payload: payload
})

export const newContractInstance: ReduxAction = (payload: {}) => ({
  type: NEW_CONTRACT_INSTANCE,
  payload
})

// export const removeContractInstance: ReduxAction = (payload: {address: string, created: double}) => ({
export const removeContractInstance: ReduxAction = (payload: { idx: number }) => ({
  type: REMOVE_CONTRACT_INSTANCE,
  payload: payload
})

export const clearContractInstance: ReduxAction = () => ({
  type: CLEAR_CONTRACT_INSTANCE
})