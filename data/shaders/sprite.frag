#version 300 es
precision highp float;
precision highp int;
// The atlas (texture 0) or the items the core drew (texture 1), sampled
// nearest, times the entry's color.
uniform sampler2D uAtlasTex;
uniform sampler2D uItemTex;
in vec2 vUv;
in vec4 vTint;
flat in int vTex;
out vec4 color;

void main() {
  vec4 t = vTex == 0 ? texture(uAtlasTex, vUv) : texture(uItemTex, vUv);
  color = t * vTint;
  if (color.a <= 0.0) discard;
}
