import React from 'react'
import {Dispatch} from 'redux'
import {clearContractInstance as clearAction} from '../../../redux/actions/contract'
import {connect} from 'react-redux'
import './styles/txReceiptPopup.css'

class TxReceiptPopup extends React.Component {

  constructor (props) {
    super(props)
  }

  render () {
    const { result, transactionHash, tx } = this.props

    return (
      <div className="gen-receipt-modal">
        <div className="gen-modal-cnt-wrap">
          <ul>
            { Object.entries(result).map(([key, value], idx ) => (
              <ul>{key}</ul>
            ))}
          </ul>
        </div>
      </div>
    )
  }
}



const mapStateToProps = ({ popup }: ReduxState) => ({
  ...popup.params
})


const mapDispatchToProps = (dispatch: Dispatch) => ({
  clearInstance: () => dispatch(clearAction()),
})

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(TxReceiptPopup)