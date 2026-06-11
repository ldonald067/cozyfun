import { createRequire } from "node:module";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = path.join(root, ".tmp", "audio-qa");
const ambienceSourcePath = path.join(root, "app", "src", "audio", "ambience.ts");
const minimumAssetBytes = {
  rainThunder: 1_000_000,
  creekWater: 100_000,
  fireCrackle: 1_000_000
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
    note: "Native ambience QA manifest. Long-running rain, thunder, creek, and fire ambience comes from local recordings; the browser extends shorter recordings into longer in-memory loops.",
    ambienceGuard,
    assetChecks,
    moods: moods.map((mood) => ({
      id: mood.id,
      title: mood.title,
      rainGain: mood.ambience.rainGain,
      creekGain: mood.ambience.creekGain,
      fireGain: mood.ambience.fireGain
    })),
    roomBalances: scenes.map((scene) => {
      const room = rooms.find((candidate) => candidate.id === scene.id) ?? rooms[0];
      return {
        room: scene.id,
        title: scene.title,
        mood: scene.mood,
        rainGainScale: room.rainGainScale,
        creekGainScale: room.creekGainScale,
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
  const assetsModule = await loadTsModule(path.join(root, "app", "src", "audio", "assets.ts"), "assets.generated.mjs");
  const moodsModule = await loadTsModule(path.join(root, "app", "src", "audio", "moods.ts"), "moods.generated.mjs");
  const roomsModule = await loadTsModule(path.join(root, "app", "src", "audio", "rooms.ts"), "rooms.generated.mjs");
  const scenesModule = await loadTsModule(path.join(root, "app", "src", "sceneEnvironments.ts"), "scene-environments.generated.mjs");
  return {
    assets: assetsModule.AMBIENT_AUDIO_ASSETS,
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
