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

// Frost in stone is a two-material discovery: ice frosts only masonry that holds water, so the
// note must fire for a wetted rock and stay silent for a dry one. Each scene gets its own
// journal, since a note fired anywhere starts the 45-second cooldown for all of them.
const frostScene = ({ pour, sampleFrom }) => {
  const u = w.universe_new(W, H, 11);
  const p = (x, y, r, m, d = 100) => w.universe_paint(u, x, y, r, m, d);
  const view = () => new Uint8Array(w.memory.buffer, w.universe_cells_ptr(u), w.universe_cells_byte_len(u));
  for (let x = 0; x < W; x++) p(x, 30, 1, M.Wall);
  p(30, 25, 4, M.Stone);
  const j = new FieldNoteJournal();
  let now = 100_000, note = null;
  for (let t = 1; t <= 900 && !note; t++) {
    if (pour && t === 20) p(30, 16, 4, M.Water, 55);
    if (t === 60) p(23, 25, 4, M.Ice);
    w.universe_tick(u);
    now += 16;
    if (t >= sampleFrom && t % 30 === 0) note = j.sample(view(), now, W, H);
  }
  w.universe_free(u);
  return note;
};
const wetNote = frostScene({ pour: true, sampleFrom: 0 });
if (!wetNote || wetNote.id !== "ice.stresses") {
  throw new Error(`ice against a wetted rock should say the cold found the water; got ${wetNote ? wetNote.id : "nothing"}`);
}
const dryNote = frostScene({ pour: false, sampleFrom: 0 });
if (dryNote) throw new Error(`a dry rock against ice fired "${dryNote.id}" — dry stone must not frost, and nothing else happens here`);
// A scene that was already frosted when the session began is not a discovery: the journal's
// first sample is a baseline, so frost that is simply still there must not announce itself.
const restoredNote = frostScene({ pour: true, sampleFrom: 600 });
if (restoredNote) throw new Error(`frost that was already in the stone when sampling began fired "${restoredNote.id}"`);

// The same promise for a scene loaded or imported MID-session, which keeps the journal: the
// app calls rebaseline() after the swap. Without it, frost already in the loaded scene reads
// as a rise against the scene it replaced. The control proves this case reaches that problem.
const boardAt = ({ pour, ticks }) => {
  const u = w.universe_new(W, H, 11);
  const p = (x, y, r, m, d = 100) => w.universe_paint(u, x, y, r, m, d);
  for (let x = 0; x < W; x++) p(x, 30, 1, M.Wall);
  p(30, 25, 4, M.Stone);
  for (let t = 1; t <= ticks; t++) {
    if (pour && t === 20) p(30, 16, 4, M.Water, 55);
    if (t === 60) p(23, 25, 4, M.Ice);
    w.universe_tick(u);
  }
  const bytes = new Uint8Array(w.memory.buffer, w.universe_cells_ptr(u), w.universe_cells_byte_len(u)).slice();
  w.universe_free(u);
  return bytes;
};
const bareRock = boardAt({ pour: false, ticks: 10 }), frostedRock = boardAt({ pour: true, ticks: 600 });
const loadMidSession = (rebaseline) => {
  const j = new FieldNoteJournal();
  let now = 100_000;
  j.sample(bareRock, (now += 500), W, H);
  j.sample(bareRock, (now += 500), W, H);
  if (rebaseline) j.rebaseline();
  return j.sample(frostedRock, (now += 500), W, H) ?? j.sample(frostedRock, (now += 500), W, H);
};
if (!loadMidSession(false)) {
  throw new Error("the mid-session load control fired no note, so the rebaseline case below proves nothing");
}
const loadedNote = loadMidSession(true);
if (loadedNote) throw new Error(`a loaded scene's existing frost fired "${loadedNote.id}" after rebaseline()`);

console.log(`Field note smoke passed: a chilled spring says "${fired.text}"; a wetted rock against ice says "${wetNote.text}", a dry one says nothing`);
