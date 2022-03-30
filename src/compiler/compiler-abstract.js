var remixLib = require('remix-lib')
var txHelper = remixLib.execution.txHelper

export default class CompilerAbstract {
  constructor (data, source) {
    this.data = data
    this.source = source // source code
  }

  getContracts () {
    return this.data.contracts
  }

  getContract (name) {
    return txHelper.getContract(name, this.data.contracts)
  }

  visitContracts (callback) {
    return txHelper.visitContracts(this.data.contracts, callback)
  }

  getData () {
    return this.data
  }

  getAsts () {
    return this.data.sources // ast
  }

  getSourceName (fileIndex) {
    if (this.data && this.data.sources) {
      return Object.keys(this.data.sources)[fileIndex]
    }
    return null
  }

  getSourceCode () {
    return this.source
  }
}
