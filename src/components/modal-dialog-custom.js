var modal = require('./modaldialog.js')
var modalWithTab = require('./modaltabdialog')
var yo = require('yo-yo')
var css = require('../ui/styles/modal-dialog-custom-styles')

module.exports = {
  alert: function (title, text) {
    if (text) return modal(title, yo`<div>${text}</div>`, null, { label: null })
    return modal('', yo`<div>${title}</div>`, null, { label: null })
  },
  prompt: function (title, text, inputValue, ok, cancel, focus) {
    return prompt(title, text, false, inputValue, ok, cancel, focus)
  },
  promptPassphrase: function (title, text, inputValue, ok, cancel) {
    return prompt(title, text, true, inputValue, ok, cancel)
  },
  promptAccountImport: function (ok, cancel) {
    var text = (key) => `Please provide a ${key} to import your account`
    let privateKeyInput = yo`<div>
      <textarea id="prompt1" autocomplete="off" name='prompt_text' class="${css['prompt_pk']}" >
    </div>`
    let keystoreInput = yo`<div>
      <textarea id="prompt1" autocomplete="off" name='prompt_text' placeholder="keystore" class="${css['prompt_pk']}" >
    </div>`
    let keystorePasswordInput = yo`<div>
      <textarea id="prompt1" autocomplete="off" name='prompt_text' placeholder="password" class="${css['prompt_pk']}" >
    </div>`

    return modalWithTab(['Private Key', 'Keystore'], [yo`<div>${text('Private Key')}<div>${privateKeyInput}</div></div>`, yo`<div>${text('Keystore')}<div>${keystoreInput}</div><div>${keystorePasswordInput}</div></div>`],
        {
          fn: (tab) => {
            if (typeof ok === 'function') {
              let input = tab === 0 ? privateKeyInput : keystoreInput

              if (tab === 0) {
                if (input.querySelector('#prompt1').value) {
                  ok(null, input.querySelector('#prompt1').value.trim())
                } else {
                  ok('Private Key must not be null.')
                }
              } else {
                if (input.querySelector('#prompt1').value) {
                  ok(null, input.querySelector('#prompt1').value.trim(), keystorePasswordInput.querySelector('#prompt1').value.trim())
                } else {
                  ok('Private Key must not be null.')
                }
              }
            }
          }
        },
        {
          fn: () => {
            if (typeof cancel === 'function') cancel()
          }
        }
    )
  },
  promptFeePayerImport: function (ok, cancel) {
    var text = 'Please provide a Private key to import a fee payer account.'
    var inputPrivateKey = yo`<div>
    <span class="${css.prompt_desc}">Private Key</span>
      <textarea id="prompt1" autocomplete="off" name='prompt_text' class="${css['prompt_pk']}" >
    </div>`
    var inputAddress = yo`<div>
        <span class="${css.prompt_desc}">Address(optional)</span>
      <textarea id="prompt1" autocomplete="off" name='prompt_text' placeholder="address" class="${css['prompt_text']}" >
    </div>`
    return modal(null, yo`<div>${text}<div>${inputPrivateKey}</div><div>${inputAddress}</div></div>`,
        {
          fn: () => {
            if (typeof ok === 'function') {
              if (inputPrivateKey.querySelector('#prompt1').value) {
                ok(null, inputPrivateKey.querySelector('#prompt1').value.trim(), inputAddress.querySelector('#prompt1').value.trim())
              } else {
                ok('Private Key must not be null.')
              }
            }
          }
        },
        {
          fn: () => {
            if (typeof cancel === 'function') cancel()
          }
        }
    )
  },
  promptPrivateKeyCreation: function (ok, cancel) {
    var text = 'Please provide a Private key to import your account'
    var input = yo`<div>
      <textarea id="prompt1" autocomplete="off" name='prompt_text' class="${css['prompt_pk']}" >
    </div>`
    return modal(null, yo`<div>${text}<div>${input}</div></div>`,
        {
          fn: () => {
            if (typeof ok === 'function') {
              if (input.querySelector('#prompt1').value) {
                ok(null, input.querySelector('#prompt1').value.trim())
              } else {
                ok('Private Key must not be null.')
              }
            }
          }
        },
        {
          fn: () => {
            if (typeof cancel === 'function') cancel()
          }
        }
    )
  },
  promptPassphraseCreation: function (ok, cancel) {
    var text = 'Please provide a Passphrase for the account creation'
    var input = yo`<div>
      <input id="prompt1" type="password" name='prompt_text' class="${css['prompt_text']}" >
      <br>
      <br>
      <input id="prompt2" type="password" name='prompt_text' class="${css['prompt_text']}" >
    </div>`
    return modal(null, yo`<div>${text}<div>${input}</div></div>`,
      {
        fn: () => {
          if (typeof ok === 'function') {
            if (input.querySelector('#prompt1').value === input.querySelector('#prompt2').value) {
              ok(null, input.querySelector('#prompt1').value)
            } else {
              ok('Passphase does not match')
            }
          }
        }
      },
      {
        fn: () => {
          if (typeof cancel === 'function') cancel()
        }
      }
    )
  },
  promptMulti: function ({ title, text, inputValue }, ok, cancel) {
    if (!inputValue) inputValue = ''
    var input = yo`<textarea id="prompt_text" data-id="modalDialogCustomPromptText" class=${css.prompt_text} rows="4" cols="50"></textarea>`
    return modal(title, yo`<div>${text}<div>${input}</div></div>`,
      {
        fn: () => { if (typeof ok === 'function') ok(document.getElementById('prompt_text').value) }
      },
      {
        fn: () => { if (typeof cancel === 'function') cancel() }
      }
    )
  },
  confirm: function (title, text, ok, cancel) {
    return modal(title, yo`<div>${text}</div>`,
      {
        fn: () => { if (typeof ok === 'function') ok() }
      },
      {
        fn: () => { if (typeof cancel === 'function') cancel() }
      }
    )
  }
}

function prompt (title, text, hidden, inputValue, ok, cancel, focus) {
  if (!inputValue) inputValue = ''
  var type = hidden ? 'password' : 'text'
  var input = yo`<input type=${type} name='prompt_text' id='prompt_text' class="${css['prompt_text']} form-control" value='${inputValue}' data-id="modalDialogCustomPromptText">`
  modal(title, yo`<div>${text}<div>${input}</div></div>`,
    {
      fn: () => { if (typeof ok === 'function') ok(document.getElementById('prompt_text').value) }
    },
    {
      fn: () => { if (typeof cancel === 'function') cancel() }
    },
    focus ? '#prompt_text' : undefined
  )
}
