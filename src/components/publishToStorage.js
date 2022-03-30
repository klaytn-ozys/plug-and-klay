import React from 'react'

const publishOnSwarm = require('../lib/publishOnSwarm')
const publishOnIpfs = require('../lib/publishOnIpfs')
const modalDialogCustom = require('./modal-dialog-custom')

export default function publish (props) {
  const { storage, fileProvider, fileManager, contract } = props

  if (!contract) return

  if (contract.metadata === undefined || contract.metadata.length === 0) {
    return modalDialogCustom.alert('This contract may be abstract, may not implement an abstract parent\'s methods completely or not invoke an inherited contract\'s constructor correctly.')
  }

  if (storage === 'swarm') {
    publishOnSwarm(contract, fileManager, function (err, uploaded) {
      if (err) {
        try {
          err = JSON.stringify(err)
        } catch (e) {}
        console.log(`Failed to publish metadata file to swarm, please check the Swarm gateways is available ( swarm-gateways.net ) ${err}`)
      } else {
        var result = <div>{uploaded.map((value) => {
          return <div><b>{ value.filename }</b> : <pre>{value.output.url}</pre></div>
        })}</div>
        modalDialogCustom.alert(`Published ${contract.name}'s Metadata`, <span>Metadata of `${contract.name.toLowerCase()}` was published successfully.<br/> <pre>{result}</pre> </span>)
      }
    }, (item) => { // triggered each time there's a new verified publish (means hash correspond)
      fileProvider.addExternal('swarm/' + item.hash, item.content)
    })
  } else {
    publishOnIpfs(contract, fileManager, function (err, uploaded) {
      if (err) {
        try {
          err = JSON.stringify(err)
        } catch (e) {}
        modalDialogCustom.alert(<span>{`Failed to publish metadata file to ${storage}, please check the ${storage} gateways is available.`}<br />
            ${err}</span>)
      } else {
        var result = <div>{uploaded.map((value) => {
          return <div><b>{value.filename}</b> : <pre>{value.output.url}</pre></div>
        })}</div>
        modalDialogCustom.alert(`Published ${contract.name}'s Metadata`, <span>{ `Metadata of ${contract.name.toLowerCase()} was published successfully.` }<br/> <pre>{result}</pre> </span>)
      }
    }, (item) => { // triggered each time there's a new verified publish (means hash correspond)
      fileProvider.addExternal('ipfs/' + item.hash, item.content)
    })
  }
}
