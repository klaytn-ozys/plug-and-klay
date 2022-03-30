'use strict'
import {Plugin} from '@remixproject/engine'
import * as packageJson from '../../package.json'

var CompilerAbstract = require('./compiler-abstract')

const profile = {
  name: 'compilerMetadata',
  methods: ['deployMetadataOf'],
  events: [],
  version: packageJson.version
}

class CompilerMetadata extends Plugin {
  constructor (blockchain, config) {
    super(profile)
    this.blockchain = blockchain
    this.config = config
    this.networks = ['Cypress:8217', 'Baobab:1001', 'Custom']
    this.innerPath = 'artifacts'
  }

  _JSONFileName (path, contractName) {
    return path + '/' + this.innerPath + '/' + contractName + '.json'
  }

  onActivation () {
    var self = this
    global.client.solidity.on('compilationFinished', (file, source, languageVersion, data) => {
      // if (!self.config.get('settings/generate-contract-metadata')) return
      let compiler = new CompilerAbstract(languageVersion, data, source)

      compiler.visitContracts((contract) => {
        if (contract.file !== source.target) return

        const path = global.client.fileManager.getCurrentFile()
        var fileName = self._JSONFileName(path, contract.name)
        global.client.fileManager.getFile(fileName, (error, content) => {
          if (!error) {
            content = content || '{}'
            var metadata
            try {
              metadata = JSON.parse(content)
            } catch (e) {
              console.log(e)
            }

            var deploy = metadata.deploy || {}
            self.networks.forEach((network) => {
              deploy[network] = self._syncContext(contract, deploy[network] || {})
            })

            var data = {
              deploy,
              data: {
                bytecode: contract.object.evm.bytecode,
                deployedBytecode: contract.object.evm.deployedBytecode,
                gasEstimates: contract.object.evm.gasEstimates,
                methodIdentifiers: contract.object.evm.methodIdentifiers
              },
              abi: contract.object.abi
            }

            // provider.set(fileName, JSON.stringify(data, null, '\t'))
          }
        })
      })
    })
  }

  _syncContext (contract, metadata) {
    var linkReferences = metadata['linkReferences']
    var autoDeployLib = metadata['autoDeployLib']
    if (!linkReferences) linkReferences = {}
    if (autoDeployLib === undefined) autoDeployLib = true

    for (var libFile in contract.object.evm.bytecode.linkReferences) {
      if (!linkReferences[libFile]) linkReferences[libFile] = {}
      for (var lib in contract.object.evm.bytecode.linkReferences[libFile]) {
        if (!linkReferences[libFile][lib]) {
          linkReferences[libFile][lib] = '<address>'
        }
      }
    }
    metadata['linkReferences'] = linkReferences
    metadata['autoDeployLib'] = autoDeployLib
    return metadata
  }

  // TODO: is only called by dropdownLogic and can be moved there

}

export default CompilerMetadata