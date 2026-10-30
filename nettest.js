// The transport test page: web/online.js wired to a log and an echo. Driven
// by tests/browser/online.py, and by hand for the room-code path.
//
// Echo: a message "ping X" is answered "pong X" to its sender only.
//
// The lobby buttons go through the core as the game will (web/net.js and the
// shim's `Online`): the core has the relays probed, opens the room on the
// live ones, retries, and shows where it stands in #view.
import * as online from "./online.js?v=1c0fff8a061c";
import init, { Online } from "./pkg/tool_shim.js?v=1c0fff8a061c";
import { startNet, act } from "./net.js?v=1c0fff8a061c";

const el = (id) => document.getElementById(id);
let hosting = false;

function onEvent(ev) {
  const li = document.createElement("li");
  li.dataset.kind = ev.kind;
  li.dataset.peer = ev.peer || "";
  li.dataset.text = ev.text || "";
  li.dataset.host = ev.host ? "true" : "false";
  li.textContent = [ev.kind, ev.peer, ev.text, ev.host ? "(host)" : ""].join(" ");
  el("log").append(li);
  if (ev.kind === "message" && ev.text.startsWith("ping ")) {
    online.send(ev.peer, "pong " + ev.text.slice("ping ".length));
  }
}

function status(text) {
  el("status").textContent = text;
}

async function run(fn) {
  try {
    await fn();
    el("me").textContent = online.myId() || "";
  } catch (e) {
    status(String(e && e.message ? e.message : e));
  }
}

el("host-code").addEventListener("click", () =>
  run(async () => {
    hosting = true;
    el("my-code").value = "";
    el("my-code").value = await online.hostByCode(onEvent);
  }),
);

el("invite").addEventListener("click", () =>
  run(async () => {
    el("my-code").value = "";
    el("my-code").value = await online.inviteByCode();
  }),
);

el("use-code").addEventListener("click", () =>
  run(async () => {
    const code = el("their-code").value;
    if (hosting) {
      await online.acceptAnswer(code);
      status("answer accepted");
    } else {
      el("my-code").value = "";
      el("my-code").value = await online.joinByCode(code, onEvent);
    }
  }),
);

el("host-room").addEventListener("click", () =>
  run(async () => {
    hosting = true;
    await online.hostRoom(el("room").value, onEvent);
  }),
);

el("join-room").addEventListener("click", () =>
  run(async () => {
    hosting = false;
    await online.joinRoom(el("room").value, onEvent);
  }),
);

el("send").addEventListener("click", () => {
  const to = el("to").value;
  if (to) online.send(to, el("text").value);
  else online.broadcast(el("text").value);
});

el("leave").addEventListener("click", () => {
  online.leave();
  status("left");
});

let lobby = null;

function showView() {
  const r = act("view");
  el("view").textContent = JSON.stringify(r.error ? { error: r.error } : r.ok);
}

async function startLobby() {
  if (!lobby) {
    await init();
    lobby = new Online();
    startNet(lobby, showView);
  }
}

el("host-lobby").addEventListener("click", () =>
  run(async () => {
    await startLobby();
    act("host", { id: crypto.randomUUID(), name: "Host" });
  }),
);

el("join-lobby").addEventListener("click", () =>
  run(async () => {
    await startLobby();
    act("join", { id: crypto.randomUUID(), name: "Guest", code: el("lobby-code").value });
  }),
);

el("leave-lobby").addEventListener("click", () => {
  if (lobby) act("leave");
});

document.body.dataset.ready = "true";
