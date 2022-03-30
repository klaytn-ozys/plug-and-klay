// @flow

// Decalre global flow types.
declare var DEV: boolean
declare var API_URL: string

declare type Action = {
    type: string,
    payload?: any,
}

declare type Contract = {
    abi: object,
    address: string,
    name: string
}

declare type CompiledContract = {
    success: boolean,
    data: {},
    source: {},
    compiler: {},
    compilerFullName: string,
    file: string
}

declare type ReduxAction = (payload?: any) => Action

declare type ReduxState = {
    contract: ContractReducer
    // alert: alertReducer
}

declare type ContractReducer = {
    contracts: [],
    instances: [],
    newlyCompiled: CompiledContract,
    updatedAt: 0
}