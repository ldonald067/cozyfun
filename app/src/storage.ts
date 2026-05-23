import type { SandboxEngine } from "./engine";
import { CELL_STRIDE } from "./materials";

const STORAGE_KEY = "cozy-pixel-sandbox:scene:v1";
const FORMAT = "CXS1";

export type SceneSnapshot = {
  format: typeof FORMAT;
  width: number;
  height: number;
  tick: number;
  engine: "wasm" | "js";
  cells: string;
  savedAt: string;
};

export function createSnapshot(engine: SandboxEngine): SceneSnapshot {
  return {
    format: FORMAT,
    width: engine.width(),
    height: engine.height(),
    tick: engine.tickCount(),
    engine: engine.source,
    cells: bytesToBase64(engine.getCellBytes()),
    savedAt: new Date().toISOString()
  };
}

export function applySnapshot(engine: SandboxEngine, snapshot: unknown): boolean {
  const scene = validateSnapshot(snapshot);
  if (!scene) return false;
  let cellBytes: Uint8Array;
  try {
    cellBytes = base64ToBytes(scene.cells);
  } catch {
    return false;
  }

  if (cellBytes.byteLength !== engine.width() * engine.height() * CELL_STRIDE) return false;
  if (scene.width !== engine.width() || scene.height !== engine.height()) return false;
  return engine.loadCellBytes(cellBytes);
}

export function saveLocal(engine: SandboxEngine) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(createSnapshot(engine)));
    return true;
  } catch {
    return false;
  }
}

export function loadLocal(engine: SandboxEngine) {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return false;
  try {
    return applySnapshot(engine, JSON.parse(raw));
  } catch {
    return false;
  }
}

export function downloadSnapshot(engine: SandboxEngine) {
  const snapshot = createSnapshot(engine);
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `cozy-sandbox-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function readSnapshotFile(file: File): Promise<SceneSnapshot | null> {
  try {
    return validateSnapshot(JSON.parse(await file.text()));
  } catch {
    return null;
  }
}

function validateSnapshot(value: unknown): SceneSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<SceneSnapshot>;
  if (candidate.format !== FORMAT) return null;
  if (typeof candidate.width !== "number" || !Number.isInteger(candidate.width) || candidate.width <= 0) return null;
  if (typeof candidate.height !== "number" || !Number.isInteger(candidate.height) || candidate.height <= 0) return null;
  if (typeof candidate.tick !== "number" || !Number.isInteger(candidate.tick) || candidate.tick < 0) return null;
  if (candidate.engine !== "wasm" && candidate.engine !== "js") return null;
  if (typeof candidate.cells !== "string" || candidate.cells.length === 0) return null;
  if (typeof candidate.savedAt !== "string") return null;
  return candidate as SceneSnapshot;
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
