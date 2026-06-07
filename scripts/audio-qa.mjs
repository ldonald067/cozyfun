import { createRequire } from "node:module";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = path.join(root, ".tmp", "audio-qa");
const sampleRate = 44_100;
const durationSeconds = 32;

await main();

async function main() {
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });
  const { moods, rooms, scenes } = await loadSourceModules();
  const moodRenders = [];
  for (const mood of moods) moodRenders.push(await renderMoodAmbience(mood, rooms[0]));

  const roomAmbienceRenders = [];
  for (const scene of scenes) {
    const mood = moods.find((candidate) => candidate.id === scene.mood) ?? moods[0];
    const room = rooms.find((candidate) => candidate.id === scene.id) ?? rooms[0];
    roomAmbienceRenders.push(await renderRoomAmbience(scene, mood, room));
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    sampleRate,
    durationSeconds,
    note: "Deterministic offline reference for judging generated room tone, fallback ambience, and material cues. Browser checks verify local OGG ambience assets and Web Audio routing separately.",
    moodRenders,
    roomAmbienceRenders
  };
  const manifestPath = path.join(outputDir, "audio-qa.json");
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log("Audio QA renders written:");
  for (const render of moodRenders) console.log(`- ${render.file}`);
  for (const render of roomAmbienceRenders) console.log(`- ${render.file}`);
  console.log(`- ${manifestPath}`);
}

async function loadSourceModules() {
  const moodsModule = await loadTsModule(path.join(root, "app", "src", "audio", "moods.ts"), "moods.generated.mjs");
  const roomsModule = await loadTsModule(path.join(root, "app", "src", "audio", "rooms.ts"), "rooms.generated.mjs");
  const scenesModule = await loadTsModule(path.join(root, "app", "src", "sceneEnvironments.ts"), "scene-environments.generated.mjs");
  return {
    moods: moodsModule.AUDIO_MOODS,
    rooms: roomsModule.ROOM_AMBIENCE_DEFS,
    scenes: scenesModule.SCENE_ENVIRONMENTS
  };
}

async function loadTsModule(sourcePath, fileName) {
  const requireFromApp = createRequire(path.join(root, "app", "package.json"));
  const ts = requireFromApp("typescript");
  const source = await readFile(sourcePath, "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2020,
      verbatimModuleSyntax: false
    }
  }).outputText;
  const modulePath = path.join(outputDir, fileName);
  await writeFile(modulePath, transpiled);
  return import(`${pathToFileURL(modulePath).href}?t=${Date.now()}`);
}

async function renderMoodAmbience(mood, room) {
  const samples = new Float32Array(sampleRate * durationSeconds);
  const rng = mulberry32(hashText(`mood:${mood.id}`));
  addAmbience(samples, mood, room, rng);
  addScheduledAccents(samples, mood, room, rng);
  addMaterialCuePreview(samples, rng);
  applyFade(samples, 0.35);
  const peak = normalize(samples, 0.92);
  const file = path.join(outputDir, `${mood.id}-ambience-reference.wav`);
  await writeFile(file, wavBuffer(samples));
  return {
    mood: mood.id,
    title: mood.title,
    file,
    peakBeforeNormalize: Number(peak.toFixed(4)),
    rainGain: mood.ambience.rainGain,
    creekGain: mood.ambience.creekGain,
    thunderGain: mood.ambience.thunderGain,
    fireCrackleGain: mood.ambience.fireCrackleGain
  };
}

async function renderRoomAmbience(scene, mood, room) {
  const samples = new Float32Array(sampleRate * durationSeconds);
  const rng = mulberry32(hashText(`room:${scene.id}`));
  addAmbience(samples, mood, room, rng);
  addScheduledAccents(samples, mood, room, rng);
  applyFade(samples, 0.35);
  const peak = normalize(samples, 0.92);
  const file = path.join(outputDir, `${scene.id}-room-reference.wav`);
  await writeFile(file, wavBuffer(samples));
  return {
    room: scene.id,
    title: scene.title,
    mood: mood.id,
    file,
    peakBeforeNormalize: Number(peak.toFixed(4)),
    rainGainScale: room.rainGainScale,
    creekGainScale: room.creekGainScale,
    thunderGainScale: room.thunderGainScale,
    fireGainScale: room.fireGainScale
  };
}

function addAmbience(samples, mood, room, rng) {
  const ambience = mood.ambience;
  let hush = 0;
  let creek = 0;
  let fire = 0;
  let air = 0;
  let warm = 0;
  let rainLast = 0;
  for (let i = 0; i < samples.length; i++) {
    const t = i / sampleRate;
    const white = rng() * 2 - 1;
    const rain = white - rainLast * 0.62;
    rainLast = white;
    hush = hush * 0.996 + white * 0.004;
    creek = creek * 0.985 + white * 0.015;
    fire = fire * 0.94 + white * 0.06;
    air = air * 0.986 + white * 0.014;
    warm = warm * 0.998 + white * 0.002;

    const airTexture = room.airType === "highpass" ? white - air * 0.8 : white * 0.42 + air * 0.58;
    samples[i] += rain * ambience.rainGain * room.rainGainScale * 0.12;
    samples[i] += creek * ambience.creekGain * room.creekGainScale * 0.62;
    samples[i] += fire * ambience.fireGain * room.fireGainScale * 0.7;
    samples[i] += hush * ambience.hushGain * room.hushGainScale * 0.55;
    samples[i] += airTexture * room.airGain * 0.48;
    samples[i] += warm * room.warmGain * 0.82;
    samples[i] += Math.sin(Math.PI * 2 * Math.max(32, ambience.humFrequency + room.humFrequencyOffset) * t) * ambience.humGain * room.humGainScale * 0.35;
  }
}

function addScheduledAccents(samples, mood, room, rng) {
  const ambience = mood.ambience;
  scheduleAccent(samples, ambience.dripGain * room.dripGainScale, ambience.dripMs * room.dripMsScale, rng, addDrip);
  scheduleAccent(samples, ambience.creekBurbleGain * room.creekBurbleGainScale, ambience.creekBurbleMs * room.creekBurbleMsScale, rng, addCreekBurble);
  scheduleAccent(samples, ambience.thunderGain * room.thunderGainScale, ambience.thunderMs * room.thunderMsScale, rng, addThunder);
  scheduleAccent(samples, ambience.fireCrackleGain * room.fireCrackleGainScale, ambience.fireCrackleMs * room.fireCrackleMsScale, rng, addFireCrackle);
}

function scheduleAccent(samples, gain, intervalMs, rng, addAccent) {
  if (gain <= 0 || intervalMs <= 0) return;
  let time = Math.min(durationSeconds * 0.35, (intervalMs / 1000) * (0.42 + rng() * 0.26));
  while (time < durationSeconds) {
    addAccent(samples, time, gain, rng);
    time += (intervalMs / 1000) * (0.62 + rng() * 0.76);
  }
}

function addDrip(samples, time, gain) {
  addTone(samples, time, 0.24, 880, 720, gain, "sine");
  addTone(samples, time + 0.035, 0.2, 660, 540, gain * 0.52, "sine");
}

function addCreekBurble(samples, time, gain, rng) {
  addNoiseBurst(samples, time, 0.24, gain * 0.65, 640, rng);
  addTone(samples, time + 0.03, 0.16, 420, 560, gain * 0.58, "sine");
  addTone(samples, time + 0.11, 0.14, 690, 520, gain * 0.38, "triangle");
}

function addThunder(samples, time, gain, rng) {
  addNoiseBurst(samples, time, 1.8, gain, 120, rng, 0.18, 1.1);
  addTone(samples, time + 0.04, 1.55, 48, 34, gain * 0.36, "sine", 0.18, 1.1);
}

function addFireCrackle(samples, time, gain, rng) {
  const hits = 2 + Math.floor(rng() * 3);
  for (let i = 0; i < hits; i++) {
    addNoiseBurst(samples, time + i * (0.028 + rng() * 0.018), 0.035 + rng() * 0.04, gain * (1 - i * 0.12), 1500 + rng() * 1500, rng);
  }
}

function addMaterialCuePreview(samples, rng) {
  addCreekBurble(samples, 8.2, 0.0045, rng);
  addFireCrackle(samples, 14.5, 0.005, rng);
  addTone(samples, 20.1, 0.16, 780, 980, 0.003, "triangle");
}

function addTone(samples, time, duration, frequency, endFrequency, gain, waveform, attack = 0.018, release = 0.12) {
  const start = Math.max(0, Math.floor(time * sampleRate));
  const length = Math.min(samples.length - start, Math.floor((duration + release) * sampleRate));
  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    const progress = Math.min(1, t / Math.max(0.001, duration));
    const freq = frequency * Math.pow(endFrequency / frequency, progress);
    const phase = Math.PI * 2 * freq * t;
    samples[start + i] += wave(phase, waveform) * envelope(t, duration, attack, release) * gain;
  }
}

function addNoiseBurst(samples, time, duration, gain, filter, rng, attack = 0.012, release = 0.18) {
  const start = Math.max(0, Math.floor(time * sampleRate));
  const length = Math.min(samples.length - start, Math.floor((duration + release) * sampleRate));
  let smooth = 0;
  const smoothing = filter < 300 ? 0.995 : filter < 900 ? 0.985 : 0.94;
  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    smooth = smooth * smoothing + (rng() * 2 - 1) * (1 - smoothing);
    samples[start + i] += smooth * envelope(t, duration, attack, release) * gain;
  }
}

function envelope(t, duration, attack, release) {
  if (t < attack) return t / Math.max(0.001, attack);
  if (t > duration) return Math.max(0, 1 - (t - duration) / Math.max(0.001, release));
  return 1;
}

function wave(phase, type) {
  if (type === "triangle") return (2 / Math.PI) * Math.asin(Math.sin(phase));
  return Math.sin(phase);
}

function applyFade(samples, seconds) {
  const count = Math.min(samples.length, Math.floor(seconds * sampleRate));
  for (let i = 0; i < count; i++) {
    const fade = i / count;
    samples[i] *= fade;
    samples[samples.length - 1 - i] *= fade;
  }
}

function normalize(samples, target) {
  let peak = 0;
  for (const sample of samples) peak = Math.max(peak, Math.abs(sample));
  if (peak <= target) return peak;
  const scale = target / peak;
  for (let i = 0; i < samples.length; i++) samples[i] *= scale;
  return peak;
}

function wavBuffer(samples) {
  const bytes = Buffer.alloc(44 + samples.length * 2);
  bytes.write("RIFF", 0);
  bytes.writeUInt32LE(36 + samples.length * 2, 4);
  bytes.write("WAVE", 8);
  bytes.write("fmt ", 12);
  bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20);
  bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(sampleRate, 24);
  bytes.writeUInt32LE(sampleRate * 2, 28);
  bytes.writeUInt16LE(2, 32);
  bytes.writeUInt16LE(16, 34);
  bytes.write("data", 36);
  bytes.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i++) {
    const value = Math.max(-1, Math.min(1, samples[i]));
    bytes.writeInt16LE(Math.round(value * 32767), 44 + i * 2);
  }
  return bytes;
}

function hashText(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
