import type { SandboxEngine } from "./engine";

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

export function applySnapshot(engine: SandboxEngine, snapshot: SceneSnapshot): boolean {
  if (snapshot.format !== FORMAT) return false;
  if (snapshot.width !== engine.width() || snapshot.height !== engine.height()) return false;
  return engine.loadCellBytes(base64ToBytes(snapshot.cells));
}

export function saveLocal(engine: SandboxEngine) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(createSnapshot(engine)));
}

export function loadLocal(engine: SandboxEngine) {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return false;
  return applySnapshot(engine, JSON.parse(raw) as SceneSnapshot);
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

export async function readSnapshotFile(file: File): Promise<SceneSnapshot> {
  return JSON.parse(await file.text()) as SceneSnapshot;
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

