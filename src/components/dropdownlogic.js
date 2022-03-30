import CompilerAbstract from '../compiler/compiler-abstract'
import store from '../redux/store'
import {NEW_CONTRACT_COMPILED} from '../redux/actions/actionTypes'

var ethJSUtil = require('ethereumjs-util')
var remixLib = require('remix-lib')
var txHelper = remixLib.execution.txHelper
var EventManager = remixLib.EventManager

class DropdownLogic {
  constructor (compilersArtefacts, config, editor, runView) {
    this.config = config
    this.editor = editor
    this.runView = runView

    this.event = new EventManager()

    this.listenToCompilationEvents()
  }

  // TODO: can be moved up; the event in contractDropdown will have to refactored a method instead
  listenToCompilationEvents () {
    let broadcastCompilationResult = (file, source, languageVersion, data) => {
      // TODO check whether the tabs is configured=
      let compiler = new CompilerAbstract(data, source)
      global.artefacts.compilersArtefacts[languageVersion] = compiler
      global.artefacts.compilersArtefacts['__last'] = compiler

      setTimeout(() => {
        store.dispatch({
          type: NEW_CONTRACT_COMPILED,
          payload: {
            success: true,
            data,
            source,
            compiler,
            compilerFullName: languageVersion,
            file
          }
        })
      })
    }

   
   
    global.client.solidity.on('compilationFinished', (file, source, languageVersion, data) =>
      broadcastCompilationResult(file, source, languageVersion, data)
    )
  }

  async loadContractFromAddress (address, confirmCb, cb) {
    if (!address.startsWith('0x') || !ethJSUtil.isValidAddress(address)) {
      return cb('Invalid address.')
    }
    if (/[a-f]/.test(address) && /[A-F]/.test(address) && !ethJSUtil.isValidChecksumAddress(address)) {
      return cb('Invalid checksum address.')
    }

    const currentFile = await global.client.fileManager.getCurrentFile()

    if (/.(.abi)$/.exec(currentFile)) {
      confirmCb(async () => {
        var abi = await global.client.fileManager.getFile(currentFile)
        try {
          abi = JSON.parse(abi)
        } catch (e) {
          return cb('Failed to parse the current file as JSON ABI.')
        }
        cb(null, 'abi', abi)
      })
    } else {
      cb(null, 'instance')
    }
  }

  deployMetadataOf (blockchain, contractName) {
    return new Promise((resolve, reject) => {
      blockchain.detectNetwork( async (err, { id, name } = {}) => {
        if (err) {
          reject(err)
        } else {
          try {
            var path = await global.client.fileManager.getCurrentFile()
            
            var fileName = path + '/artifacts/' + contractName + '.json'
            
            const content = await global.client.fileManager.getFile(path)

            if (!content) return resolve()

            try {
              var metadata = JSON.parse(content)
              metadata = metadata.deploy || {}
              return resolve(metadata[name + ':' + id] || metadata[name] || metadata[id] || metadata[name.toLowerCase() + ':' + id] || metadata[name.toLowerCase()])
            } catch (e) {
              reject(e.message)
            }
          } catch (e) {
            return reject(e)
          }
        }
      })
    })
  }

  getCompiledContracts (compiler, compilerFullName) {
    var contracts = []
    compiler.visitContracts((contract) => {
      contracts.push(contract)
    })
    return contracts
  }

  getSelectedContract (contractName, compiler) {
    if (!contractName) return null
    
    if (!compiler) return null

    var contract = compiler.getContract(contractName)

    return {
      name: contractName,
      contract: contract,
      compiler: compiler,
      abi: contract.object.abi,
      bytecodeObject: contract.object.evm.bytecode.object,
      bytecodeLinkReferences: contract.object.evm.bytecode.linkReferences,
      object: contract.object,
      deployedBytecode: contract.object.evm.deployedBytecode,
      getConstructorInterface: () => {
        return txHelper.getConstructorInterface(contract.object.abi)
      },
      getConstructorInputs: () => {
        var constructorInteface = txHelper.getConstructorInterface(contract.object.abi)
        return txHelper.inputParametersDeclarationToString(constructorInteface.inputs)
      },
      isOverSizeLimit: () => {
        var deployedBytecode = contract.object.evm.deployedBytecode
        return (deployedBytecode && deployedBytecode.object.length / 2 > 24576)
      },
      metadata: contract.object.metadata
    }
  }

  getCompilerContracts () {
    return global.artefacts.compilersArtefacts['__last'].getData().contracts
  }

}

export default DropdownLogic