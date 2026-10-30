// The action sounds (contract 19, RS-10): short synthesized clicks that tell
// the player what they just did. Machines are silent. Every number lives in
// data/sounds.json; this file only wires WebAudio nodes from it.
//
// API, two calls:
//
//   import { Sound } from "./sound.js?v=1c0fff8a061c";
//   Sound.init(json, volume);  // json: the parsed data/sounds.json.
//                              // volume: the settings' master volume, 0 to 1
//                              // (omit it for the JSON's default). Call init
//                              // again with the new volume when the setting
//                              // changes; it keeps the audio context.
//   Sound.play(event);         // event: a key of json.events, such as
//                              // "place", "remove", "rotate", "rotate_back",
//                              // "pick", "copy", "cut", "paste", "undo",
//                              // "redo", "setting", "settings_copy",
//                              // "settings_paste", "discard", "refused",
//                              // "win". An unknown name throws.
//
// The audio context is made on the first pointer or key press after init
// (browsers keep audio off until a gesture); a play before that is silent.
// Repeats of one event closer together than its throttle are dropped, so a
// belt drag that places many tiles clicks at a steady rate.

let data = null;
let ctx = null;
let master = null;
let noise = null;
let level = null;
const last = new Map();

function wake() {
  if (ctx) {
    if (ctx.state === "suspended") ctx.resume();
    return;
  }
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor || !data) return;
  ctx = new Ctor();
  master = ctx.createGain();
  master.gain.value = level;
  master.connect(ctx.destination);
  noise = noiseBuffer(data.noise);
}

// White noise from a Park-Miller generator, so the buffer is the same on
// every visit and the page needs no random source.
function noiseBuffer(spec) {
  const buf = ctx.createBuffer(1, spec.samples, ctx.sampleRate);
  const out = buf.getChannelData(0);
  let state = spec.seed;
  for (let i = 0; i < spec.samples; i += 1) {
    state = (state * spec.mul) % spec.mod;
    const x = state / spec.mod;
    out[i] = x + x - 1;
  }
  return buf;
}

function source(layer, freq) {
  if (layer.wave === "noise") {
    const src = ctx.createBufferSource();
    src.buffer = noise;
    src.loop = true;
    return src;
  }
  const osc = ctx.createOscillator();
  osc.type = layer.wave;
  osc.frequency.value = freq;
  return osc;
}

function voice(layer, t, scale) {
  const end = t + layer.attack + layer.decay;
  const src = source(layer, layer.freq * scale);
  if (layer.freq_end && src.frequency) {
    src.frequency.setValueAtTime(layer.freq * scale, t);
    src.frequency.exponentialRampToValueAtTime(layer.freq_end * scale, end);
  }
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(data.floor, t);
  amp.gain.linearRampToValueAtTime(layer.gain, t + layer.attack);
  amp.gain.exponentialRampToValueAtTime(data.floor, end);
  let head = src;
  if (layer.filter) {
    const f = ctx.createBiquadFilter();
    f.type = layer.filter.type;
    f.Q.value = layer.filter.q;
    f.frequency.setValueAtTime(layer.filter.freq * scale, t);
    if (layer.filter.freq_end) {
      f.frequency.exponentialRampToValueAtTime(layer.filter.freq_end * scale, end);
    }
    head.connect(f);
    head = f;
  }
  head.connect(amp);
  amp.connect(master);
  src.start(t);
  src.stop(end);
}

export const Sound = {
  init(json, volume) {
    data = json;
    level = volume === undefined || volume === null ? json.volume : volume;
    if (master) master.gain.value = level;
    if (!ctx) {
      window.addEventListener("pointerdown", wake, true);
      window.addEventListener("keydown", wake, true);
    }
  },

  play(event) {
    if (!data) return;
    const layers = data.events[event];
    if (!layers) throw new Error("no sound for event " + event);
    if (!ctx || ctx.state !== "running" || level <= 0) return;
    const now = ctx.currentTime;
    if (last.has(event) && now - last.get(event) < data.throttle) return;
    last.set(event, now);
    for (const layer of layers) {
      let scale = 1;
      const times = layer.repeat || 1;
      for (let k = 0; k < times; k += 1) {
        voice(layer, now + layer.at + k * (layer.every || 0), scale);
        scale *= layer.step || 1;
      }
    }
  },
};
