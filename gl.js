// The WebGL 2 sprite renderer (PLAN.md contract 14). Each frame it uploads
// the core's draw list as it is, one instance per sprite, and draws it in one
// call: the atlas and the item texture, sampled nearest. Every stride, size
// and offset comes from data/draw.json, so this file holds no layout.

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
  return shader;
}

function link(gl, vertex, fragment) {
  const program = gl.createProgram();
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, vertex));
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, fragment));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  return program;
}

function texture(gl, unit, setup) {
  const t = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  setup();
  return t;
}

// Returns null when the browser has no WebGL 2.
export function makeRenderer(canvas, G, shaders, atlas) {
  const gl = canvas.getContext("webgl2", { antialias: false, alpha: false, preserveDrawingBuffer: true });
  if (!gl) return null;
  const program = link(gl, shaders.vertex, shaders.fragment);
  gl.useProgram(program);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);

  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);

  // the six corners of one quad
  const corners = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, corners);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(G.corners), gl.STATIC_DRAW);
  const aCorner = gl.getAttribLocation(program, "aCorner");
  gl.enableVertexAttribArray(aCorner);
  gl.vertexAttribPointer(aCorner, G.corner_size, gl.FLOAT, false, 0, 0);

  // the draw list, one entry per instance
  const instances = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, instances);
  const stride = G.stride * G.bytes_per_value;
  for (const [name, size, offset] of G.attributes) {
    const loc = gl.getAttribLocation(program, name);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribIPointer(loc, size, gl.INT, stride, offset * G.bytes_per_value);
    gl.vertexAttribDivisor(loc, 1);
  }

  const uniform = (name) => gl.getUniformLocation(program, name);
  texture(gl, 0, () => gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas));
  const side = G.item_texture;
  texture(gl, 1, () =>
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, side, side, 0, gl.RGBA, gl.UNSIGNED_BYTE, null),
  );
  gl.uniform1i(uniform("uAtlasTex"), 0);
  gl.uniform1i(uniform("uItemTex"), 1);
  gl.uniform2f(uniform("uAtlas"), atlas.width, atlas.height);
  gl.uniform2f(uniform("uItems"), side, side);
  gl.uniform1f(uniform("uColorScale"), G.color_scale);
  const uView = uniform("uView");
  const [r, g, b, a] = G.clear;
  gl.clearColor(r, g, b, a);

  return {
    resize(width, height) {
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
      gl.uniform2f(uView, width, height);
    },
    // An item picture into its slot of the item texture.
    upload(x, y, size, pixels) {
      gl.activeTexture(gl.TEXTURE1);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, x, y, size, size, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    },
    frame(list) {
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.bindBuffer(gl.ARRAY_BUFFER, instances);
      gl.bufferData(gl.ARRAY_BUFFER, list, gl.STREAM_DRAW);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, G.vertices, list.length / G.stride);
    },
  };
}
