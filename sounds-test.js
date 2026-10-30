// The sound audition page: a button per event in data/sounds.json, played
// through web/sound.js exactly as the game plays them. Edit the JSON and
// reload to hear a change.
import { Sound } from "./sound.js?v=1c0fff8a061c";

const json = await (await fetch("data/sounds.json?v=1c0fff8a061c")).json();
const volume = document.getElementById("volume");
Sound.init(json, volume.valueAsNumber);
volume.addEventListener("input", () => Sound.init(json, volume.valueAsNumber));
for (const name of Object.keys(json.events)) {
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = name;
  b.addEventListener("click", () => Sound.play(name));
  document.getElementById("buttons").append(b);
}
