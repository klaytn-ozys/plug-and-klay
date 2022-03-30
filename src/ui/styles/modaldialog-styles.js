var csjs = require('csjs-inject')

var css = csjs`
  .modalHeader{
    display:flex;
  }
  .modalHeader>button{
    background: transparent;
    color: white;
    opacity: 0.7;
    border-left: transparent;
    border-top: transparent;
    border-right: transparent;
    border-bottom: transparent;
    font-size: 15px;
    padding-bottom: 8px;
    font-weight:normal;
    outline:none;
  }
   .modalHeader>button:not([selected="false"]){
    color: aqua;
    opacity: 0.7;
    font-weight:bold;
    border-bottom: 2px solid aqua;
  }
  .modalHeader>button:not(:first-child){
    margin-left: 10px;
  }
  .modalFooter {
  }
  .modalContent {
    box-shadow: 0 4px 8px 0 rgba(0,0,0,0.2),0 6px 20px 0 rgba(0,0,0,0.19);
    -webkit-animation-name: animatetop;
    -webkit-animation-duration: 0.4s;
    animation-name: animatetop;
    animation-duration: 0.4s
  }
  .modalBody {
    word-break: break-word;
    overflow-y: auto;
    max-height: 600px;
  }
  .modalFooterOk {
  }
  .modalFooterCancel {
  }
  @-webkit-keyframes animatetop {
    from {top: -300px; opacity: 0}
    to {top: 0; opacity: 1}
  }
  @keyframes animatetop {
    from {top: -300px; opacity: 0}
    to {top: 0; opacity: 1}
  }
`

module.exports = css
