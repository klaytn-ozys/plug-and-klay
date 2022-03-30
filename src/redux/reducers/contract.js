// @flow
import {
    CLEAR_CONTRACT_INSTANCE,
    NEW_CONTRACT_COMPILED,
    NEW_CONTRACT_INSTANCE,
    REMOVE_CONTRACT_INSTANCE
} from '../actions/actionTypes'

const initializeState = {
  contracts: [],
  idx: 0,
  raws: [],
  instances: [],
  newlyCompiled: {},
  updatedAt: {
    contracts: new Date().getTime(),
    instances: new Date().getTime()
  }
}

const contractReducer = (state: ContractReducer = initializeState, action: Action) => {
  switch (action.type) {
    case NEW_CONTRACT_COMPILED:

      let newContracts = []

      if (action.payload.data.contracts) {
        Object.entries(action.payload.data.contracts).forEach(([fileName, contracts]) => {
          Object.entries(contracts).forEach(([contractName, contract]) => {
            newContracts.push({
              ...contract, name: contractName, compiler: action.payload.compiler, fileName
            })
          })
        })
      }

      return {
        ...state,
        raws: [
          action.payload
        ],
        newlyCompiled: newContracts[0] || { success: false },
        contracts: [
          ...newContracts
        ],
        updatedAt: {
          ...state.updatedAt,
          contracts: new Date().getTime()
        }
      }
    case NEW_CONTRACT_INSTANCE:
      const nextIdx = state.idx++
      return {
        ...state,
        instances: [
          ...state.instances,
          {
            ...action.payload,
            idx: nextIdx,
            created: new Date().getTime()
          }
        ],
        updatedAt: {
          ...state.updatedAt,
          instances: new Date().getTime()
        }
      }
    case REMOVE_CONTRACT_INSTANCE:
      return {
        ...state,
        instances: state.instances.filter(it => it.idx !== action.payload.idx),
        updatedAt: {
          ...state.updatedAt,
          instances: new Date().getTime()
        }
      }
    case CLEAR_CONTRACT_INSTANCE:
      return {
        ...state,
        instances: [],
        updatedAt: {
          ...state.updatedAt,
          instances: new Date().getTime()
        }
      }
    default:
      return state
  }
}

export default contractReducer