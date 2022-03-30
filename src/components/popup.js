/* global Element */
var yo = require('yo-yo')
var css = require('../ui/styles/popup-styles')
var modal = require('./modal-dialog-custom')

/**
 * Open a tooltip
 * @param {string} tooltipText The text shown by the tooltip
 * @param {function} [action] Returns An HTMLElement to display for action
 */
module.exports = function showPopup (tooltipText, scopeUrl, opts) {
  let t = new Displayer()
  return t.render(tooltipText, scopeUrl, opts)
}

class Displayer {
  hide () {
    if (this.id) clearTimeout(this.id)
    if (this.tooltip.parentElement) this.tooltip.parentElement.removeChild(this.tooltip)
    animation(this.tooltip, css.animateTop.className)
  }

  /**
   * Force resolve the promise to close
   * the toaster ignoring timeout
   */
  forceResolve () {
    if (this.id) clearTimeout(this.id)
    if (this.resolveFn) this.resolveFn()
  }

  render (tooltipText, scopeUrl, opts) {
    opts = defaultOptions(opts)
    let canShorten = true
    if (tooltipText instanceof Element) {
      canShorten = false
    } else {
      if (typeof tooltipText === 'object') {
        if (tooltipText.message) {
          tooltipText = tooltipText.message
        } else {
          try {
            tooltipText = JSON.stringify(tooltipText)
          } catch (e) {
          }
        }
      }
    }

    return new Promise((resolve, reject) => {
      const shortTooltipText = (canShorten && tooltipText.length > 201) ? tooltipText.substring(0, 200) + '...' : tooltipText
      this.resolveFn = resolve

      function showFullMessage () {
        modal.alert(tooltipText)
      }

      function closePopup (self) {
        self.hide()
        // over()
        removeListeners(self)
        resolve()
      }

      function openScope (self) {
        window.open(scopeUrl, '_blank')
      }

      function addListeners(self) {
        closeButton.addEventListener('click', closePopup.bind(self, self))
        destination.addEventListener('click', openScope.bind(self, self))
      }

      function removeListeners(self) {
        closeButton.removeEventListener('click', closePopup.bind(self, self))
        destination.removeEventListener('click', openScope.bind(self, self))
      }

      let closeButton = yo`<button>Confirm</button>`
      let destination = yo`<p>View on KlaytnScope</p>`

      // <div data-shared="tooltipPopup" class="${css.tooltip} alert alert-info p-2"
      // onmouseenter=${() => { over() }} onmouseleave=${() => { out() }}
      this.tooltip = yo`
        <div data-shared="tooltipContainer" class="${css.tooltipContainer}">
          <div data-shared="tooltipPopup" class="${css.tooltip} alert alert-info p-2">
            <span class="px-2">
              ${shortTooltipText}
            </span>
            <div class="${css.container}">
                <i class="far fa-check-circle" area-hidden="true"></i>
                ${destination}
            </div>
            ${closeButton}
          </div>
        </div>`

      addListeners(this)
      document.body.appendChild(this.tooltip)
      animation(this.tooltip, css.animateBottom.className)
    })
  }
}

let defaultOptions = (opts) => {
  opts = opts || {}
  return {
    time: opts.time || 7000
  }
}

let animation = (tooltip, anim) => {
  tooltip.classList.remove(css.animateTop.className)
  tooltip.classList.remove(css.animateBottom.className)
  void tooltip.offsetWidth // trick for restarting the animation
  tooltip.classList.add(anim)
}
