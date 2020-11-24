import state from './state.js'
import { castRay, getWidth, getHeight } from './gl.js'

export function setXY(x, y) {
  state.camera[0] = x
  state.camera[1] = y
  state.look_at[0] = state.camera[0]
  state.look_at[1] = state.camera[1]
}

function zoomLimit(new_zoom) {
  let max = 100
  let min = 0.1
  return Math.min(max, Math.max(min, new_zoom))
}

export function directedZoom(mouse_position, dz) {
  let zoom = state.camera[2]
  let new_zoom = zoomLimit(state.camera[2] + dz)
  if (new_zoom > zoom || new_zoom < zoom) {
    let projected = castRay(mouse_position, new_zoom)
    state.camera = [...projected, new_zoom]
    state.look_at[0] = state.camera[0]
    state.look_at[1] = state.camera[1]
    // let zoom_percent = Math.round((state.base_100 / new_width) * 100)
  }
}
