// Online play's page side (after Crabble's web/net.js): carries text between
// the core's online session (crates/core/src/online/, through the shim's
// `Online`) and the transport (web/online.js), and does what the core asks of
// the transport. It decides nothing: the core says what to send, to whom,
// and when to host, join or leave.
//
// online.js, and the vendored bundle behind it, load only when the core
// first asks for a room (a player pressed Host or Join), so the default
// load-and-idle path stays on this origin (R7). The game (web/app.js) pumps
// its Game through here, and the transport test page (web/nettest.js) its
// Online: both have the same net_event and net_pump doors.
//
// Before a room opens, the core asks for a relay probe (`probe_relays`); its
// answer goes back as a `relays` event, and the room then opens on the live
// relays it names (crates/core/src/online/relays.rs).
import { ONLINE } from "./online-config.js?v=1c0fff8a061c";

let net = null;
let onPump = null;
let transport = null;
let clock = null;

// The worker's tick, started with online play (the default load-and-idle
// path starts no worker), for a player whose tab goes to the background.
function startClock() {
  if (clock) return;
  try {
    clock = new Worker("./net-clock.js?v=1c0fff8a061c");
    clock.onmessage = pump;
    clock.postMessage(ONLINE.pumpMs);
  } catch (e) {
    clock = setInterval(pump, ONLINE.pumpMs);
  }
}

function onNet(e) {
  net.net_event(e.kind, e.peer || "", e.text || "", !!e.host, performance.now());
}

async function request(req) {
  if (req.op === "leave") {
    if (transport) transport.leave();
    return;
  }
  startClock();
  try {
    if (!transport) transport = await import("./online.js?v=1c0fff8a061c");
    if (req.op === "probe_relays") {
      const live = await transport.probeRelays(req.timeout_ms, req.req);
      net.net_event("relays", "", JSON.stringify({ id: req.id, live }), false, performance.now());
    } else if (req.op === "host_room") await transport.hostRoom(req.room, onNet, req.relays);
    else if (req.op === "join_room") await transport.joinRoom(req.room, onNet, req.relays);
  } catch (err) {
    net.net_event("error", "", (err && err.message) || "online.signal_failed", false, performance.now());
  }
}

function pump() {
  const result = JSON.parse(net.net_pump(performance.now()));
  if (!result.ok) return;
  const p = result.ok;
  // the text first: a parting word goes out before the links close
  if (transport) {
    p.out.forEach((m) => {
      if (m.to === null) transport.broadcast(m.text);
      else transport.send(m.to, m.text);
    });
  }
  p.requests.forEach(request);
  if (onPump) onPump();
}

function loop() {
  pump();
  requestAnimationFrame(loop);
}

/** Starts pumping the shim's `Online` every animation frame; `after` runs after each pump (a redraw). */
export function startNet(online, after) {
  net = online;
  onPump = after;
  requestAnimationFrame(loop);
}

/** One online action through the core (`Link::act`): the parsed `{ok}` or `{error}`. */
export function act(name, value) {
  return JSON.parse(net.act(name, value === undefined ? "" : JSON.stringify(value), performance.now()));
}
