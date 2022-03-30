class registry {
  constructor () {
    this.state = {}
  }
  put ({ api, name }) {
    if (this.state[name]) return this.state[name]
    const server = {
      api
    }
    this.state[name] = { server }
    return server
  }
  get (name) {
    const state = this.state[name]
    if (!state) return
    const server = state.server
    return server
  }
}

export default registry;