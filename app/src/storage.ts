import type { SandboxEngine } from "./engine";
import { isAudioMood } from "./audio/moods";
import type { AudioMood, AudioProvider } from "./audio/types";
import { validateDeskRadioSource, type DeskRadioSource } from "./deskRadio";
import { CELL_STRIDE } from "./materials";
import { isSceneEnvironmentId, type SceneEnvironmentId } from "./sceneEnvironments";

const STORAGE_KEY = "cozy-pixel-sandbox:scene:v1";
const APP_NAME = "cozy-pixel-sandbox";
const FORMAT = "CXS2";
const LEGACY_FORMAT = "CXS1";
const MAX_SCENE_CELLS = 512 * 512;
const MAX_SCENE_CELL_BYTES = MAX_SCENE_CELLS * CELL_STRIDE;
const MAX_SCENE_JSON_BYTES = base64LengthForBytes(MAX_SCENE_CELL_BYTES) + 16_384;
const COMPACT_BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;
type SceneMetadataAudioProvider = "generated" | "external";

export type SceneSnapshotContext = {
  title: string;
  room: SceneEnvironmentId;
  mood: AudioMood;
  audioProvider: AudioProvider;
  deskRadio?: DeskRadioSource | null;
};

export type SceneSnapshotMetadata = {
  app: typeof APP_NAME;
  title: string;
  room: SceneEnvironmentId;
  mood: AudioMood;
  musicProvider: SceneMetadataAudioProvider;
  deskRadio?: DeskRadioSource | null;
};

export type SceneSnapshot = {
  format: typeof FORMAT | typeof LEGACY_FORMAT;
  width: number;
  height: number;
  tick: number;
  engine: "wasm" | "js";
  cells: string;
  savedAt: string;
  metadata?: SceneSnapshotMetadata;
};

export type SceneSnapshotApplyResult = {
  loaded: boolean;
  metadata: SceneSnapshotMetadata | null;
};

export function createSnapshot(engine: SandboxEngine, context?: SceneSnapshotContext): SceneSnapshot {
  return {
    format: FORMAT,
    width: engine.width(),
    height: engine.height(),
    tick: engine.tickCount(),
    engine: engine.source,
    cells: bytesToBase64(engine.getCellBytes()),
    savedAt: new Date().toISOString(),
    metadata: context ? createSnapshotMetadata(context) : undefined
  };
}

export function applySnapshot(engine: SandboxEngine, snapshot: unknown): SceneSnapshotApplyResult {
  const scene = validateSnapshot(snapshot);
  if (!scene) return failedApplyResult();
  if (scene.width !== engine.width() || scene.height !== engine.height()) return failedApplyResult();
  let cellBytes: Uint8Array;
  try {
    cellBytes = base64ToBytes(scene.cells);
  } catch {
    return failedApplyResult();
  }

  if (cellBytes.byteLength !== engine.width() * engine.height() * CELL_STRIDE) return failedApplyResult();
  return engine.loadCellBytes(cellBytes) ? { loaded: true, metadata: scene.metadata ?? null } : failedApplyResult();
}

export function saveLocal(engine: SandboxEngine, context?: SceneSnapshotContext) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(createSnapshot(engine, context)));
    return true;
  } catch {
    return false;
  }
}

export function loadLocal(engine: SandboxEngine): SceneSnapshotApplyResult {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return failedApplyResult();
  try {
    return applySnapshot(engine, JSON.parse(raw));
  } catch {
    return failedApplyResult();
  }
}

export function downloadSnapshot(engine: SandboxEngine, context?: SceneSnapshotContext) {
  const snapshot = createSnapshot(engine, context);
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${snapshotSlug(snapshot)}-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function readSnapshotFile(file: File): Promise<SceneSnapshot | null> {
  if (file.size <= 0 || file.size > MAX_SCENE_JSON_BYTES) return null;
  try {
    return validateSnapshot(JSON.parse(await file.text()));
  } catch {
    return null;
  }
}

function validateSnapshot(value: unknown): SceneSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<SceneSnapshot>;
  if (candidate.format !== FORMAT && candidate.format !== LEGACY_FORMAT) return null;
  if (typeof candidate.width !== "number" || !Number.isInteger(candidate.width) || candidate.width <= 0) return null;
  if (typeof candidate.height !== "number" || !Number.isInteger(candidate.height) || candidate.height <= 0) return null;
  const expectedBytes = expectedCellByteLength(candidate.width, candidate.height);
  if (expectedBytes === null) return null;
  if (typeof candidate.tick !== "number" || !Number.isInteger(candidate.tick) || candidate.tick < 0) return null;
  if (candidate.engine !== "wasm" && candidate.engine !== "js") return null;
  if (typeof candidate.cells !== "string" || candidate.cells.length === 0) return null;
  if (candidate.cells.length !== base64LengthForBytes(expectedBytes)) return null;
  if (!COMPACT_BASE64.test(candidate.cells)) return null;
  if (typeof candidate.savedAt !== "string") return null;
  return {
    format: candidate.format,
    width: candidate.width,
    height: candidate.height,
    tick: candidate.tick,
    engine: candidate.engine,
    cells: candidate.cells,
    savedAt: candidate.savedAt,
    metadata: validateSnapshotMetadata(candidate.metadata) ?? undefined
  };
}

function createSnapshotMetadata(context: SceneSnapshotContext): SceneSnapshotMetadata {
  return {
    app: APP_NAME,
    title: context.title.trim() || "Cozy Pixel Sandbox",
    room: context.room,
    mood: context.mood,
    musicProvider: context.audioProvider === "external" && context.deskRadio ? "external" : "generated",
    deskRadio: context.audioProvider === "external" && context.deskRadio ? context.deskRadio : undefined
  };
}

function validateSnapshotMetadata(value: unknown): SceneSnapshotMetadata | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<SceneSnapshotMetadata>;
  if (candidate.app !== APP_NAME) return null;
  if (typeof candidate.title !== "string" || candidate.title.trim().length === 0) return null;
  if (!isSceneEnvironmentId(candidate.room)) return null;
  if (!isAudioMood(candidate.mood)) return null;
  const deskRadio = validateDeskRadioSource(candidate.deskRadio);
  const musicProvider = candidate.musicProvider === "external" && deskRadio ? "external" : "generated";
  return {
    app: APP_NAME,
    title: candidate.title.trim(),
    room: candidate.room,
    mood: candidate.mood,
    musicProvider,
    deskRadio: musicProvider === "external" ? deskRadio : undefined
  };
}

function snapshotSlug(snapshot: SceneSnapshot) {
  const label = snapshot.metadata?.title ?? "";
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug ? `cozy-sandbox-${slug}` : "cozy-sandbox";
}

function failedApplyResult(): SceneSnapshotApplyResult {
  return { loaded: false, metadata: null };
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.slice(i, i + chunkSize));
  }
  return btoa(binary);
}

function base64ToBytes(base64: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function expectedCellByteLength(width: number, height: number) {
  const cells = width * height;
  if (!Number.isSafeInteger(cells) || cells <= 0 || cells > MAX_SCENE_CELLS) return null;
  return cells * CELL_STRIDE;
}

function base64LengthForBytes(byteLength: number) {
  return Math.ceil(byteLength / 3) * 4;
}
