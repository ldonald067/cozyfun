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
  [-1, -1, 4, 3, -1, 2, -1, -1, -1, 3, -1, 2, 1, -1, -1, -1]
];

await main();

async function main() {
  await mkdir(outputDir, { recursive: true });
  const moods = await loadMoodDefs();
  const renders = [];
  for (const mood of moods) {
    renders.push(await renderMood(mood));
  }
  const manifest = {
    generatedAt: new Date().toISOString(),
    sampleRate,
    durationSeconds,
    note: "Deterministic offline reference for judging generated lo-fi direction. Browser Web Audio routing is tested separately.",
    renders
  };
  const manifestPath = path.join(outputDir, "audio-qa.json");
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log("Audio QA renders written:");
  for (const render of renders) console.log(`- ${render.file}`);
  console.log(`- ${manifestPath}`);
}

async function loadMoodDefs() {
  const requireFromApp = createRequire(path.join(root, "app", "package.json"));
  const ts = requireFromApp("typescript");
  const sourcePath = path.join(root, "app", "src", "audio", "moods.ts");
  const source = await readFile(sourcePath, "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2020,
      verbatimModuleSyntax: false
    }
  }).outputText;
  const modulePath = path.join(outputDir, "moods.generated.mjs");
  await writeFile(modulePath, transpiled);
  const moduleUrl = `${pathToFileURL(modulePath).href}?t=${Date.now()}`;
  const module = await import(moduleUrl);
  return module.AUDIO_MOODS;
}

async function renderMood(mood) {
  const samples = new Float32Array(sampleRate * durationSeconds);
  const rng = mulberry32(hashText(mood.id));
  const music = mood.music;
  addBackground(samples, mood, rng);

  const stepSeconds = music.stepMs / 1000;
  const stepCount = Math.ceil(durationSeconds / stepSeconds) + 2;
  for (let step = 0; step < stepCount; step++) {
    scheduleStep(samples, music, step, step * stepSeconds);
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
    hasTextureLayer: music.textureGain > 0
  };
}

function addBackground(samples, mood, rng) {
  const { ambience, music } = mood;
  let hush = 0;
  let rainLast = 0;
  for (let i = 0; i < samples.length; i++) {
    const t = i / sampleRate;
    const white = rng() * 2 - 1;
    hush = hush * 0.996 + white * 0.004;
    const rain = white - rainLast * 0.62;
    rainLast = white;
    samples[i] += rain * ambience.rainGain * 0.12;
    samples[i] += hush * ambience.hushGain * 0.55;
    samples[i] += Math.sin(Math.PI * 2 * ambience.humFrequency * t) * ambience.humGain * 0.35;
    samples[i] += (rng() * 2 - 1) * music.vinylGain * 0.025;
    if (rng() < 0.000018) addDustPop(samples, i, music.vinylGain, rng);
  }
}

function scheduleStep(samples, settings, step, baseTime) {
  const swingDelay = step % 2 === 1 ? (settings.stepMs / 1000) * settings.swing : 0.012;
  const time = baseTime + swingDelay;
  const barStep = step % 8;
  const chordIndex = Math.floor(step / 8) % settings.progression.length;
  const chord = settings.progression[chordIndex];
  const nextChord = settings.progression[(chordIndex + 1) % settings.progression.length];

  if (barStep === 0) addChord(samples, settings, chord, time, 1, 3.15);
  if (barStep === 3 && step % 16 === 3) addChord(samples, settings, chord, time, 0.24, 0.82);
  if (barStep === 5) addChord(samples, settings, chord, time, 0.46, 1.45);
  if (barStep === 7 && step % 32 === 31) addChord(samples, settings, nextChord, time, 0.22, 0.74);

  if (barStep % 2 === 0) addBass(samples, settings, chord, nextChord, barStep, time);
  if (barStep === 0) addThump(samples, settings, time, 1);
  if (barStep === 6) addThump(samples, settings, time, 0.4);

  if (settings.brushGain > 0) {
    addNoiseBurst(samples, time, 0.042, settings.brushGain * (step % 2 === 0 ? 0.45 : 0.85), "hat");
    if (barStep === 4) addNoiseBurst(samples, time, 0.12, settings.brushGain, "snare");
    if (barStep === 7) addNoiseBurst(samples, time, 0.12, settings.brushGain * 0.32, "snare");
    if (settings.fillGain > 0 && step % 32 === 30) addBrushFill(samples, settings, time);
  }

  addMelody(samples, settings, chord, step, time);
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

function addMelody(samples, settings, chord, step, time) {
  if (settings.melodyGain <= 0) return;
  const phrase = melodyPhrases[Math.floor(step / 16) % melodyPhrases.length];
  const noteIndex = phrase[step % phrase.length];
  if (noteIndex < 0) return;
  addTone(samples, time, 0.58, melodyFrequency(chord, noteIndex), settings.melodyGain * 1.5, "sine", {
    attack: 0.028,
    release: 0.3,
    vibrato: 3.5
  });
}

function addThump(samples, settings, time, gainScale) {
  const start = secondsToIndex(time);
  const end = Math.min(samples.length, start + secondsToIndex(0.24));
  for (let i = start; i < end; i++) {
    const elapsed = (i - start) / sampleRate;
    const t = elapsed / 0.24;
    const frequency = 82 * Math.pow(48 / 82, Math.min(1, elapsed / 0.16));
    samples[i] += Math.sin(Math.PI * 2 * frequency * elapsed) * envelope(t, 0.05, 0.72) * settings.thumpGain * gainScale * 1.8;
  }
}

function addBrushFill(samples, settings, time) {
  for (let i = 0; i < 4; i++) {
    addNoiseBurst(samples, time + i * 0.055, 0.06, settings.fillGain * (1 - i * 0.12), i % 2 === 0 ? "snare" : "hat");
  }
}

function addNoiseBurst(samples, time, duration, gain, color) {
  const rng = mulberry32(hashText(`${time}:${duration}:${gain}:${color}`));
  const start = secondsToIndex(time);
  const end = Math.min(samples.length, start + secondsToIndex(duration));
  let last = 0;
  for (let i = start; i < end; i++) {
    const t = (i - start) / Math.max(1, end - start);
    const white = rng() * 2 - 1;
    const filtered = color === "hat" ? white - last * 0.72 : white * 0.55 + last * 0.45;
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
