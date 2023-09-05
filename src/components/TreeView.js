import React from 'react'
import EventManager from '../lib/events'

import {BN} from 'ethereumjs-util'
import {csjs} from 'csjs-inject'

var css = csjs`
  .li_tv {
    list-style-type: none;
    -webkit-margin-before: 0px;
    -webkit-margin-after: 0px;
    -webkit-margin-start: 0px;
    -webkit-margin-end: 0px;
    -webkit-padding-start: 0px;
    margin-left: 10px;
  }
  .ul_tv {
    list-style-type: none;
    -webkit-margin-before: 0px;
    -webkit-margin-after: 0px;
    -webkit-margin-start: 0px;
    -webkit-margin-end: 0px;
    -webkit-padding-start: 0px;
  }
  .caret_tv {
    width: 10px;
    flex-shrink: 0;
  }
  .label_tv {
    align-items: center;
  }
  .label_tv>span {
    word-break: break-word;
  }
`


/**
 * TreeView
 *  - extendable by specifying custom `extractData` and `formatSelf` function
 *  - trigger `nodeClick` and `leafClick`
 */
class TreeView extends React.Component {
  constructor (props) {
    super(props)

    const { formatSelf, json, key, expand } = props

    this.event = new EventManager()
    this.extractData = (item, parent, key) => {
      if (BN.isBN(item)) {
        return {
          self: item.toString(10),
          children: []
        }
      }

      return TreeView.extractDataDefault(item, parent, key)
    }

        //extractData || this.extractDataDefault
    this.formatSelf = formatSelf || this.formatSelfDefault
    this.view = null
    this.expandPath = []

    this.state = {
      json: json || {},
      key: key || '',
      expand: expand || false
    }
  }

  render() {
    let { json, key, expand } = this.props
    key = key || ''
    json = json || {}
    expand = expand || false

    return <ul ref={ ref => this.view = ref } key={key} data-id={`treeViewUl${key}`} className={css.ul_tv}>
      {
        Object.keys(json).map((innerkey) => {
          return this.renderObject(json[innerkey], json, innerkey, expand, innerkey)
        })
      }
    </ul>
  }

  update (json) {
    this.setState({
      json
    })
  }

  renderObject (item, parent, key, expand, keyPath) {
    var data = this.extractData(item, parent, key)
    var children = (data.children || []).map((child, index) => {
      return this.renderObject(child.value, data, child.key, expand, keyPath + '/' + child.key)
    })
    return this.formatData(key, data, children, expand, keyPath)
  }

  formatData = (key, data, children, expand, keyPath) => {
    const childrenExists = !!data.children
    const expanded = this.expandPath.includes(keyPath)
    const self = this

    return <li ref={ ref => this.data_li = ref } key={keyPath} data-id={`treeViewLi${keyPath}`} className={css.li_tv}>
      <div key={keyPath} data-id={`treeViewDiv${keyPath}`} className={css.label_tv} onClick={ e=> {
        if (childrenExists) {
          self.expand(keyPath)
          if (self.isExpanded(keyPath)) {
            if (!self.expandPath.includes(keyPath)) self.expandPath.push(keyPath)
          } else {
            self.expandPath = self.expandPath.filter(path => path !== keyPath)
          }
        } else {
          self.event.trigger('leafClick', [keyPath, data, e.target, e])
        }
      }}
      onContextMenu={ e => {
        if (childrenExists) {
          self.event.trigger('nodeRightClick', [keyPath, data, e.target, e])
        } else {
          self.event.trigger('leafRightClick', [keyPath, data, e.target, e])
        }
      }}
      >
        {
          childrenExists && <div data-id={`treeViewToggle${keyPath}`} className={ this.data_li ? (this.data_li.style.display === 'none' ? `fas fa-caret-right caret ${css.caret_tv}` : `fas fa-caret-down caret ${css.caret_tv}`) : `fas fa-caret-right caret ${css.caret_tv}` } />
        }
        <span>{this.formatSelf(key, data, this.data_li)}</span>
      </div>
      {
        childrenExists && (() => <ul key={keyPath} data-id={`treeViewUlList${keyPath}`} className={css.ul_tv} style={ { display: expanded ? 'block' : 'none' } } >{children}</ul>)()
      }
    </li>
  }

  isExpanded (path) {
    var current = this.nodeAt(path)
    if (current) {
      return current.style.display !== 'none'
    }
    return false
  }

  expand (path) {
    var caret = this.caretAt(path)
    var node = this.nodeAt(path)
    if (node && caret) {
      node.style.display = node.style.display === 'none' ? 'block' : 'none'
      caret.className = node.style.display === 'none' ? `fas fa-caret-right caret ${css.caret_tv}` : `fas fa-caret-down caret ${css.caret_tv}`
      this.event.trigger('nodeClick', [path, node])
    }
  }

  caretAt (path) {
    var label = this.labelAt(path)
    if (label) {
      return label.querySelector('.caret')
    }
  }

  itemAt (path) {
    return this.view.querySelector(`li[key="${path}"]`)
  }

  labelAt (path) {
    return this.view.querySelector(`div[key="${path}"]`)
  }

  nodeAt (path) {
    return this.view.querySelector(`ul[key="${path}"]`)
  }

  formatSelfDefault (key, data) {
    return <label>{key}: {data.self}</label>
  }

  static extractDataDefault (item, parent, key) {
    var ret = {}
    if (item instanceof Array) {
      ret.children = item.map((item, index) => {
        return {key: index, value: item}
      })
      ret.self = 'Array'
      ret.isNode = true
      ret.isLeaf = false
    } else if (item instanceof Object) {
      ret.children = Object.keys(item).map((key) => {
        return {key: key, value: item[key]}
      })
      ret.self = 'Object'
      ret.isNode = true
      ret.isLeaf = false
    } else {
      ret.self = item
      ret.children = null
      ret.isNode = false
      ret.isLeaf = true
    }
    return ret
  }
}

export default TreeView
