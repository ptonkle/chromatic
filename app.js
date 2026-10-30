// The page draws what the core returns and decides nothing.
//
// The core's Game (crates/core/src/game.rs, through the shim) owns the
// screens, the camera, the hand, the hotbar, the key bindings and the
// factory. This file sends it every input as a dotted action name with a
// value, advances it with the page's clock, replays its draw list through
// web/gl.js, and builds the DOM panels from its view model (`ui`).
//
// Online play: the Game also holds the online session, so web/net.js pumps
// it as it would any `Online` (the transport loads only when the core asks
// for a room). `?room=CODE` joins that room on load; `?net=off` opens rooms
// with no transport behind them (the browser check's lobby).
import init, { Game } from "./pkg/tool_shim.js?v=1c0fff8a061c";
import { makeRenderer } from "./gl.js?v=1c0fff8a061c";
import { startNet } from "./net.js?v=1c0fff8a061c";
import { Sound } from "./sound.js?v=1c0fff8a061c";

const SAVE_KEY = "chromatic.settings";
const FACTORIES_KEY = "chromatic.factories";
const el = (id) => document.getElementById(id);

function make(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

let game = null;
let renderer = null;
let atlas = null;
let G = null;
let sounds = null;
const pictures = new Map();
const last = new Map();

// Kept between visits (RS-13): the settings, and the factories saved from
// the won screen, each under its own key, as the core's text.
function loadSaved() {
  try {
    return window.localStorage.getItem(SAVE_KEY) || "";
  } catch {
    return "";
  }
}

function save(text) {
  try {
    window.localStorage.setItem(SAVE_KEY, text);
  } catch {
    // a browser that refuses storage keeps the settings for this visit only
  }
}

function loadFactories() {
  try {
    return window.localStorage.getItem(FACTORIES_KEY) || "";
  } catch {
    return "";
  }
}

function saveFactories(text) {
  try {
    window.localStorage.setItem(FACTORIES_KEY, text);
  } catch {
    // a browser that refuses storage keeps the saves for this visit only
  }
}

function play(list) {
  for (const s of list) Sound.play(s);
}

function act(name, value) {
  const r = JSON.parse(game.act(name, value === undefined ? "" : String(value)));
  if (r.error) {
    el("message").textContent = r.error;
    return;
  }
  el("message").textContent = "";
  play(r.ok.sounds);
  if (r.ok.save) save(r.ok.save);
  if (r.ok.factories) saveFactories(r.ok.factories);
  refresh();
}

// ---- pictures: atlas sprites and the core's item pixels ----

function image(spec, className) {
  const c = make("canvas", className || "pic");
  if (!spec) return c;
  const g = c.getContext("2d");
  if (spec.sprite) {
    const [x, y, w, h] = spec.sprite;
    c.width = w;
    c.height = h;
    g.drawImage(atlas, x, y, w, h, 0, 0, w, h);
  } else if (spec.picture !== undefined) {
    if (!pictures.has(spec.picture)) {
      const bytes = new Uint8ClampedArray(game.item_pixels(spec.picture));
      pictures.set(spec.picture, new ImageData(bytes, G.picture_px));
    }
    c.width = G.picture_px;
    c.height = G.picture_px;
    g.putImageData(pictures.get(spec.picture), 0, 0);
    c.classList.add("item");
  } else if (spec.liquid) {
    // a forge fed from its pipe: the liquid's color fills the well
    c.width = 1;
    c.height = 1;
    g.fillStyle = `rgb(${spec.liquid.join(",")})`;
    g.fillRect(0, 0, 1, 1);
  }
  return c;
}

// A recipe picture that names the color under the pointer (spot 0 the HUD,
// 1 the big view) and runs `action` on a click.
function recipePic(spec, className, spot, action) {
  const c = image(spec, className);
  c.addEventListener("pointermove", (e) =>
    act("recipe.point", `${spot},${Math.floor(e.offsetX)},${Math.floor(e.offsetY)},${c.clientWidth},${c.clientHeight}`),
  );
  c.addEventListener("pointerleave", () => act("recipe.leave"));
  if (action) c.addEventListener("click", () => act(action.name, action.value));
  return c;
}

function copyText(text) {
  if (navigator.clipboard) navigator.clipboard.writeText(text).catch(() => {});
}

function copyLink(query) {
  copyText(location.origin + location.pathname + query);
}

function button(a, className) {
  const b = make("button", className, a.label);
  if (a.selected) b.classList.add("selected");
  if (a.enabled === false) b.disabled = true;
  b.addEventListener("click", () => {
    if (a.copy) copyLink(a.copy);
    if (a.copy_text) copyText(a.copy_text);
    // the daily game's day comes from the page's wall clock
    act(a.name, a.now ? String(Date.now()) : a.value);
  });
  return b;
}

// ---- the view model ----

function changed(key, value) {
  const text = JSON.stringify(value);
  if (last.get(key) === text) return false;
  last.set(key, text);
  return true;
}

function show(id, on) {
  el(id).hidden = !on;
}

function drawMenu(ui) {
  show("menu", !!ui.menu);
  if (!ui.menu || !changed("menu", ui.menu)) return;
  el("menu-buttons").replaceChildren(...ui.menu.map((a) => button(a, "big")));
}

// The version in the corner of the main menu; it opens What's New.
function drawVersion(ui) {
  const v = ui.version;
  show("version", !!v);
  if (!v || !changed("version", v)) return;
  const b = el("version");
  b.textContent = v.label;
  b.onclick = () => act(v.name, v.value);
}

// What's New: each version, its date and its lines (a fix version smaller).
function drawNotes(ui) {
  const n = ui.notes;
  show("notes", !!n);
  if (!n || !changed("notes", n)) return;
  const list = make("div", "notes-list");
  n.entries.forEach((e) => {
    const sec = make("section", e.fix ? "note fix" : "note");
    const head = make("div", "note-head");
    head.append(make("span", "note-version", e.version), make("span", "note-date", e.date));
    const ul = make("ul");
    e.lines.forEach((l) => ul.append(make("li", "", l)));
    sec.append(head, ul);
    list.append(sec);
  });
  const foot = make("div", "foot");
  foot.append(button(n.back));
  el("notes").replaceChildren(make("h2", "", n.heading), list, foot);
  list.scrollTop = 0;
}

function drawSetup(ui) {
  show("setup", !!ui.setup);
  if (!ui.setup || !changed("setup", ui.setup)) return;
  const s = ui.setup;
  const rows = s.rows.map((r) => {
    const row = make("div", "row");
    row.append(make("span", "label", r.label));
    if (r.value !== undefined) {
      row.append(make("span", "value", r.value));
      return row;
    }
    const opts = make("div", "options");
    opts.append(...r.options.map((o) => button(o)));
    row.append(opts);
    return row;
  });
  if (s.recipe) {
    const pic = make("div", "recipe-row");
    pic.append(image(s.recipe, "pic recipe-pic lobby-recipe"));
    rows.push(pic);
  }
  // the once-only tutorial offer: a line of its own under the settings
  if (s.offer) {
    const offer = make("div", "offer");
    offer.append(make("span", "", s.offer.text), button(s.offer.action));
    rows.push(offer);
  }
  const foot = make("div", "foot");
  foot.append(button(s.back), button(s.start, "primary"));
  el("setup").replaceChildren(make("h2", "", s.heading), ...rows, foot);
}

function drawOnline(ui) {
  show("online", !!ui.online);
  if (!ui.online || !changed("online", ui.online)) return;
  const o = ui.online;
  // The name field: the core keeps, cuts and trims it; typing redraws the
  // panel, so the field keeps its focus and caret across the redraw.
  const typing = document.activeElement && document.activeElement.id === "player-name";
  const caret = typing ? document.activeElement.selectionStart : null;
  const name = make("input", "name-input");
  name.id = "player-name";
  name.value = o.name.value;
  name.maxLength = o.name.max;
  name.autocomplete = "off";
  name.spellcheck = false;
  name.addEventListener("input", () => act(o.name.name, name.value));
  const nameLabel = make("label", "label", o.name.label);
  nameLabel.htmlFor = name.id;
  const nameRow = make("div", "row name-row");
  nameRow.append(nameLabel, name);
  const code = make("input", "code-input");
  code.id = "room-code";
  code.placeholder = o.code;
  code.autocomplete = "off";
  code.spellcheck = false;
  const join = () => act(o.join.name, code.value);
  code.addEventListener("keydown", (e) => {
    if (e.key === "Enter") join();
  });
  const joinButton = make("button", "join", o.join.label);
  joinButton.addEventListener("click", join);
  const host = make("div", "row");
  host.append(button(o.host, "primary"));
  const joinRow = make("div", "row");
  joinRow.append(code, joinButton);
  const foot = make("div", "foot");
  foot.append(button(o.back));
  el("online").replaceChildren(make("h2", "", o.heading), nameRow, host, joinRow, foot);
  if (typing) {
    name.focus();
    name.setSelectionRange(caret, caret);
  }
}

function drawLobby(ui) {
  show("lobby", !!ui.lobby);
  if (!ui.lobby || !changed("lobby", ui.lobby)) return;
  const l = ui.lobby;
  const left = make("div", "column");
  const codeRow = make("div", "code-row");
  const code = make("div", "well code", l.code);
  code.id = "lobby-code";
  codeRow.append(code, button(l.copy_code), button(l.copy));
  left.append(make("div", "label", l.code_label), codeRow, make("div", "label", l.players_label));
  const players = make("div", "players");
  players.append(
    ...l.players.map((p) => {
      const r = make("div", "well player");
      if (p.me) r.classList.add("me");
      r.append(make("span", "name", p.name), make("span", "note", p.note));
      return r;
    }),
  );
  left.append(players);
  const right = make("div", "column settings");
  if (l.show_settings) {
    right.append(
      ...l.rows.map((r) => {
        const row = make("div", "row");
        row.append(make("span", "label", r.label));
        const opts = make("div", "options");
        opts.append(...r.options.map((o) => button(o)));
        row.append(opts);
        return row;
      }),
    );
    const tick = button(l.preview, "tick");
    tick.setAttribute("role", "checkbox");
    tick.setAttribute("aria-checked", l.preview.selected ? "true" : "false");
    right.append(tick);
    const preview = make("div", "preview");
    if (l.recipe) preview.append(image(l.recipe, "pic recipe-pic lobby-recipe"));
    if (l.reroll) preview.append(button(l.reroll));
    right.append(preview);
  }
  const body = make("div", "lobby-body");
  body.append(left, right);
  const note = make("p", "note", l.note);
  note.hidden = !l.note;
  const foot = make("div", "foot");
  foot.append(button(l.leave));
  if (l.start) foot.append(button(l.start, "primary"));
  el("lobby").replaceChildren(make("h2", "", l.heading), body, note, foot);
}

function drawScores(h) {
  const rows = h && h.players;
  show("scores", !!rows);
  if (!rows || !changed("scores", rows)) return;
  el("scores").replaceChildren(
    ...rows.map((p) => {
      const r = make("div", "score");
      if (p.me) r.classList.add("me");
      if (p.gone) r.classList.add("gone");
      const bar = make("div", "bar");
      const fill = make("div", "fill");
      fill.style.width = `calc(100% * ${p.delivered} / ${h.goal})`;
      bar.append(fill);
      r.append(make("span", "name", p.name), bar, make("span", "n", p.gone ? p.gone_label : p.delivered));
      return r;
    }),
  );
}

function drawHud(ui) {
  const h = ui.hud;
  drawScores(h);
  show("recipe", !!h);
  show("hotbar", !!h && ui.screen !== "won" && h.hotbar.length > 0);
  show("countdown", !!h && h.countdown !== null);
  // the exit's name, centerd over its top edge
  const tag = el("output-tag");
  show("output-tag", !!h && !!h.output_at && !!h.output_label && ui.screen !== "won");
  if (!h) return;
  if (h.output_at) {
    tag.style.left = `${h.output_at[0]}px`;
    tag.style.top = `${h.output_at[1]}px`;
    if (tag.textContent !== h.output_label) tag.textContent = h.output_label;
  }
  if (h.countdown !== null && changed("countdown", h.countdown)) el("countdown").textContent = h.countdown;
  if (changed("recipe", [h.recipe, h.delivered, h.rejects])) {
    const counts = make("div", "counts");
    const top = make("div", "delivered");
    top.append(make("span", "big-number", h.delivered), make("span", "goal", ` ${h.of} ${h.goal}`));
    const bar = make("div", "bar");
    const fill = make("div", "fill");
    fill.style.width = `calc(100% * ${h.delivered} / ${h.goal})`;
    bar.append(fill);
    const rej = make("div", "rejects");
    rej.append(make("span", "dot"), make("span", "", h.rejects_label), make("span", "n", h.rejects));
    counts.append(make("div", "clock"), top, bar, rej);
    el("recipe").replaceChildren(recipePic(h.recipe, "pic recipe-pic", 0, h.recipe.action), counts);
  }
  // the time played, outside the rebuild above so the picture is not redrawn
  // every second
  const clock = el("recipe").querySelector(".clock");
  if (clock && clock.textContent !== (h.clock ?? "")) clock.textContent = h.clock ?? "";
  if (changed("hotbar", h.hotbar)) {
    // the slot width divides by the slot count (style.css)
    el("hotbar").style.setProperty("--n", h.hotbar.length);
    el("hotbar").replaceChildren(
      ...h.hotbar.map((slot) => {
        const cell = make("div", "slot");
        cell.append(make("span", "slot-label", slot.label));
        const b = make("button", "slot-button");
        if (slot.selected) b.classList.add("selected");
        b.setAttribute("aria-pressed", slot.selected ? "true" : "false");
        b.append(make("span", "key", slot.key), image(slot.icon, "pic icon"));
        b.addEventListener("click", () => act(slot.action.name, slot.action.value));
        cell.append(b);
        return cell;
      }),
    );
  }
}

// The tutorial's prompt (F8): the core picks the step and fills its text.
function drawPrompt(ui) {
  const p = ui.prompt;
  show("prompt", !!p);
  document.body.dataset.prompt = p ? p.step : "";
  if (p && changed("prompt", p.text)) el("prompt").textContent = p.text;
}

function drawBuild(ui) {
  show("build", !!ui.build_menu);
  if (!ui.build_menu || !changed("build", ui.build_menu)) return;
  el("build").replaceChildren(
    ...ui.build_menu.map((item) => {
      const b = make("button", "build-item");
      if (item.action.selected) b.classList.add("selected");
      b.title = item.label;
      b.append(image(item.icon, "pic icon"), make("span", "slot-label", item.label));
      b.addEventListener("click", () => act(item.action.name, item.action.value));
      return b;
    }),
  );
}

function well(spec) {
  const w = make("div", "well");
  w.append(image(spec, "pic large"));
  return w;
}

// An input well: what it holds, and its count against its room when the
// core sends one.
function inputWell(input) {
  const w = well(input.image);
  w.classList.add("in-well");
  if (input.count !== null) w.append(make("span", "count", input.count));
  return w;
}

function drawPanel(ui) {
  const p = ui.panel;
  show("panel", !!p);
  if (!p || !changed("panel", p)) return;
  const head = make("div", "head");
  head.append(make("h2", "", p.title), button(p.close, "close"));
  const body = make("div", "flow");
  const ins = make("div", p.inputs.length > 1 ? "stack-in" : "");
  ins.append(...p.inputs.map(inputWell));
  body.append(ins);
  const arrow = make("div", "arrow");
  const bar = make("div", "bar");
  const fill = make("div", "fill");
  fill.style.width = `calc(100% * ${p.progress[0]} / ${p.progress[1]})`;
  bar.append(fill);
  arrow.append(make("div", "shaft"), bar);
  body.append(arrow, well(p.output));
  const parts = [head, body];
  if (p.cuts) {
    const grid = make("div", "cuts");
    grid.append(
      ...p.cuts.map((c) => {
        const b = make("button", "cut");
        if (c.selected) b.classList.add("selected");
        b.dataset.cut = c.action.value;
        b.title = c.title;
        b.append(image(c.icon, "pic icon"));
        b.addEventListener("click", () => act(c.action.name, c.action.value));
        return b;
      }),
    );
    parts.push(grid);
  }
  const foot = make("div", "foot");
  foot.append(button(p.discard), button(p.ok));
  parts.push(foot);
  el("panel").replaceChildren(...parts);
}

function drawPause(ui) {
  show("pause", !!ui.pause);
  if (!ui.pause || !changed("pause", ui.pause)) return;
  const p = ui.pause;
  const foot = make("div", "foot");
  foot.append(button(p.quit), button(p.settings), button(p.resume, "primary"));
  const parts = p.heading ? [make("h2", "", p.heading), foot] : [foot];
  el("pause").replaceChildren(...parts);
}

// The Settings screen (mockup A). The slider is rebuilt only when something
// other than its value changes, so a drag is not cut off by the redraw.
function drawSettings(ui) {
  const s = ui.settings;
  show("settings", !!s);
  if (!s) return;
  const rest = { ...s, volume: { ...s.volume, value: null } };
  if (changed("settings", rest)) {
    const v = s.volume;
    const vol = make("div", "row");
    const slider = make("input", "slider");
    slider.type = "range";
    slider.min = 0;
    slider.max = v.max;
    slider.value = v.value;
    slider.addEventListener("input", () => act(v.name, slider.value));
    vol.append(make("span", "label", v.label), slider, make("span", "n", v.value));
    const pan = make("div", "row");
    const opts = make("div", "options");
    opts.append(...s.edge_pan.options.map((o) => button(o)));
    pan.append(make("span", "label", s.edge_pan.label), opts);
    const h = s.hotbar;
    const head = make("div", "section-head");
    head.append(make("span", "label", h.label), button(h.reset));
    const strip = make("div", "strip");
    strip.append(
      ...h.slots.map((slot) => {
        const cell = make("div", "slot");
        cell.append(make("span", "slot-label", slot.label));
        const b = make("button", "slot-button");
        if (slot.selected) b.classList.add("selected");
        b.setAttribute("aria-pressed", slot.selected ? "true" : "false");
        b.append(make("span", "key", slot.key), image(slot.icon, "pic icon"));
        b.addEventListener("click", () => act(slot.action.name, slot.action.value));
        cell.append(b);
        return cell;
      }),
    );
    const grid = make("div", "choices");
    grid.append(
      ...h.choices.map((c) => {
        const b = make("button", "build-item");
        if (c.selected) b.classList.add("selected");
        if (c.used) b.classList.add("used");
        b.append(image(c.icon, "pic icon"), make("span", "slot-label", c.label));
        b.addEventListener("click", () => act(c.action.name, c.action.value));
        return b;
      }),
    );
    const section = make("div", "section");
    section.append(head, strip, grid);
    const body = make("div", "body");
    body.append(vol, pan, section);
    const foot = make("div", "foot");
    foot.append(button(s.back));
    el("settings").replaceChildren(make("h2", "", s.heading), body, foot);
  }
  const slider = el("settings").querySelector(".slider");
  if (document.activeElement !== slider) slider.value = s.volume.value;
  slider.style.setProperty("--fill", s.volume.value / s.volume.max);
  el("settings").querySelector(".row .n").textContent = s.volume.value;
}

function drawWon(ui) {
  show("won", !!ui.won);
  if (!ui.won || !changed("won", ui.won)) return;
  const w = ui.won;
  const body = make("div", "won-body");
  body.append(image(ui.hud.recipe, "pic recipe-pic"));
  if (w.rows) {
    const table = make("div", "standings");
    table.append(
      ...w.rows.map((r) => {
        const row = make("div", "standing");
        if (r.me) row.classList.add("me");
        if (r.gone) row.classList.add("gone");
        row.append(make("span", "rank", r.rank), make("span", "name", r.name), make("span", "n", r.delivered));
        return row;
      }),
    );
    body.append(table);
  } else {
    const time = make("div", "won-time");
    time.append(make("span", "big-number", w.time));
    // the daily game's best time, or a plain "New best"
    if (w.best && w.best.note) time.append(make("span", "best", w.best.note));
    if (w.best && w.best.label) time.append(make("span", "best", `${w.best.label}  ${w.best.value}`));
    body.append(time);
  }
  const foot = make("div", "foot");
  foot.append(button(w.menu));
  if (w.save) foot.append(button(w.save));
  if (w.rematch) foot.append(button(w.rematch, "primary"));
  el("won").replaceChildren(make("h1", "", w.heading), body, foot);
}

// The saved factories, newest first: each one's recipe, difficulty, finish
// time and date, with Open and Delete.
function drawSaved(ui) {
  const s = ui.saved;
  show("saved", !!s);
  if (!s || !changed("saved", s)) return;
  const list = make("div", "saved-list");
  list.append(
    ...s.rows.map((r) => {
      const row = make("div", "saved-row");
      const facts = make("div", "facts");
      facts.append(make("span", "level", r.level), make("span", "time", r.time), make("span", "date", r.date));
      const acts = make("div", "acts");
      acts.append(button(r.delete), button(r.open, "primary"));
      row.append(image(r.recipe, "pic saved-pic"), facts, acts);
      return row;
    }),
  );
  const foot = make("div", "foot");
  foot.append(button(s.back));
  el("saved").replaceChildren(make("h2", "", s.heading), list, foot);
  list.scrollTop = 0;
}

// A saved factory, look-only: its one button goes back to the main menu.
function drawViewing(ui) {
  const v = ui.viewing;
  show("viewing", !!v);
  if (!v || !changed("viewing", v)) return;
  el("viewing").replaceChildren(button(v.menu));
}

function drawHover(ui) {
  const h = ui.hover;
  show("hover", !!h);
  if (!h) return;
  const box = el("hover");
  box.style.left = `${h.x}px`;
  box.style.top = `${h.y}px`;
  if (!changed("hover", [h.item, h.layers, h.slots, h.name])) return;
  const layers = make("div", "layers");
  layers.append(...h.layers.map((l) => image(l)));
  if (!h.slots) {
    const parts = [image(h.item, "pic hover-pic"), layers];
    if (h.name) parts.push(make("span", "hover-name", h.name));
    box.replaceChildren(...parts);
    return;
  }
  // a stamper: its two pieces, top over bottom, then its result if any
  const slots = make("div", "slots");
  slots.append(...h.slots.map(well));
  const parts = [slots];
  if (h.item) parts.push(image(h.item, "pic hover-pic"));
  box.replaceChildren(...parts);
}

function drawRecipeView(ui) {
  const r = ui.recipe_view;
  show("recipe-view", !!r);
  if (r && changed("recipe-view", r)) {
    const box = el("recipe-view");
    box.style.left = `${r.x}px`;
    box.style.top = `${r.y}px`;
    const c = recipePic(r, "pic", 1, r.close);
    c.style.width = `${r.size}px`;
    c.style.height = `${r.size}px`;
    box.replaceChildren(c);
  }
  if (!r) last.delete("recipe-view");
  const t = ui.recipe_tip;
  show("recipe-tip", !!t);
  if (!t) return;
  const tip = el("recipe-tip");
  tip.style.left = `${t.x}px`;
  tip.style.top = `${t.y}px`;
  tip.textContent = t.text;
}

function refresh() {
  const r = JSON.parse(game.ui());
  if (r.error) {
    el("message").textContent = r.error;
    return;
  }
  const ui = r.ok;
  document.body.dataset.screen = ui.screen;
  document.body.dataset.paused = ui.paused;
  document.body.dataset.menu = ui.menu_open;
  document.body.dataset.delivered = ui.hud ? ui.hud.delivered : "";
  document.body.dataset.panel = ui.panel ? ui.panel.kind : "";
  document.body.dataset.handOk = ui.hud ? ui.hud.hand_ok : "";
  if (changed("volume", ui.volume)) Sound.init(sounds, ui.volume / ui.volume_max);
  drawMenu(ui);
  drawVersion(ui);
  drawNotes(ui);
  drawSetup(ui);
  drawOnline(ui);
  drawLobby(ui);
  drawHud(ui);
  drawPrompt(ui);
  drawBuild(ui);
  drawPanel(ui);
  drawPause(ui);
  drawWon(ui);
  drawSettings(ui);
  drawSaved(ui);
  drawViewing(ui);
  drawHover(ui);
  drawRecipeView(ui);
}

// ---- input: every event goes to the core by name ----

function keyName(e) {
  let k = "";
  if (e.ctrlKey || e.metaKey) k += "Ctrl+";
  if (e.shiftKey) k += "Shift+";
  if (e.altKey && !e.code.startsWith("Alt")) k += "Alt+";
  return k + e.code;
}

// Keys the browser would otherwise act on (scrolling, back, find).
const BROWSER_KEYS = ["Backspace", "Tab", "Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "AltLeft", "AltRight"];

function listen(canvas) {
  // Positions are always canvas pixels, read over the whole window, so edge
  // pan works where the hotbar, recipe card or scoreboard cover the map's
  // edge (Mandible TRIAGE 14).
  const at = (e) => {
    const r = canvas.getBoundingClientRect();
    return `${Math.round(e.clientX - r.left)},${Math.round(e.clientY - r.top)}`;
  };
  window.addEventListener("pointermove", (e) => act("pointer.move", at(e)));
  canvas.addEventListener("pointerdown", (e) => {
    canvas.setPointerCapture(e.pointerId);
    act("pointer.down", `${e.button},${at(e)},${e.shiftKey ? 1 : 0}`);
  });
  canvas.addEventListener("pointerup", (e) => act("pointer.up", `${e.button},${at(e)}`));
  // Leaving the window hides the ghost; edge pan carries on from the last position.
  document.documentElement.addEventListener("pointerleave", () => act("pointer.leave"));
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  canvas.addEventListener("auxclick", (e) => e.preventDefault());
  canvas.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      act("wheel", `${e.deltaY},${at(e)}`);
    },
    { passive: false },
  );
  window.addEventListener("keydown", (e) => {
    // typing a room code is not a game key
    if (e.target instanceof HTMLInputElement) return;
    const ctrlKey = e.ctrlKey && ["KeyC", "KeyX", "KeyV", "KeyZ", "KeyY"].includes(e.code);
    if (BROWSER_KEYS.includes(e.code) || ctrlKey) e.preventDefault();
    // a held key pans through the core's held set, so repeats add nothing
    if (!e.repeat) act("key.down", keyName(e));
  });
  window.addEventListener("keyup", (e) => {
    if (!(e.target instanceof HTMLInputElement)) act("key.up", e.code);
  });
  window.addEventListener("blur", () => act("blur"));
  const resize = () => {
    renderer.resize(window.innerWidth, window.innerHeight);
    act("view.resize", `${window.innerWidth},${window.innerHeight}`);
  };
  window.addEventListener("resize", resize);
  resize();
}

function loop(now) {
  game.frame(now);
  play(JSON.parse(game.sounds()));
  // a frame can change the settings too (the best daily time at a win)
  const pending = game.take_save();
  if (pending) save(pending);
  const up = game.uploads();
  for (let i = 0; i < up.length; i += G.upload_stride) {
    renderer.upload(up[i + 1], up[i + G.upload_y], up[i + G.upload_size], game.belt_pixels(up[i]));
  }
  renderer.frame(game.draw());
  refresh();
  window.requestAnimationFrame(loop);
}

async function text(path) {
  return (await fetch(path)).text();
}

async function main() {
  await init();
  const [strings, sprites, draw, vertex, fragment, soundText, notes] = await Promise.all([
    text("data/strings.json"),
    text("data/sprites.json"),
    text("data/draw.json"),
    text("data/shaders/sprite.vert"),
    text("data/shaders/sprite.frag"),
    text("data/sounds.json"),
    text("data/patch-notes.json"),
  ]);
  const look = JSON.parse(draw);
  G = look.gl;
  sounds = JSON.parse(soundText);
  atlas = await createImageBitmap(await (await fetch("data/sprites.png?v=1c0fff8a061c")).blob(), {
    premultiplyAlpha: "none",
    colorSpaceConversion: "none",
  });
  const seed = window.crypto.getRandomValues(new Uint32Array(1))[0];
  game = new Game(strings, sprites, draw, loadSaved(), seed);
  act("notes.load", notes);
  act("saved.load", loadFactories());
  el("tab-icon").href = game.tab_icon();
  // ?seed=N pins the maps (the browser check uses it).
  const params = new URLSearchParams(window.location.search);
  const pinned = params.get("seed");
  if (pinned !== null) act("setup.seed", pinned);
  // `?fast`: the browser checks' fast mode (the core's `fast`), never set for players
  if (params.has("fast")) act("flag.fast");
  if (params.get("net") === "off") act("online.offline");
  const canvas = el("world");
  renderer = makeRenderer(canvas, G, { vertex, fragment }, atlas);
  if (!renderer) {
    el("message").textContent = JSON.parse(strings).hud.no_webgl;
    return;
  }
  listen(canvas);
  // the online session's pump; a background tab's factory keeps time with it
  startNet(game, () => game.frame(performance.now()));
  const room = params.get("room");
  if (room !== null) act("online.join", room);
  refresh();
  document.body.dataset.ready = "true";
  window.requestAnimationFrame(loop);
}

main();
