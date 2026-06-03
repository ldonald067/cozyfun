import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = path.join(root, ".tmp", "audio-qa");
const sampleRate = 44_100;
const durationSeconds = 32;
const melodyPhrases = [
  [-1, 2, -1, 3, 4, -1, 3, -1, -1, 2, 1, -1, 2, -1, -1, -1],
  [-1, -1, 3, -1, 4, 3, -1, 2, -1, -1, 1, -1, 2, 3, -1, -1],
  [-1, 2, -1, -1, 3, -1, 4, -1, 3, -1, 2, -1, -1, 1, -1, -1],
  [-1, -1, 4, 3, -1, 2, -1, -1, -1, 3, -1, 2, 1, -1, -1, -1],
  [-1, 1, -1, -1, 3, -1, 2, -1, 4, -1, -1, 3, -1, 2, -1, -1],
  [-1, -1, 2, 3, -1, -1, 4, -1, -1, 3, -1, -1, 2, 1, -1, -1],
  [-1, 3, -1, 4, -1, 3, -1, -1, 2, -1, 1, -1, -1, 2, -1, -1],
  [-1, -1, -1, 2, -1, 4, 3, -1, -1, 1, -1, 2, -1, -1, 3, -1]
];
const semitone = Math.pow(2, 1 / 12);

await main();

async function main() {
  await mkdir(outputDir, { recursive: true });
  const { moods, rooms, scenes } = await loadSourceModules();
  const renders = [];
  for (const mood of moods) {
    renders.push(await renderMood(mood, rooms[0]));
  }
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
    note: "Deterministic offline reference for judging generated lo-fi and room ambience direction. Browser Web Audio routing is tested separately.",
    renders,
    roomAmbienceRenders
  };
  const manifestPath = path.join(outputDir, "audio-qa.json");
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log("Audio QA renders written:");
  for (const render of renders) console.log(`- ${render.file}`);
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
  const moduleUrl = `${pathToFileURL(modulePath).href}?t=${Date.now()}`;
  return import(moduleUrl);
}

async function renderMood(mood, room) {
  const samples = new Float32Array(sampleRate * durationSeconds);
  const rng = mulberry32(hashText(mood.id));
  const music = mood.music;
  addBackground(samples, mood, room, rng, true);

  const stepSeconds = music.stepMs / 1000;
  const stepCount = Math.ceil(durationSeconds / stepSeconds) + 2;
  const seed = hashText(mood.id);
  for (let step = 0; step < stepCount; step++) {
    scheduleStep(samples, music, step, step * stepSeconds, seed);
  }

  applyFade(samples, 0.35);
  const peak = normalize(samples, 0.92);
  const file = path.join(outputDir, `${mood.id}-lofi-reference.wav`);
  await writeFile(file, wavBuffer(samples));
  return {
    mood: mood.id,
    title: mood.title,
    file,
    peakBeforeNormalize: Number(peak.toFixed(4)),
    stepMs: music.stepMs,
    stepRateBpm: Math.round(60000 / music.stepMs),
    swing: music.swing,
    chordCount: music.progression.length,
    hasBrushFills: music.fillGain > 0,
    hasTextureLayer: music.textureGain > 0,
    grooveGain: music.grooveGain,
    colorGain: music.colorGain,
    phraseGain: music.phraseGain
  };
}

async function renderRoomAmbience(scene, mood, room) {
  const samples = new Float32Array(sampleRate * durationSeconds);
  const rng = mulberry32(hashText(`room:${scene.id}`));
  addBackground(samples, mood, room, rng, false);
  addRoomAccents(samples, room, rng);

  applyFade(samples, 0.35);
  const peak = normalize(samples, 0.92);
  const file = path.join(outputDir, `${scene.id}-ambience-reference.wav`);
  await writeFile(file, wavBuffer(samples));
  return {
    room: scene.id,
    title: scene.title,
    mood: mood.id,
    file,
    peakBeforeNormalize: Number(peak.toFixed(4)),
    rainGainScale: room.rainGainScale,
    hushGainScale: room.hushGainScale,
    airGain: room.airGain,
    warmGain: room.warmGain,
    hasSparseAccents:
      room.gardenTickGain > 0 || room.starChimeGain > 0 || room.warmCrackleGain > 0 || room.branchRustleGain > 0 || room.snowTickGain > 0
  };
}

function addBackground(samples, mood, room, rng, includeVinyl) {
  const { ambience, music } = mood;
  let hush = 0;
  let rainLast = 0;
  let air = 0;
  let warm = 0;
  for (let i = 0; i < samples.length; i++) {
    const t = i / sampleRate;
    const white = rng() * 2 - 1;
    hush = hush * 0.996 + white * 0.004;
    air = air * 0.986 + white * 0.014;
    warm = warm * 0.998 + white * 0.002;
    const rain = white - rainLast * 0.62;
    const airTexture = room.airType === "highpass" ? white - air * 0.8 : white * 0.42 + air * 0.58;
    rainLast = white;
    samples[i] += rain * ambience.rainGain * room.rainGainScale * 0.12;
    samples[i] += hush * ambience.hushGain * room.hushGainScale * 0.55;
    samples[i] += airTexture * room.airGain * 0.48;
    samples[i] += warm * room.warmGain * 0.82;
    samples[i] += Math.sin(Math.PI * 2 * Math.max(32, ambience.humFrequency + room.humFrequencyOffset) * t) * ambience.humGain * room.humGainScale * 0.35;
    if (includeVinyl) {
      samples[i] += (rng() * 2 - 1) * music.vinylGain * 0.025;
      if (rng() < 0.000018) addDustPop(samples, i, music.vinylGain, rng);
    }
  }
}

function addRoomAccents(samples, room, rng) {
  scheduleRoomAccent(samples, room.gardenTickGain, room.gardenTickMs, rng, addGardenTick);
  scheduleRoomAccent(samples, room.starChimeGain, room.starChimeMs, rng, addStarChime);
  scheduleRoomAccent(samples, room.warmCrackleGain, room.warmCrackleMs, rng, addWarmCrackle);
  scheduleRoomAccent(samples, room.branchRustleGain, room.branchRustleMs, rng, addBranchRustle);
  scheduleRoomAccent(samples, room.snowTickGain, room.snowTickMs, rng, addSnowTick);
}

function scheduleRoomAccent(samples, gain, intervalMs, rng, addAccent) {
  if (gain <= 0 || intervalMs <= 0) return;
  let time = (intervalMs / 1000) * (0.45 + rng() * 0.25);
  while (time < durationSeconds) {
    addAccent(samples, time, gain);
    time += (intervalMs / 1000) * (0.65 + rng() * 0.7);
  }
}

function scheduleStep(samples, settings, step, baseTime, seed) {
  const swingDelay = step % 2 === 1 ? (settings.stepMs / 1000) * settings.swing : 0.012;
  const time = baseTime + swingDelay;
  const barStep = step % 8;
  const bar = Math.floor(step / 8);
  const phrase = Math.floor(step / 16);
  const chordIndex = Math.floor(step / 8) % settings.progression.length;
  const chord = settings.progression[chordIndex];
  const nextChord = settings.progression[(chordIndex + 1) % settings.progression.length];
  const chordAccent = 0.92 + stepRandom(step, seed + 1) * 0.16;

  if (barStep === 0) addChord(samples, settings, chord, time, chordAccent, 3.15);
  if (barStep === 2 && settings.colorGain > 0 && stepRandom(bar, seed + 2) > 0.52) {
    addColorAnswer(samples, settings, chord, nextChord, step, time + 0.018, 0.72);
  }
  if (barStep === 3 && step % 16 === 3) addChord(samples, settings, colorVoicing(chord, nextChord, step), time, 0.24, 0.82);
  if (barStep === 5) addChord(samples, settings, colorVoicing(chord, nextChord, step), time, 0.44 + settings.colorGain * 0.08, 1.45);
  if (barStep === 6 && settings.colorGain > 0 && phrase % 3 === 1) {
    addColorAnswer(samples, settings, nextChord, chord, step, time + 0.035, 0.54);
  }
  if (barStep === 7 && step % 32 === 31) addChord(samples, settings, nextChord, time, 0.22, 0.74);

  if (barStep % 2 === 0) addBass(samples, settings, chord, nextChord, barStep, time);
  if (barStep === 7 && settings.grooveGain > 0 && bar % 4 !== 0) addBassPickup(samples, settings, chord, nextChord, time);
  if (barStep === 0) addThump(samples, settings, time, 1);
  if (barStep === 2 && settings.grooveGain > 0 && (bar % 4 === 1 || stepRandom(bar, seed + 3) > 0.66)) {
    addThump(samples, settings, time + 0.018, 0.24 * settings.grooveGain, 70);
  }
  if (barStep === 6) addThump(samples, settings, time, 0.4);
  if (barStep === 7 && settings.grooveGain > 0 && bar % 8 === 3) addThump(samples, settings, time + 0.025, 0.18 * settings.grooveGain, 62);

  if (settings.brushGain > 0) {
    const hatAccent = step % 2 === 0 ? 0.42 : 0.82 + settings.grooveGain * 0.1;
    addNoiseBurst(samples, time, 0.042, settings.brushGain * hatAccent, "hat");
    if (settings.grooveGain > 0 && barStep === 1 && stepRandom(bar, seed + 4) > 0.42) addRimClick(samples, settings, time, 0.72);
    if (settings.grooveGain > 0 && barStep === 3 && stepRandom(step, seed + 5) > 0.72) addGhostSnare(samples, settings, time + 0.015, 0.48);
    if (barStep === 4) addNoiseBurst(samples, time, 0.12, settings.brushGain, "snare");
    if (settings.grooveGain > 0 && barStep === 5 && stepRandom(bar, seed + 6) > 0.58) addRimClick(samples, settings, time, 0.48);
    if (settings.grooveGain > 0 && barStep === 6 && stepRandom(step, seed + 7) > 0.74) addGhostSnare(samples, settings, time, 0.32);
    if (barStep === 7) addNoiseBurst(samples, time, 0.12, settings.brushGain * 0.32, "snare");
    if (settings.fillGain > 0 && step % 32 === 30) addBrushFill(samples, settings, time, settings.grooveGain > 0.65 ? 6 : 4);
    if (settings.grooveGain > 0 && barStep === 7 && bar % 8 === 7) addNoiseBurst(samples, time + 0.035, 0.11, settings.brushGain * settings.grooveGain * 0.42, "hat");
  }

  addMelody(samples, settings, chord, nextChord, step, time, seed);
  if (settings.sparkle && step % 12 === 7) {
    addTone(samples, time, 0.38, 880, 0.006, "sine", { attack: 0.018, release: 0.2 });
    addTone(samples, time + 0.04, 0.38, 1320, 0.006, "sine", { attack: 0.018, release: 0.2 });
  }
}

function addChord(samples, settings, frequencies, time, gainScale, duration) {
  const voiceGain = (settings.chordGain * gainScale * 0.95) / Math.sqrt(frequencies.length);
  frequencies.forEach((frequency, index) => {
    addTone(samples, time + index * 0.015, duration, frequency, voiceGain, index % 2 === 0 ? "triangle" : "sine", {
      attack: 0.045,
      release: 0.8,
      detuneCents: index * 2 - 4
    });
  });
  if (settings.textureGain > 0) {
    frequencies.slice(0, 3).forEach((frequency, index) => {
      addTone(samples, time + 0.02 + index * 0.018, Math.min(duration + 0.16, 3.4), frequency * 2, settings.textureGain * gainScale, "sine", {
        attack: 0.12,
        release: 0.9,
        detuneCents: index * 3 - 3
      });
    });
  }
}

function addColorAnswer(samples, settings, chord, nextChord, step, time, gainScale) {
  const notes = colorVoicing(chord, nextChord, step).slice(2, 5);
  notes.forEach((frequency, index) => {
    addTone(samples, time + index * 0.021, 0.72, liftToLeadRegister(frequency), settings.colorGain * 0.009 * gainScale, index % 2 === 0 ? "triangle" : "sine", {
      attack: 0.055,
      release: 0.55,
      detuneCents: index * 3 - 5
    });
  });
}

function addBass(samples, settings, chord, nextChord, barStep, time) {
  const root = bassRegister(chord[0]);
  const nextRoot = bassRegister(nextChord[0]);
  const frequency =
    barStep === 2
      ? bassRegister(chord[1] ?? root * 1.5)
      : barStep === 4
        ? bassRegister(chord[2] ?? root * 1.25)
        : barStep === 6
          ? approachNote(root, nextRoot)
          : root;
  addTone(samples, time, 0.5, frequency, settings.bassGain * 1.3, "triangle", { attack: 0.018, release: 0.24 });
}

function addBassPickup(samples, settings, chord, nextChord, time) {
  const current = bassRegister(chord[0]);
  const next = bassRegister(nextChord[0]);
  addTone(samples, time + 0.02, 0.28, approachNote(current, next), settings.bassGain * settings.grooveGain * 0.55, "triangle", {
    attack: 0.018,
    release: 0.22
  });
}

function addMelody(samples, settings, chord, nextChord, step, time, seed) {
  if (settings.melodyGain <= 0) return;
  const phraseIndex = (Math.floor(step / 16) + Math.floor(step / 64) + Math.floor(stepRandom(Math.floor(step / 16), seed + 8) * 3)) % melodyPhrases.length;
  const phrase = melodyPhrases[phraseIndex];
  const noteIndex = phrase[step % phrase.length];
  if (noteIndex < 0) return;
  if (settings.phraseGain > 0 && stepRandom(step, seed + 9) > 0.88 - settings.phraseGain * 0.18) return;
  const gainScale = 0.82 + stepRandom(step, seed + 10) * 0.26;
  const frequency = melodyFrequency(chord, noteIndex);
  addTone(samples, time, 0.5 + settings.phraseGain * 0.14, frequency, settings.melodyGain * gainScale * 1.5, "sine", {
    attack: 0.028,
    release: 0.3,
    vibrato: 3.5
  });
  if (settings.phraseGain > 0 && step % 8 >= 5 && stepRandom(step, seed + 11) > 0.72) {
    const answerIndex = Math.max(1, noteIndex - (stepRandom(step, seed + 12) > 0.5 ? 1 : 2));
    addTone(samples, time + 0.18, 0.34, melodyFrequency(nextChord, answerIndex), settings.melodyGain * settings.phraseGain * 0.86, "sine", {
      attack: 0.028,
      release: 0.28,
      vibrato: 3
    });
  }
  if (settings.phraseGain > 0.65 && stepRandom(step, seed + 13) > 0.84) {
    addTone(samples, time + 0.038, 0.24, frequency / semitone, settings.melodyGain * 0.42, "sine", {
      attack: 0.026,
      release: 0.24,
      vibrato: 2.2
    });
  }
}

function addThump(samples, settings, time, gainScale, startFrequency = 82) {
  const start = secondsToIndex(time);
  const end = Math.min(samples.length, start + secondsToIndex(0.24));
  for (let i = start; i < end; i++) {
    const elapsed = (i - start) / sampleRate;
    const t = elapsed / 0.24;
    const endFrequency = Math.max(42, startFrequency * 0.58);
    const frequency = startFrequency * Math.pow(endFrequency / startFrequency, Math.min(1, elapsed / 0.16));
    samples[i] += Math.sin(Math.PI * 2 * frequency * elapsed) * envelope(t, 0.05, 0.72) * settings.thumpGain * gainScale * 1.8;
  }
}

function addGhostSnare(samples, settings, time, gainScale) {
  addNoiseBurst(samples, time, 0.065, settings.brushGain * settings.grooveGain * gainScale, "snare");
}

function addRimClick(samples, settings, time, gainScale) {
  addNoiseBurst(samples, time, 0.028, settings.brushGain * settings.grooveGain * gainScale * 0.72, "rim");
  addTone(samples, time, 0.055, 760, settings.brushGain * settings.grooveGain * gainScale * 0.27, "triangle", {
    attack: 0.11,
    release: 0.58
  });
}

function addBrushFill(samples, settings, time, hits) {
  for (let i = 0; i < hits; i++) {
    addNoiseBurst(samples, time + i * 0.046, 0.052, settings.fillGain * (1 - i * 0.08), i % 2 === 0 ? "snare" : "hat");
  }
}

function addGardenTick(samples, time, gain) {
  addTone(samples, time, 0.18, 920, gain * 1.4, "sine", {
    attack: 0.08,
    release: 0.46,
    vibrato: 1.8
  });
  addTone(samples, time + 0.07, 0.14, 1240, gain * 0.74, "sine", {
    attack: 0.08,
    release: 0.44,
    vibrato: 1.2
  });
}

function addStarChime(samples, time, gain) {
  addTone(samples, time, 0.42, 1040, gain * 1.2, "sine", {
    attack: 0.045,
    release: 0.72,
    vibrato: 2.4
  });
  addTone(samples, time + 0.09, 0.36, 1320, gain * 0.7, "sine", {
    attack: 0.05,
    release: 0.72,
    vibrato: 1.6
  });
}

function addWarmCrackle(samples, time, gain) {
  for (let i = 0; i < 3; i++) {
    addNoiseBurst(samples, time + i * 0.035, 0.045, gain * (1 - i * 0.16), i % 2 === 0 ? "rim" : "hat");
  }
}

function addBranchRustle(samples, time, gain) {
  addNoiseBurst(samples, time, 0.36, gain, "snare");
}

function addSnowTick(samples, time, gain) {
  addTone(samples, time, 0.22, 720, gain * 1.1, "sine", {
    attack: 0.08,
    release: 0.64,
    vibrato: 0.6
  });
  addNoiseBurst(samples, time + 0.035, 0.11, gain * 0.42, "rim");
}

function addNoiseBurst(samples, time, duration, gain, color) {
  const rng = mulberry32(hashText(`${time}:${duration}:${gain}:${color}`));
  const start = secondsToIndex(time);
  const end = Math.min(samples.length, start + secondsToIndex(duration));
  let last = 0;
  for (let i = start; i < end; i++) {
    const t = (i - start) / Math.max(1, end - start);
    const white = rng() * 2 - 1;
    const filtered = color === "hat" ? white - last * 0.72 : color === "rim" ? white - last * 0.45 : white * 0.55 + last * 0.45;
    last = white;
    samples[i] += filtered * envelope(t, 0.16, 0.72) * gain * 1.9;
  }
}

function addDustPop(samples, startIndex, gain, rng) {
  const length = Math.floor(sampleRate * (0.012 + rng() * 0.03));
  const polarity = rng() > 0.5 ? 1 : -1;
  for (let i = 0; i < length && startIndex + i < samples.length; i++) {
    samples[startIndex + i] += polarity * (1 - i / length) * gain * 0.45;
  }
}

function addTone(samples, time, duration, frequency, gain, waveform, options = {}) {
  const start = secondsToIndex(time);
  const end = Math.min(samples.length, start + secondsToIndex(duration));
  const detune = Math.pow(2, (options.detuneCents ?? 0) / 1200);
  for (let i = start; i < end; i++) {
    const elapsed = (i - start) / sampleRate;
    const t = elapsed / duration;
    const vibrato = options.vibrato ? 1 + Math.sin(elapsed * Math.PI * 2 * 5.2) * (options.vibrato / 1200) : 1;
    const phase = Math.PI * 2 * frequency * detune * vibrato * elapsed;
    samples[i] += wave(phase, waveform) * envelope(t, options.attack ?? 0.08, options.release ?? 0.45) * gain;
  }
}

function envelope(t, attackFraction, releaseFraction) {
  if (t <= 0 || t >= 1) return 0;
  const attack = Math.max(0.001, attackFraction);
  const releaseStart = Math.max(attack, 1 - releaseFraction);
  if (t < attack) return Math.sin((t / attack) * Math.PI * 0.5);
  if (t > releaseStart) return Math.max(0, 1 - (t - releaseStart) / (1 - releaseStart));
  return 1;
}

function wave(phase, type) {
  if (type === "triangle") {
    const cycle = phase / (Math.PI * 2);
    return 2 * Math.abs(2 * (cycle - Math.floor(cycle + 0.5))) - 1;
  }
  return Math.sin(phase);
}

function applyFade(samples, seconds) {
  const fadeSamples = secondsToIndex(seconds);
  for (let i = 0; i < fadeSamples && i < samples.length; i++) {
    const inGain = i / fadeSamples;
    const outGain = (samples.length - i - 1) / fadeSamples;
    samples[i] *= Math.min(1, inGain);
    samples[samples.length - i - 1] *= Math.min(1, outGain);
  }
}

function normalize(samples, targetPeak) {
  let peak = 0;
  for (const sample of samples) peak = Math.max(peak, Math.abs(sample));
  if (peak <= 0) return peak;
  const gain = targetPeak / peak;
  for (let i = 0; i < samples.length; i++) samples[i] *= gain;
  return peak;
}

function wavBuffer(samples) {
  const dataSize = samples.length * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < samples.length; i++) {
    const value = Math.max(-1, Math.min(1, samples[i]));
    buffer.writeInt16LE(Math.round(value * 32767), 44 + i * 2);
  }
  return buffer;
}

function colorVoicing(chord, nextChord, step) {
  if (chord.length < 3) return chord;
  const root = chord[0];
  const upper = chord.slice(1);
  const neighbor = nextChord[(step % Math.max(1, nextChord.length - 1)) + 1] ?? nextChord[0] * 2;
  const color = step % 16 >= 8 ? neighbor : (chord[2] ?? root) * semitone;
  return [root, ...upper.slice(0, 3), liftToLeadRegister(color), ...(upper[3] ? [upper[3]] : [])];
}

function liftToLeadRegister(frequency) {
  let note = frequency;
  while (note < 360) note *= 2;
  while (note > 980) note /= 2;
  return note;
}

function stepRandom(step, salt) {
  let value = Math.imul(step + 0x9e3779b9, 0x85ebca6b) ^ salt;
  value ^= value >>> 13;
  value = Math.imul(value, 0xc2b2ae35);
  value ^= value >>> 16;
  return (value >>> 0) / 4294967296;
}

function bassRegister(frequency) {
  let note = frequency;
  while (note > 120) note /= 2;
  while (note < 52) note *= 2;
  return note;
}

function approachNote(current, next) {
  const semitone = Math.pow(2, 1 / 12);
  return bassRegister(next > current ? next / semitone : next * semitone);
}

function melodyFrequency(chord, noteIndex) {
  let frequency = chord[Math.min(noteIndex, chord.length - 1)] ?? chord[0] * 2;
  while (frequency < 240) frequency *= 2;
  while (frequency > 760) frequency /= 2;
  return frequency;
}

function secondsToIndex(seconds) {
  return Math.max(0, Math.floor(seconds * sampleRate));
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
  return function random() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
