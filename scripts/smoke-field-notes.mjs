// Field notes are the game's only "you found something" channel, and one of them now TEACHES
// rather than observes: a chilled wellspring can be re-taught, and nothing in play suggests
// trying it. This drives the REAL sim into that state from painted materials only -- the same
// bar the interaction audit holds -- and asserts the note fires. A note that cannot fire is
// worse than no note, because the rule it was meant to teach then has no channel at all.
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { compileApp } from "./compile-app.mjs";

const root = resolve(import.meta.dirname, "..");
const app = compileApp("field-notes-cjs", ["fieldNotes.ts", "materials.ts"]);
const { FieldNoteJournal } = app.load("fieldNotes");
// Material ids from the compiled source, never a hand-typed copy.
const { MATERIAL: M } = app.load("materials");

// localStorage does not exist in node; the journal already tolerates it throwing, but the
// ledger has to stay empty or every note would read as already witnessed.
globalThis.localStorage = {
  getItem: () => null,
  setItem: () => {},
};

const wasm = await WebAssembly.instantiate(
  await readFile(resolve(root, "app/public/sim/cozy_sandbox_sim.wasm")), {});
const w = wasm.instance.exports;
const W = 60, H = 40;

const uni = w.universe_new(W, H, 7);
const paint = (x, y, r, m) => w.universe_paint(uni, x, y, r, m, 100);
const cells = () => new Uint8Array(w.memory.buffer, w.universe_cells_ptr(uni), w.universe_cells_byte_len(uni));

// Painted materials only, exactly what a player does: a spring, water to teach it, then ice.
for (let x = 0; x < W; x++) paint(x, 30, 1, M.Wall);
paint(30, 26, 1, M.Wellspring);
paint(30, 22, 1, M.Water);

const journal = new FieldNoteJournal();
let clock = 100_000;                       // clear of NOTE_COOLDOWN_MS from the epoch
const step = (ticks) => {
  for (let t = 0; t < ticks; t++) {
    w.universe_tick(uni);
    clock += 16;
    const note = journal.sample(cells(), clock, W, H);
    if (note) return note;
  }
  return null;
};

const beforeIce = step(600);               // it attunes and pools; no spring note yet
if (beforeIce && beforeIce.id === "wellspring.listens") {
  throw new Error("the listening note fired with no ice on the board — it is not detecting a chill");
}
// The pouring spring throws mist, and there is no fire anywhere in this scene. The steam
// note's line is about fire and water, so it must stay silent here — it once would not,
// spending a once-ever note on something that did not happen and starting a 45-second
// cooldown that silenced the spring's own note right after.
if (beforeIce && beforeIce.id === "steam.rises") {
  throw new Error("the steam note ('fire and water argue') fired on mist from a spring with no fire on the board");
}
paint(26, 26, 2, M.Ice);                   // the player sets ice against it
let fired = null;
for (let i = 0; i < 40 && !fired; i++) {
  const note = step(30);
  if (note && note.id === "wellspring.listens") fired = note;
}
w.universe_free(uni);

if (!fired) {
  throw new Error(
    "a chilled wellspring produced no field note, so the only channel that teaches " +
    "re-attunement is silent. Check aSpringIsListening against the sim's own ice test.");
}
console.log(`Field note smoke passed: a chilled spring says "${fired.text}"`);
