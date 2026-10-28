import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = path.join(root, ".tmp", "audio-qa");
const ambienceSourcePath = path.join(root, "app", "src", "audio", "ambience.ts");
// Guards against a missing or truncated recording (a 404 page or a stub is orders of
// magnitude smaller), not against a well-compressed one. The floor sat at 1 MB when the
// beds shipped uncompressed at ~19 MB total; they are now ~5 MB, with the purr at 0.89 MB,
// so a 1 MB floor would fail on a perfectly good file.
const minimumAssetBytes = {
  catPurr: 400_000,
  rainFall: 400_000,
  fireCrackle: 400_000
};
const generatedAmbiencePatterns = [
  { pattern: /\bcreateNoiseBuffer\b/, label: "createNoiseBuffer" },
  { pattern: /\bcreateOscillator\s*\(/, label: "createOscillator" },
  { pattern: /\bOscillatorNode\b/, label: "OscillatorNode" },
  { pattern: /\bPeriodicWave\b/, label: "PeriodicWave" },
  { pattern: /\bMath\.random\s*\(/, label: "Math.random" }
];

await main();

async function main() {
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });

  const { assets, moods, rooms, scenes } = await loadSourceModules();
  const ambienceGuard = await assertNativeAmbienceOnly();
  const assetChecks = await Promise.all(
    Object.entries(assets).map(async ([id, asset]) => {
      const filePath = path.join(root, "app", "public", asset.url.replace(/^\//, ""));
      const fileStat = await stat(filePath);
      const minimumBytes = minimumAssetBytes[id] ?? 1;
      return {
        id,
        label: asset.label,
        file: filePath,
        bytes: fileStat.size,
        minimumBytes,
        minLoopSeconds: asset.minLoopSeconds,
        ok: fileStat.size >= minimumBytes
      };
    })
  );

  const manifest = {
    generatedAt: new Date().toISOString(),
    note: "Native ambience QA manifest. Long-running cat purr, rain, and fire ambience comes from local recordings; the browser extends shorter recordings into longer in-memory loops.",
    ambienceGuard,
    assetChecks,
    moods: moods.map((mood) => ({
      id: mood.id,
      title: mood.title,
      purrGain: mood.ambience.purrGain,
      rainGain: mood.ambience.rainGain,
      fireGain: mood.ambience.fireGain
    })),
    roomBalances: scenes.map((scene) => {
      const room = rooms.find((candidate) => candidate.id === scene.id) ?? rooms[0];
      return {
        room: scene.id,
        title: scene.title,
        mood: scene.mood,
        purrGainScale: room.purrGainScale,
        rainGainScale: room.rainGainScale,
        fireGainScale: room.fireGainScale
      };
    })
  };

  const failed = assetChecks.filter((asset) => !asset.ok);
  const manifestPath = path.join(outputDir, "audio-qa.json");
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log("Audio QA manifest written:");
  console.log(`- ${manifestPath}`);
  for (const asset of assetChecks) {
    console.log(`- ${asset.id}: ${asset.bytes} bytes, ${asset.minLoopSeconds}s target loop`);
  }
  if (failed.length > 0) {
    throw new Error(`Audio asset check failed: ${failed.map((asset) => asset.id).join(", ")}`);
  }
}

async function assertNativeAmbienceOnly() {
  const source = await readFile(ambienceSourcePath, "utf8");
  const forbidden = generatedAmbiencePatterns.filter(({ pattern }) => pattern.test(source)).map(({ label }) => label);
  if (forbidden.length > 0) {
    throw new Error(`Generated ambience fallback found in ambience.ts: ${forbidden.join(", ")}`);
  }
  return {
    file: ambienceSourcePath,
    nativeOnly: true,
    forbiddenPatterns: generatedAmbiencePatterns.map(({ label }) => label)
  };
}

async function loadSourceModules() {
  const assetsModule = await loadTsModule("audio/assets.ts");
  const moodsModule = await loadTsModule("audio/moods.ts");
  const roomsModule = await loadTsModule("audio/rooms.ts");
  const scenesModule = await loadTsModule("sceneEnvironments.ts");
  return {
    assets: assetsModule.AMBIENT_AUDIO_ASSETS,
    moods: moodsModule.AUDIO_MOODS,
    rooms: roomsModule.ROOM_AMBIENCE_DEFS,
    scenes: scenesModule.SCENE_ENVIRONMENTS
  };
}

// Node strips the types itself (22.18+; CI runs 24). These files use only erasable syntax and
// `import type`, and `assets.ts` reads `import.meta.env?.BASE_URL`, which is undefined here.
function loadTsModule(file) {
  return import(pathToFileURL(path.join(root, "app", "src", file)).href);
}
