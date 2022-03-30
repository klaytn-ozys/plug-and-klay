var csjs = require('csjs-inject')

var css = csjs`
  .prompt_text {
    width: 100%;
    font-size: 12px;
  }
  .prompt_pk {
    width: 100%;
    height: 60px;
    font-size: 12px;
  }
  .prompt_desc {
    font-size: 14px;
  }
`

module.exports = css
