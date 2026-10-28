// Audio levels gate: renders the real mixer, beds and cues offline in headless Chrome and
// checks the mix is a level a player can hear, the rooms change what is heard, the cues are
// heard over the beds, and no cue clicks.
//
// Until 2026-10-28 none of that held, and nothing measured it: the mix sat at -41 dBFS RMS at
// the default sliders, about 20 dB under Desk Radio; 33 of 36 background beds sat 20 dB or
// more under the featured one, so a room's ambience profile changed the mix by 0.1 dB; the
// cues sat 13-20 dB under the beds, painting oil 14 dB under the rest; and a noise voice let
// its first sample through at full gain, a click on about half of all cues, up to -3 dBFS;
// painting rockets or a wellspring made no sound at all; and a fire bed's pops would have
// reached +1.4 dBFS at full sliders once made up, past what the limiter alone catches.
//
// Loudness is K-weighted (BS.1770's pre-filter, as two biquads), so an 80 Hz thump and a
// 1.5 kHz chirp are compared as heard. Usage: npm run audio:levels
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { assert, connectToFirstPage, evaluate, sleep, startBrowser } from "./browser-qa-helpers.mjs";

const repoRoot = resolve(import.meta.dirname, "..");
const appRequire = createRequire(resolve(repoRoot, "app/package.json"));
const { createServer } = await import(pathToFileURL(appRequire.resolve("vite")).href);

// Default sliders, the featured bed of each mood in the default room.
const MIX_RMS_DB = [-30, -22];
// Full sliders, the room with the most beds in it, cues throughout: nothing reaches 0 dBFS.
const MAX_PEAK_DB = -0.3;
// A bed a room scales by at least this much belongs in that room, and must be heard there.
const BELONGS_SCALE = 0.5;
const BELONGS_UNDER_LEAD_DB = 20;
// Cues: each group within this span, every cue within this far under the default rain bed,
// and no cue's loudest sample this far above its own loudness (a click).
const CUE_SPAN_DB = 7;
const CUE_UNDER_BED_DB = 10;
const CUE_CREST_DB = 24;

const PAGE = String.raw`(async () => {
const RATE = 48000;
const assets = await import("/src/audio/assets.ts");
const { AUDIO_MOODS } = await import("/src/audio/moods.ts");
const { ROOM_AMBIENCE_DEFS } = await import("/src/audio/rooms.ts");
const { createAudioMixer, applyMixerPreferences } = await import("/src/audio/mixer.ts");
const { startNativeAmbience } = await import("/src/audio/ambience.ts");
const { DEFAULT_AUDIO_PREFS } = await import("/src/audio/preferences.ts");
const { DEFAULT_AUDIO_ROOM } = await import("/src/audio/rooms.ts");
const cues = await import("/src/audio/cues.ts");
const { REACTION_CUES } = await import("/src/audio/reactions.ts");
const { MATERIAL } = await import("/src/materials.ts");
const db = (v) => 20 * Math.log10(Math.max(v, 1e-9));
const rms = (d, from = 0) => { let t = 0; for (let i = from; i < d.length; i++) t += d[i] * d[i]; return Math.sqrt(t / (d.length - from)); };
// Every render is stereo and measured on its left channel, as one ear hears it: a mono render
// downmixes the stereo rain bed and reads it ~3 dB low against the mono purr.
const peakOf = (d, from = 0) => { let p = 0; for (let i = from; i < d.length; i++) p = Math.max(p, Math.abs(d[i])); return p; };
async function kWeight(data) {
  const off = new OfflineAudioContext(1, data.length, RATE);
  const b = off.createBuffer(1, data.length, RATE); b.copyToChannel(data, 0);
  const src = off.createBufferSource(); src.buffer = b;
  const hp = off.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 38; hp.Q.value = 0.5;
  const sh = off.createBiquadFilter(); sh.type = "highshelf"; sh.frequency.value = 1500; sh.gain.value = 4;
  src.connect(hp); hp.connect(sh); sh.connect(off.destination); src.start();
  return (await off.startRendering()).getChannelData(0);
}
// The beds of one mood in one room, as startNativeAmbience builds them (gain, filter, buffer),
// read back through the app's own start probe once every load has landed.
async function bedsOf(mood, room) {
  window.__cozyNativeAmbienceProbe = { starts: [] };
  const handle = startNativeAmbience(createAudioMixer(new OfflineAudioContext(1, RATE, RATE)), mood, room);
  for (let i = 0; i < 200 && window.__cozyNativeAmbienceProbe.starts.length < 3; i++) await new Promise((r) => setTimeout(r, 25));
  handle.stop();
  return window.__cozyNativeAmbienceProbe.starts;
}
async function bedLevel(start) {
  const off = new OfflineAudioContext(2, RATE * 6, RATE);
  const src = off.createBufferSource(); src.buffer = start.buffer;
  const f = off.createBiquadFilter(); f.type = start.filterType; f.frequency.value = start.filterFrequency; f.Q.value = start.filterQ;
  const g = off.createGain(); g.gain.value = start.gain;
  src.connect(f); f.connect(g); g.connect(off.destination); src.start(0, 30);
  return db(rms(await kWeight((await off.startRendering()).getChannelData(0)), RATE));
}
// Full sliders, both channels: the beds alone over a whole loop of the longest one, then again
// with a paint cue every 95 ms and a reaction cue every 280 ms (the controller's throttles) for
// three seconds around the beds' loudest moment. That is the loudest the mix can be.
async function loudestOf(mood, room) {
  const seconds = Math.ceil(Math.max(...(await bedsOf(mood, room)).map((b) => b.duration)));
  const loudest = async (cuesFrom, cuesTo) => {
    const off = new OfflineAudioContext(2, RATE * seconds, RATE);
    const audio = createAudioMixer(off);
    applyMixerPreferences(audio, { ...DEFAULT_AUDIO_PREFS, enabled: true, volumes: { master: 1, ambience: 1 } });
    startNativeAmbience(audio, mood, room);
    const materials = Object.values(MATERIAL);
    for (let t = cuesFrom, k = 0; t < cuesTo; t += 0.095, k++) cues.playMaterialPaintCue(audio, materials[k % materials.length], t);
    for (let t = cuesFrom, k = 0; t < cuesTo; t += 0.28, k++) cues.playReactionCue(audio, REACTION_CUES[k % REACTION_CUES.length], t);
    await new Promise((r) => setTimeout(r, 300));
    const rendered = await off.startRendering();
    let peak = 0, at = 0;
    for (let c = 0; c < 2; c++) {
      const d = rendered.getChannelData(c);
      for (let i = RATE; i < d.length; i++) if (Math.abs(d[i]) > peak) { peak = Math.abs(d[i]); at = i / RATE; }
    }
    return { peak: db(peak), at };
  };
  const beds = await loudest(0, 0);
  const withCues = await loudest(Math.max(1, beds.at - 1.5), Math.min(seconds - 0.2, beds.at + 1.5));
  return { seconds, bedsPeak: beds.peak, peak: Math.max(beds.peak, withCues.peak) };
}
async function mixOf(mood, room, volumes) {
  await bedsOf(mood, room);
  const off = new OfflineAudioContext(2, RATE * 10, RATE);
  const audio = createAudioMixer(off);
  applyMixerPreferences(audio, { ...DEFAULT_AUDIO_PREFS, enabled: true, volumes });
  startNativeAmbience(audio, mood, room);
  await new Promise((r) => setTimeout(r, 300));
  const d = (await off.startRendering()).getChannelData(0);
  return { rms: db(rms(d, RATE * 3)), k: db(rms(await kWeight(d), RATE * 3)), peak: db(peakOf(d, RATE * 3)) };
}
// A cue at the times live play schedules one: a render quantum plus 5 ms, rarely a whole frame,
// once the master has settled from its start at 1 to the default slider (a 55 ms glide).
async function cueOf(play) {
  let loud = 0, peak = -Infinity;
  for (let rep = 0; rep < 4; rep++) {
    const off = new OfflineAudioContext(2, RATE, RATE);
    const audio = createAudioMixer(off);
    applyMixerPreferences(audio, { ...DEFAULT_AUDIO_PREFS, enabled: true });
    play(audio, 0.4 + ((rep * 37 + 5) * 128) / RATE + 0.005);
    const d = (await off.startRendering()).getChannelData(0);
    peak = Math.max(peak, db(peakOf(d)));
    const k = await kWeight(d), W = RATE / 20;
    let most = 0;
    for (let i = 0; i + W <= k.length; i += W / 2) { let t = 0; for (let j = i; j < i + W; j++) t += k[j] * k[j]; most = Math.max(most, Math.sqrt(t / W)); }
    loud += db(most) / 4;
  }
  return { loud, peak };
}

const out = { rooms: [], mixes: {}, max: {}, paint: {}, reactions: {} };
for (const room of ROOM_AMBIENCE_DEFS) for (const mood of AUDIO_MOODS) {
  const levels = {};
  for (const start of await bedsOf(mood.id, room.id)) levels[start.id] = await bedLevel(start);
  const bed = { rain: "rainFall", purr: "catPurr", fire: "fireCrackle" };
  const scale = { rain: room.rainGainScale, purr: room.purrGainScale, fire: room.fireGainScale };
  for (const other of Object.keys(bed)) {
    if (other === mood.id) continue;
    out.rooms.push({ room: room.id, mood: mood.id, bed: other, scale: scale[other], under: levels[bed[mood.id]] - (levels[bed[other]] ?? -Infinity) });
  }
}
for (const mood of AUDIO_MOODS) {
  out.mixes[mood.id] = await mixOf(mood.id, DEFAULT_AUDIO_ROOM, DEFAULT_AUDIO_PREFS.volumes);
  out.max[mood.id] = await loudestOf(mood.id, "cozy-fireplace");
}
// Every material a player can paint, and the eraser, has a cue; generated-only ones need none.
const { MATERIALS } = await import("/src/materials.ts");
const paintable = [["Eraser", MATERIAL.Empty], ...MATERIALS.filter((m) => m.userSelectable !== false && m.id !== MATERIAL.Empty).map((m) => [m.label, m.id])];
for (const [name, id] of paintable) out.paint[name] = await cueOf((audio, t) => cues.playMaterialPaintCue(audio, id, t));
for (const cue of REACTION_CUES) out.reactions[cue] = await cueOf((audio, t) => cues.playReactionCue(audio, cue, t));
return out;
})()`;

const server = await createServer({ root: resolve(repoRoot, "app"), logLevel: "error", server: { port: 0, strictPort: false } });
await server.listen();
const browser = await startBrowser();
const failures = [];
try {
  const cdp = await connectToFirstPage(browser.debugPort);
  await cdp.send("Page.enable");
  await cdp.send("Page.navigate", { url: server.resolvedUrls.local[0] });
  await sleep(2000);
  const result = await evaluate(cdp, PAGE);
  await cdp.close();
  const fmt = (v) => v.toFixed(1);
  const check = (ok, message) => { if (!ok) failures.push(message); };

  for (const [mood, m] of Object.entries(result.mixes)) {
    console.log(`mix ${mood.padEnd(5)} default sliders  rms ${fmt(m.rms)} dBFS  (K ${fmt(m.k)})  peak ${fmt(m.peak)}`);
    check(m.rms >= MIX_RMS_DB[0] && m.rms <= MIX_RMS_DB[1], `${mood} mix at default sliders is ${fmt(m.rms)} dBFS RMS, outside ${MIX_RMS_DB.join(" to ")}`);
  }
  for (const [mood, m] of Object.entries(result.max)) {
    console.log(`mix ${mood.padEnd(5)} full sliders, ${m.seconds} s loop: beds peak ${fmt(m.bedsPeak)} dBFS, with cues over their loudest moment ${fmt(m.peak)}`);
    check(m.peak <= MAX_PEAK_DB, `${mood} mix at full sliders peaks at ${fmt(m.peak)} dBFS, above ${MAX_PEAK_DB}`);
  }
  const belongs = result.rooms.filter((r) => r.scale >= BELONGS_SCALE);
  for (const r of belongs) {
    check(r.under <= BELONGS_UNDER_LEAD_DB, `${r.bed} in ${r.room} (scale ${r.scale}) sits ${fmt(r.under)} dB under the ${r.mood} lead, past ${BELONGS_UNDER_LEAD_DB}`);
  }
  console.log(`room beds that belong (scale >= ${BELONGS_SCALE}): ${belongs.length}, ${fmt(Math.min(...belongs.map((r) => r.under)))} to ${fmt(Math.max(...belongs.map((r) => r.under)))} dB under the lead`);

  const bedK = result.mixes.rain.k;
  for (const [group, levels] of [["paint", result.paint], ["reaction", result.reactions]]) {
    const louds = Object.values(levels).map((l) => l.loud);
    const span = Math.max(...louds) - Math.min(...louds);
    console.log(`${group} cues: ${louds.length}, loudness ${fmt(Math.min(...louds))} to ${fmt(Math.max(...louds))} (span ${fmt(span)} dB) against the rain bed's ${fmt(bedK)}`);
    check(span <= CUE_SPAN_DB, `${group} cues span ${fmt(span)} dB of loudness, past ${CUE_SPAN_DB}`);
    for (const [name, l] of Object.entries(levels)) {
      check(l.peak > -150, `${group} cue ${name} is silent`);
      check(l.loud >= bedK - CUE_UNDER_BED_DB, `${group} cue ${name} is ${fmt(bedK - l.loud)} dB under the rain bed, past ${CUE_UNDER_BED_DB}`);
      check(l.peak - l.loud <= CUE_CREST_DB, `${group} cue ${name} peaks ${fmt(l.peak - l.loud)} dB over its loudness (a click), past ${CUE_CREST_DB}`);
    }
  }
} finally {
  await browser.close();
  await server.close();
}
assert(failures.length === 0, `Audio levels FAILED (${failures.length}):\n  - ${failures.join("\n  - ")}`);
console.log("Audio levels passed");
