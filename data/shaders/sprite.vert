#version 300 es
precision highp float;
precision highp int;
// One sprite per instance, straight from the core's draw list
// (crates/core/src/render.rs): the screen rectangle, the source rectangle,
// the quarter-turn flags and a color multiplier.
in vec2 aCorner;
in int aTex;
in ivec4 aDst;
in ivec4 aSrc;
in ivec3 aFlip;
in ivec4 aTint;
uniform vec2 uView;
uniform vec2 uAtlas;
uniform vec2 uItems;
uniform float uColorScale;
out vec2 vUv;
out vec4 vTint;
flat out int vTex;

void main() {
  vec2 c = aCorner;
  vec2 s = aFlip.x == 1 ? c.yx : c;
  if (aFlip.y == 1) s.x = 1.0 - s.x;
  if (aFlip.z == 1) s.y = 1.0 - s.y;
  vec2 n = (vec2(aDst.xy) + c * vec2(aDst.zw)) / uView;
  gl_Position = vec4(n.x + n.x - 1.0, 1.0 - n.y - n.y, 0.0, 1.0);
  vec2 size = aTex == 0 ? uAtlas : uItems;
  vUv = (vec2(aSrc.xy) + s * vec2(aSrc.zw)) / size;
  vTint = vec4(aTint) / uColorScale;
  vTex = aTex;
}
