import state from './state.js'
import { initGL } from './gl.js'
import { initKeyboard } from './keyboard.js'
import { initMouse } from './mouse.js'

window.addEventListener('load', () => {
  state.refs.$render = document.querySelector('#render')

  fetch('daily_forecast.json')
    .then((r) => r.json())
    .then((data) => {
      state.data = Object.values(data).map((t) => {
        let points = []
        let index = 0
        for (let [key, value] of Object.entries(t)) {
          let pair = [index, value / 100000]
          points.push(pair)
          index++
        }
        return points
      })
      initGL()
      initKeyboard()
      initMouse()
    })
})
