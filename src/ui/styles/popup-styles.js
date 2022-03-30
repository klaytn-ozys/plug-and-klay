var csjs = require('csjs-inject')

var css = csjs`
  .tooltipContainer {
    position: fixed;
    top: 0;
    height: 100%;
    width: 100%;
    align-items: center;
    z-index: 1001;
    display: flex;
    background: rgba(34, 34, 34, 0.2);
  }
  .tooltip {
    display: flex;
    flex-direction: column;
    padding: 0 !important;
    padding-top: 16px !important;
    justify-content: space-between;
    align-items: center;
    min-height: 220px;
    padding: 16px 24px 12px;
    border-radius: 3px;
    width: 80%;
    left: 10%;
    font-size: 14px;
    text-align: center;
  }    
    
  .container{
 
  }
     .container > i{
      font-size: 50px;
      margin-bottom: 16px;
    }
    .container > p{
      font-size: 12px;
      text-decoration: underline;
      cursor: pointer;
    }
  .tooltip > span{
    overflow-wrap: anywhere;
    margin-bottom: 16px;
    color: white;
    font-weight: bold;
  }
  .tooltip > button{
    width: 100%;
    height: 50px;
    color: white;
    opacity: 0.5;
    background: transparent;
    border-top: 1px solid rgba(255, 255, 255, .4);
    border-left: transparent;
    border-right: transparent;
    border-bottom: transparent;
  }
  @-webkit-keyframes animatebottom  {
    0% {bottom: -300px}
    100% {bottom: 0}
  }
  @keyframes animatebottom  {
    0% {bottom: -300px}
    100% {bottom: 0}
  }
  @-webkit-keyframes animatetop  {
    0% {bottom: 0}
    100% {bottom: -300px}
  }
  @keyframes animatetop  {
    0% {bottom: 0}
    100% {bottom: -300px}
  }
  .animateTop {
    -webkit-animation-name: animatetop;
    -webkit-animation-duration: 2s;
    animation-name: animatetop;
    animation-duration: 2s;
  }
  .animateBottom {
    -webkit-animation-name: animatebottom;
    -webkit-animation-duration: 2s;
    animation-name: animatebottom;
    animation-duration: 2s;    
  }
`

module.exports = css
