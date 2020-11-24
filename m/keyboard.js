import state from '/m/state.js'

function keyAction(e) {}

function downHandler(e) {
  state.km[e.key.toLowerCase()] = true
  keyAction(e.key.toLowerCase(), e)
}

function upHandler(e) {
  state.km[e.key.toLowerCase()] = false
}

export function initKeyboard() {
  window.addEventListener('keydown', downHandler)
  window.addEventListener('keyup', upHandler)
}
