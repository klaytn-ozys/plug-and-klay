var yo = require('yo-yo')
var css = require('../ui/styles/modaldialog-styles')

let incomingModal = false // in case modals are queued, ensure we are not hiding the last one.
module.exports = (titles, contents, ok, cancel, focusSelector, opts) => {
  let agreed = true
  let footerIsActive = false
  opts = opts || {}
  var container = document.querySelector(`.modal`)
  if (!container) {
    document.querySelector('body').appendChild(html(opts))
    container = document.querySelector(`.modal`)
    incomingModal = false
  } else incomingModal = true

  var closeDiv = document.getElementById('modal-close')
  if (opts.hideClose) closeDiv.style.display = 'none'

  document.getElementById('close-span').style.marginLeft = 'auto'

  var okDiv = document.getElementById('modal-footer-ok')
  okDiv.innerHTML = (ok && ok.label !== undefined) ? ok.label : 'OK'
  okDiv.style.display = okDiv.innerHTML === '' ? 'none' : 'inline-block'

  var cancelDiv = document.getElementById('modal-footer-cancel')
  cancelDiv.innerHTML = (cancel && cancel.label !== undefined) ? cancel.label : 'Cancel'
  cancelDiv.style.display = cancelDiv.innerHTML === '' ? 'none' : 'inline-block'

  var modal = document.querySelector(`.modal-body`)
  var headerArea = document.querySelector('.modal-header')

  titles.forEach((title, idx) => {
    const btn = yo`<button data-id=tab${idx} idx=${idx}>${title}</button>`
    btn.setAttribute('selected', idx === 0 ? 'true' : 'false')
    headerArea.insertBefore(btn, document.getElementById('close-span'))
  })
  
  modal.innerHTML = ''
  modal.appendChild(contents[0])

  setFocusOn('ok')

  show()

  function setFocusOn (btn) {
    var okDiv = document.getElementById('modal-footer-ok')
    var cancelDiv = document.getElementById('modal-footer-cancel')
    if (btn === 'ok') {
      okDiv.className = okDiv.className.replace(/\bbtn-light\b/g, 'btn-dark')
      cancelDiv.className = cancelDiv.className.replace(/\bbtn-dark\b/g, 'btn-light')
    } else {
      cancelDiv.className = cancelDiv.className.replace(/\bbtn-light\b/g, 'btn-dark')
      okDiv.className = okDiv.className.replace(/\bbtn-dark\b/g, 'btn-light')
    }
  }

  function okListener () {
    removeEventListener()
    if (ok && ok.fn && agreed) ok.fn(Number(headerArea.querySelector('button:not([selected="false"])').getAttribute("idx")))
    if (!incomingModal) hide()
    incomingModal = false
  }

  function cancelListener () {
    removeEventListener()
    if (cancel && cancel.fn) cancel.fn()
    if (!incomingModal) hide()
    incomingModal = false
  }

  function tabListener (e) {
    var idx = Number(e.target.getAttribute('idx') || '0')

    if (e.target.getAttribute('selected') === "true") {
      return
    }

    modal.innerHTML = ''
    modal.appendChild(contents[idx])

    headerArea.querySelectorAll('button').forEach((btn, index) => {
      const selected = idx === index
      btn.setAttribute('selected', selected)

      btn.className = selected ? 'selected' : ''
    })
  }

  function modalKeyEvent (e) {
    if (e.keyCode === 27) { // Esc
      cancelListener()
    } else if (e.keyCode === 13) { // Enter
      e.preventDefault()
      okListener()
    } else if (e.keyCode === 37 && footerIsActive) { // Arrow Left
      e.preventDefault()
      agreed = true
      setFocusOn('ok')
    } else if (e.keyCode === 39 && footerIsActive) { // Arrow Right
      e.preventDefault()
      agreed = false
      setFocusOn('cancel')
    }
  }

  function hide () {
    if (!container) return
    container.style.display = 'none'
    if (container.parentElement) container.parentElement.removeChild(container)
    container = null
    incomingModal = false
  }

  function show () {
    if (!container) return
    container.style.display = 'block'
    if (focusSelector) {
      const focusTarget = document.querySelector(`.modal ${focusSelector}`)
      if (focusTarget) {
        focusTarget.focus()
        if (typeof focusTarget.setSelectionRange === 'function') {
          focusTarget.setSelectionRange(0, focusTarget.value.length)
        }
      }
    }
  }

  function removeEventListener () {
    okDiv.removeEventListener('click', okListener)
    cancelDiv.removeEventListener('click', cancelListener)
    closeDiv.removeEventListener('click', cancelListener)
    document.removeEventListener('keydown', modalKeyEvent)

    headerArea && (headerArea.querySelectorAll('button') || []).forEach(btn => btn.removeEventListener('click', tabListener))
    if (document.getElementById('modal-background')) {
      document.getElementById('modal-background').removeEventListener('click', cancelListener)
    }
  }
  okDiv.addEventListener('click', okListener)
  cancelDiv.addEventListener('click', cancelListener)
  closeDiv.addEventListener('click', cancelListener)
  document.addEventListener('keydown', modalKeyEvent)

  headerArea && (headerArea.querySelectorAll('button')).forEach(btn => btn.addEventListener('click', tabListener))
  let modalDialog = document.getElementById('modal-dialog')
  if (modalDialog) {
    modalDialog.addEventListener('click', (e) => {
      footerIsActive = document.activeElement === modalDialog
      if (e.toElement === modalDialog) {
        cancelListener() // click is outside of modal-content
      }
    })
  }
  return { container, okListener, cancelListener, hide }
}

function html (opts) {
  return yo`
  <div id="modal-dialog" data-id="modalDialogContainer" class="modal" tabindex="-1" role="dialog">
    <div id="modal-background" class="modal-dialog" role="document">
      <div class="modal-content ${css.modalContent} ${opts.class}">
        <div class="modal-header ${css.modalHeader}">
          <span class="modal-close" id="close-span">
            <i id="modal-close" title="Close" class="fas fa-times" aria-hidden="true"></i>
          </span>
        </div>
        <div class="modal-body ${css.modalBody}" data-id="modalDialogModalBody"> - </div>
        <div class="modal-footer" data-id="modalDialogModalFooter" autofocus>
          <span id="modal-footer-ok" class="${css['modalFooterOk']} modal-ok btn btn-sm btn-light" tabindex='5'>OK</span>
          <span id="modal-footer-cancel" class="${css['modalFooterCancel']} modal-cancel btn btn-sm btn-light" tabindex='10' data-dismiss="modal">Cancel</span>
        </div>
      </div>
    </div>
  </div>`
}
