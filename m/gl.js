import state from './state.js'
import {
  perspective,
  lookAt,
  multiply,
  invert,
  multiplyPoint,
  transformPoint,
  normalize,
} from './mat4.js'

function numberWithCommas(x) {
  return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

export function initGL() {
  let { data } = state
  let { $render } = state.refs

  $render.width = window.innerWidth
  $render.height = window.innerHeight

  let regl = createREGL({
    canvas: $render,
    extensions: ['ANGLE_instanced_arrays'],
  })

  state.projection = perspective(
    [],
    Math.PI / 3,
    $render.width / $render.height,
    0.01,
    100
  )
  invert(state.inverse_projection, state.projection)

  lookAt(state.view, state.camera, state.look_at, [0, 1, 0])
  multiply(state.view_projection, state.projection, state.view)
  invert(state.inverse_view_projection, state.view_projection)

  // instanced lines from https://wwwtyro.net/2019/11/18/instanced-lines.html
  function roundCapJoinGeometry(regl, resolution) {
    const instanceRoundRound = [
      [0, -0.5, 0],
      [0, -0.5, 1],
      [0, 0.5, 1],
      [0, -0.5, 0],
      [0, 0.5, 1],
      [0, 0.5, 0],
    ]
    // for (let step = 0; step < resolution; step++) {
    //   const theta0 = Math.PI / 2 + ((step + 0) * Math.PI) / resolution
    //   const theta1 = Math.PI / 2 + ((step + 1) * Math.PI) / resolution
    //   instanceRoundRound.push([0, 0, 0])
    //   instanceRoundRound.push([
    //     0.5 * Math.cos(theta0),
    //     0.5 * Math.sin(theta0),
    //     0,
    //   ])
    //   instanceRoundRound.push([
    //     0.5 * Math.cos(theta1),
    //     0.5 * Math.sin(theta1),
    //     0,
    //   ])
    // }
    // for (let step = 0; step < resolution; step++) {
    //   const theta0 = (3 * Math.PI) / 2 + ((step + 0) * Math.PI) / resolution
    //   const theta1 = (3 * Math.PI) / 2 + ((step + 1) * Math.PI) / resolution
    //   instanceRoundRound.push([0, 0, 1])
    //   instanceRoundRound.push([
    //     0.5 * Math.cos(theta0),
    //     0.5 * Math.sin(theta0),
    //     1,
    //   ])
    //   instanceRoundRound.push([
    //     0.5 * Math.cos(theta1),
    //     0.5 * Math.sin(theta1),
    //     1,
    //   ])
    // }
    return {
      buffer: regl.buffer(instanceRoundRound),
      count: instanceRoundRound.length,
    }
  }
  let roundCapJoin = roundCapJoinGeometry(regl, 16)
  let interleavedStripRoundCapJoin = regl({
    frag: `
      precision mediump float;
      uniform vec4 color;
      void main () {
        gl_FragColor = color;
      }`,
    vert: `
      precision highp float;
      attribute vec3 position;
      attribute vec2 pointA, pointB;
      uniform float thickness;
      uniform mat4 view_projection;
      void main() {
        vec2 xBasis = normalize(pointB - pointA);
        vec2 yBasis = vec2(-xBasis.y, xBasis.x);
        vec2 offsetA = pointA + thickness * (position.x * xBasis + position.y * yBasis);
        vec2 offsetB = pointB + thickness * (position.x * xBasis + position.y * yBasis);
        vec2 point = mix(offsetA, offsetB, position.z);
        gl_Position = view_projection * vec4(point, 0, 1);
      }`,
    attributes: {
      position: {
        buffer: roundCapJoin.buffer,
        divisor: 0,
      },
      pointA: {
        buffer: regl.prop('points'),
        divisor: 1,
        offset: Float32Array.BYTES_PER_ELEMENT * 0,
      },
      pointB: {
        buffer: regl.prop('points'),
        divisor: 1,
        offset: Float32Array.BYTES_PER_ELEMENT * 2,
      },
    },
    uniforms: {
      color: regl.prop('color'),
      thickness: regl.prop('thickness'),
      view_projection: regl.prop('view_projection'),
    },
    count: roundCapJoin.count,
    instances: regl.prop('segments'),
  })

  function xTickGeometry(regl, resolution) {
    let x0 = -1
    let x1 = 1
    let y0 = -1
    let y1 = 1
    let vertices = [
      [x0, y1],
      [x1, y1],
      [x0, y0],
      [x0, y0],
      [x1, y1],
      [x1, y0],
    ]
    return {
      buffer: regl.buffer(vertices),
      count: vertices.length,
    }
  }
  let xTickPositions = xTickGeometry(regl)
  let xTicks = regl({
    frag: `
      precision mediump float;
      uniform vec4 color;
      void main () {
        gl_FragColor = color;
      }`,
    vert: `
      precision highp float;
      attribute vec2 position;
      attribute float offset;
      uniform mat4 view_projection;
      uniform float y_pin;
      uniform float scale;
      void main() {
        gl_Position = view_projection * vec4(position.x * scale * 0.1 + offset, position.y * scale + y_pin, 0, 1);
      }`,
    attributes: {
      position: {
        buffer: xTickPositions.buffer,
        divisor: 0,
      },
      offset: {
        buffer: regl.prop('offsets'),
        divisor: 1,
        offset: Float32Array.BYTES_PER_ELEMENT * 0,
      },
    },
    uniforms: {
      color: [1, 0, 0, 1],
      view_projection: regl.prop('view_projection'),
      y_pin: regl.prop('y_pin'),
      scale: regl.prop('scale'),
    },
    count: xTickPositions.count,
    instances: regl.prop('segments'),
  })
  let xGraph = regl({
    frag: `
      precision mediump float;
      uniform vec4 color;
      void main () {
        gl_FragColor = color;
      }`,
    vert: `
      precision highp float;
      attribute vec2 position;
      attribute float offset;
      uniform mat4 view_projection;
      uniform float y_pin;
      uniform float scale;
      uniform float span;
      void main() {
        gl_Position = view_projection * vec4(position.x * scale * 0.02 + offset, position.y * span + y_pin, 0, 1);
      }`,
    attributes: {
      position: {
        buffer: xTickPositions.buffer,
        divisor: 0,
      },
      offset: {
        buffer: regl.prop('offsets'),
        divisor: 1,
        offset: Float32Array.BYTES_PER_ELEMENT * 0,
      },
    },
    uniforms: {
      color: [0.2, 0.2, 0.2, 1],
      view_projection: regl.prop('view_projection'),
      y_pin: regl.prop('y_pin'),
      scale: regl.prop('scale'),
      span: regl.prop('span'),
    },
    count: xTickPositions.count,
    instances: regl.prop('segments'),
  })

  function yTickGeometry(regl, resolution) {
    let x0 = -1
    let x1 = 1
    let y0 = -1
    let y1 = 1
    let vertices = [
      [x0, y0],
      [x1, y0],
      [x0, y1],
      [x0, y1],
      [x1, y0],
      [x1, y1],
    ]
    return {
      buffer: regl.buffer(vertices),
      count: vertices.length,
    }
  }
  let yTickPositions = yTickGeometry(regl)
  let yGraph = regl({
    frag: `
      precision mediump float;
      uniform vec4 color;
      void main () {
        gl_FragColor = color;
      }`,
    vert: `
      precision highp float;
      attribute vec2 position;
      attribute float offset;
      uniform float span;
      uniform mat4 view_projection;
      uniform float x_pin;
      uniform float scale;
      void main() {
        gl_Position = view_projection * vec4(position.x * span + x_pin, position.y * scale * 0.02 + offset, 0, 1);
      }`,
    attributes: {
      position: {
        buffer: yTickPositions.buffer,
        divisor: 0,
      },
      offset: {
        buffer: regl.prop('offsets'),
        divisor: 1,
        offset: Float32Array.BYTES_PER_ELEMENT * 0,
      },
    },
    uniforms: {
      color: [0.2, 0.2, 0.2, 1],
      view_projection: regl.prop('view_projection'),
      view_projection: regl.prop('view_projection'),
      x_pin: regl.prop('x_pin'),
      scale: regl.prop('scale'),
      span: regl.prop('span'),
    },
    count: yTickPositions.count,
    instances: regl.prop('segments'),
  })

  // let drawTriangle = regl({
  //   frag: `
  //     precision mediump float;
  //     uniform vec4 color;
  //     void main () {
  //       gl_FragColor = color;
  //     }`,
  //   vert: `
  //     precision mediump float;
  //     attribute vec2 position;
  //     uniform vec2 translate;
  //     uniform mat4 view_projection;
  //     void main () {
  //       gl_Position = view_projection * vec4(position + translate, 0, 1);
  //     }`,
  //   attributes: {
  //     position: [
  //       [0, 1],
  //       [0, -1],
  //       [-1, 0],
  //     ],
  //   },
  //   uniforms: {
  //     color: [1, 1, 0, 1],
  //     translate: regl.prop('translate'),
  //     view_projection: regl.prop('view_projection'),
  //   },
  //   count: 3,
  // })

  let points = []
  {
    let first = data[0]
    let index = 0
    for (let [key, value] of Object.entries(first)) {
      let pair = [index, value / 100000]
      points.push(pair)
      index++
    }
  }

  let points_buffers = []
  let colors = []
  for (let series of data) {
    let points_buffer = regl.buffer(series)
    points_buffers.push(points_buffer)
    colors.push([Math.random(), Math.random(), Math.random(), 1])
  }

  let x_tick_marks = [...Array(points.length)].map((_, i) => i)
  let x_tick_buffer = regl.buffer(x_tick_marks)

  let y_tick_marks = [...Array(10 * 2 + 1)].map((_, i) => i / 2)
  let y_tick_buffer = regl.buffer(y_tick_marks)

  let y_labels = y_tick_marks.map((v) => numberWithCommas(v * 100000))
  let y_label_text_length = y_labels[y_labels.length - 1].length
  let y_label_canvas = document.createElement('canvas')
  {
    y_label_canvas.width = y_label_text_length * 8
    y_label_canvas.height = y_labels.length * 16
    // y_label_canvas.height = 200
    let cx = y_label_canvas.getContext('2d')
    cx.font = '13.333px JetBrains Mono'
    cx.textBaseline = 'middle'
    cx.fillStyle = 'white'

    cx.fillStyle = '#333'
    cx.fillRect(0, 0, y_label_canvas.width, y_label_canvas.height)
    cx.fillStyle = 'white'
    for (let i = 0; i < y_labels.length; i++) {
      let label = y_labels[i]
      cx.fillText(label, 0, i * 16 + 8 + 1)
    }

    // cx.fillStyle = 'pink'
    // cx.fillRect(0, 0, y_label_canvas.width, y_label_canvas.height)
    // cx.fillStyle = 'green'
    // cx.fillRect(0, 0, y_label_canvas.width / 2, y_label_canvas.height / 2)
    // cx.fillStyle = 'orange'
    // cx.fillRect(0, 0, y_label_canvas.width / 4, y_label_canvas.height)
    // cx.fillStyle = 'red'
    // cx.fillRect(
    //   (y_label_canvas.width * 3) / 4,
    //   0,
    //   y_label_canvas.width / 4,
    //   y_label_canvas.height
    // )

    // y_label_canvas.style.position = 'fixed'
    // y_label_canvas.style.left = 0
    // y_label_canvas.style.top = 0
    // document.body.appendChild(y_label_canvas)
  }

  let y_tick_texture_line = 16 / y_label_canvas.height

  let y_texture_offsets = regl.buffer(
    y_tick_marks.map((_, i) => y_tick_texture_line * i)
  )

  // need to add texture coordinates
  let yTicks = regl({
    frag: `
      precision mediump float;
      varying vec2 vUv;
      uniform sampler2D tex;
      void main () {
        gl_FragColor = texture2D(tex,vUv);
      }`,
    vert: `
      precision highp float;
      attribute vec2 position;
      attribute float offset;
      attribute float texture_offset;
      attribute vec2 uv;
      varying vec2 vUv;
      uniform mat4 view_projection;
      uniform float x_pin;
      uniform vec2 scale;
      void main() {
        vUv = vec2(uv.x, uv.y + texture_offset);
        gl_Position = view_projection * vec4(position.x * scale.x + x_pin, position.y * scale.y + offset, 0, 1);
      }`,
    attributes: {
      position: {
        buffer: yTickPositions.buffer,
        divisor: 0,
      },
      uv: {
        buffer: regl.buffer([
          [-1, y_tick_texture_line],
          [1, y_tick_texture_line],
          [-1, 0],
          [-1, 0],
          [1, y_tick_texture_line],
          [1, 0],
        ]),
        divisor: 0,
      },
      offset: {
        buffer: regl.prop('offsets'),
        divisor: 1,
        offset: Float32Array.BYTES_PER_ELEMENT * 0,
      },
      texture_offset: {
        buffer: regl.prop('texture_offsets'),
        divisor: 1,
        offset: Float32Array.BYTES_PER_ELEMENT * 0,
      },
    },
    uniforms: {
      view_projection: regl.prop('view_projection'),
      x_pin: regl.prop('x_pin'),
      scale: regl.prop('scale'),
      tex: regl.texture(y_label_canvas),
    },
    count: yTickPositions.count,
    instances: regl.prop('segments'),
  })

  regl.frame(() => {
    regl.clear({
      color: [0.1, 0.1, 0.1, 1],
      depth: 1,
    })
    lookAt(state.view, state.camera, state.look_at, [0, 1, 0])
    multiply(state.view_projection, state.projection, state.view)
    invert(state.inverse_view_projection, state.view_projection)

    let zero_project = castRay([0, 0], 0)
    let tick_project = castRay([$render.width, $render.height], 0)
    xTicks({
      offsets: x_tick_buffer,
      view_projection: state.view_projection,
      scale: 1 / (state.base_zoom / state.camera[2]),
      y_pin: tick_project[1],
      segments: points.length - 1,
    })

    let x_project = castRay([0, 0], 0)
    yTicks({
      offsets: x_tick_buffer,
      texture_offsets: y_texture_offsets,
      view_projection: state.view_projection,
      scale: [
        getWidth(y_label_canvas.width, state.base_zoom) /
          (state.base_zoom / state.camera[2]),
        -getHeight(8, state.base_zoom) / (state.base_zoom / state.camera[2]),
      ],
      x_pin: zero_project[0],
      segments: y_tick_marks.length,
    })

    let i = 0
    for (let buffer of points_buffers) {
      interleavedStripRoundCapJoin({
        points: buffer,
        thickness:
          20 / window.innerHeight / (state.base_zoom / state.camera[2]),
        color: [0.8, 0.8, 0.8, 1],
        view_projection: state.view_projection,
        segments: points.length - 1,
      })
      i++
    }

    xGraph({
      offsets: x_tick_buffer,
      view_projection: state.view_projection,
      scale: 1 / (state.base_zoom / state.camera[2]),
      y_pin: zero_project[1],
      span: tick_project[1] - zero_project[1],
      segments: points.length - 1,
    })
    yGraph({
      offsets: x_tick_buffer,
      view_projection: state.view_projection,
      scale: 1 / (state.base_zoom / state.camera[2]),
      span: tick_project[0] - zero_project[0],
      x_pin: zero_project[0],
      segments: y_tick_marks.length,
    })
  })
}

export function clipX(ratio_x) {
  return 2 * ratio_x - 1
}
export function clipY(ratio_y) {
  return 1 - 2 * ratio_y
}
export function getClipsFromPx(mouse_position) {
  let [x, y] = getRatios(mouse_position)
  return [clipX(x), clipY(y)]
}

export function getRatios(mouse_position) {
  let [mouse_x, mouse_y] = mouse_position
  return [mouse_x / window.innerWidth, mouse_y / window.innerHeight]
}

export function getNormalizedZ(world_z) {
  let projected = multiplyPoint(state.view_projection, [0, 0, world_z, 1])
  let ndz = projected[2] / projected[3]
  return ndz
}

export function getProjectionZ(world_z) {
  let projected = multiplyPoint(state.projection, [0, 0, world_z, 1])
  let ndz = projected[2] / projected[3]
  return ndz
}

export function getWidth(px_width, camera_dist) {
  let { $render } = state.refs
  let z = getProjectionZ(-camera_dist)
  let raw = [(2 * px_width) / $render.width, 0, z, 1]
  let point_world = multiplyPoint(state.inverse_projection, raw)
  return point_world[0] / point_world[3]
}
export function getHeight(px_height, camera_dist) {
  let { $render } = state.refs
  let z = getProjectionZ(-camera_dist)
  let raw = [0, (2 * px_height) / $render.height, z, 1]
  let point_world = multiplyPoint(state.inverse_projection, raw)
  return -point_world[1] / point_world[3]
}

// working off https://antongerdelan.net/opengl/raycasting.html
export function castRay(mouse_position, world_z) {
  let ndz = getNormalizedZ(world_z)
  let device_coordinates = [...getClipsFromPx(mouse_position), ndz, 1]
  let point_world = multiplyPoint(
    state.inverse_view_projection,
    device_coordinates
  )
  // divide by w at end
  return [point_world[0] / point_world[3], point_world[1] / point_world[3]]
}
