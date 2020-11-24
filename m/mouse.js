import state from './state.js'
import { getWidth, getHeight, castRay } from './gl.js'
import { setXY, directedZoom } from './actions.js'

function mouseDown(e) {
  state.mouse_down = true
  state.mouse_down_position = [e.clientX, e.clientY]
  state.mouse_down_camera = state.camera.slice(0, 2)
}
function mouseUp(e) {
  state.mouse_down = false
  state.mouse_down_position = null
  state.mouse_down_camera = null
}
function mouseMove(e) {
  state.mouse_position = [e.clientX, e.clientY]
  if (state.mouse_down) {
    // pan camera
    let { $render } = state.refs
    let dx = state.mouse_position[0] - state.mouse_down_position[0]
    let dy = state.mouse_position[1] - state.mouse_down_position[1]
    let ndx = -getWidth(dx, state.camera[2])
    let ndy = -getHeight(dy, state.camera[2])
    let [ox, oy] = state.mouse_down_camera
    setXY(ox + ndx, oy + ndy)
  }
}

function mouseWheel(e) {
  let mouse_position = [e.clientX, e.clientY]
  e.preventDefault()

  let sign = e.deltaY < 0 ? -1 : 1
  let scaler = 1.125
  if (sign > 0) {
    let new_cam = state.camera[2] * scaler
    directedZoom(mouse_position, new_cam - state.camera[2])
  } else {
    let new_cam = state.camera[2] / scaler
    directedZoom(mouse_position, new_cam - state.camera[2])
  }
}

export function initMouse() {
  window.addEventListener('mousemove', mouseMove)
  window.addEventListener('mousedown', mouseDown)
  window.addEventListener('mouseup', mouseUp)
  window.addEventListener('wheel', mouseWheel, { passive: false })
}
