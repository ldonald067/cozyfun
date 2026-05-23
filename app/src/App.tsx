import { ChangeEvent, PointerEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BrickWall,
  Brush,
  CloudFog,
  Download,
  Droplet,
  Eraser,
  Flame,
  Flower2,
  FolderOpen,
  Gem,
  ImageDown,
  Leaf,
  Moon,
  Mountain,
  Music2,
  Orbit,
  Pause,
  Play,
  RotateCcw,
  Save,
  Shell,
  Snowflake,
  Sparkles,
  Sprout,
  TreePine,
  Volume2,
  VolumeX,
  Waves,
  Wind,
  type LucideIcon
} from "lucide-react";
import {
  createAudioController,
  loadAudioPrefs,
  saveAudioPrefs,
  type AudioChannel,
  type AudioPrefs
} from "./audio";
import { createEngine, type SandboxEngine } from "./engine";
import { MATERIAL, MATERIALS, type MaterialDef, type MaterialId } from "./materials";
import { applySnapshot, downloadSnapshot, loadLocal, readSnapshotFile, saveLocal } from "./storage";
import { exportPostcard, renderSandbox } from "./renderer";

const WORLD_WIDTH = 220;
const WORLD_HEIGHT = 140;
const DEFAULT_SEED = 1107;
const SIM_TICK_MS = 42;
const AUDIO_CHANNELS: AudioChannel[] = ["master", "ambience", "music", "effects"];

const AUDIO_CHANNEL_LABELS: Record<AudioChannel, string> = {
  master: "Master",
  ambience: "Ambience",
  music: "Music",
  effects: "Effects"
};

const MATERIAL_ICONS: Record<MaterialId, LucideIcon> = {
  [MATERIAL.Empty]: Eraser,
  [MATERIAL.Wall]: BrickWall,
  [MATERIAL.Sand]: Shell,
  [MATERIAL.Water]: Waves,
  [MATERIAL.Smoke]: CloudFog,
  [MATERIAL.Soil]: Mountain,
  [MATERIAL.Fire]: Flame,
  [MATERIAL.Wood]: TreePine,
  [MATERIAL.Lava]: Flame,
  [MATERIAL.Stone]: Gem,
  [MATERIAL.Moss]: Leaf,
  [MATERIAL.Seed]: Sprout,
  [MATERIAL.Fungus]: Flower2,
  [MATERIAL.Oil]: Droplet,
  [MATERIAL.Ice]: Snowflake,
  [MATERIAL.Steam]: Wind,
  [MATERIAL.Stardust]: Sparkles,
  [MATERIAL.Meteor]: Orbit,
  [MATERIAL.Moonwater]: Moon
};

export function App() {
  const audio = useMemo(() => createAudioController(), []);
  const [audioPrefs, setAudioPrefs] = useState<AudioPrefs>(() => loadAudioPrefs());
  const [engine, setEngine] = useState<SandboxEngine | null>(null);
  const [selected, setSelected] = useState<MaterialId>(MATERIAL.Sand);
  const [brushSize, setBrushSize] = useState(4);
  const [paused, setPaused] = useState(false);
  const [status, setStatus] = useState("warming tray");
  const [fps, setFps] = useState(0);
  const baseCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const glowCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const motesCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const pointerDownRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let active = true;
    let createdEngine: SandboxEngine | null = null;
    createEngine(WORLD_WIDTH, WORLD_HEIGHT, DEFAULT_SEED).then((created) => {
      if (!active) {
        created.dispose();
        return;
      }
      createdEngine = created;
      setEngine(created);
      setStatus(created.source === "wasm" ? "wasm sim online" : "js fallback online");
      seedOpeningScene(created);
    });
    return () => {
      active = false;
      createdEngine?.dispose();
    };
  }, []);

  useEffect(() => {
    audio.applyPreferences(audioPrefs);
    saveAudioPrefs(audioPrefs);
  }, [audio, audioPrefs]);

  useEffect(() => {
    return () => audio.dispose();
  }, [audio]);

  useEffect(() => {
    if (!engine) return;
    let frame = 0;
    let lastSimTick = performance.now();
    let lastFpsAt = lastSimTick;
    let frames = 0;

    const loop = (time: number) => {
      if (!paused && time - lastSimTick >= SIM_TICK_MS) {
        engine.tick();
        lastSimTick = time;
      }
      const base = baseCanvasRef.current;
      const glow = glowCanvasRef.current;
      const motes = motesCanvasRef.current;
      if (base && glow && motes) renderSandbox(engine, { base, glow, motes }, time);

      frames++;
      if (time - lastFpsAt > 500) {
        setFps(Math.round((frames * 1000) / (time - lastFpsAt)));
        frames = 0;
        lastFpsAt = time;
      }
      frame = requestAnimationFrame(loop);
    };

    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [engine, paused]);

  const groupedMaterials = useMemo<Record<string, MaterialDef[]>>(
    () => ({
      basic: MATERIALS.filter((material) => material.group === "basic"),
      life: MATERIALS.filter((material) => material.group === "life"),
      heat: MATERIALS.filter((material) => material.group === "heat"),
      cosmic: MATERIALS.filter((material) => material.group === "cosmic")
    }),
    []
  );

  const paintAtPointer = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (!engine || !baseCanvasRef.current) return;
      const rect = baseCanvasRef.current.getBoundingClientRect();
      const x = Math.floor(((event.clientX - rect.left) / rect.width) * engine.width());
      const y = Math.floor(((event.clientY - rect.top) / rect.height) * engine.height());
      engine.paint(x, y, brushSize, selected);
      audio.playMaterialPaint(selected, brushSize / 12);
    },
    [audio, brushSize, engine, selected]
  );

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    pointerDownRef.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    paintAtPointer(event);
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!pointerDownRef.current) return;
    paintAtPointer(event);
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    pointerDownRef.current = false;
    event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function handleClear() {
    if (!engine) return;
    engine.clear();
    audio.playUiCue("clear");
    setStatus("tray cleared");
  }

  function handleSave() {
    if (!engine) return;
    const saved = saveLocal(engine);
    if (saved) audio.playUiCue("save");
    setStatus(saved ? "scene saved locally" : "local save failed");
  }

  function handleLoad() {
    if (!engine) return;
    const loaded = loadLocal(engine);
    if (loaded) audio.playUiCue("load");
    setStatus(loaded ? "local scene loaded" : "no local save yet");
  }

  function handleExport() {
    if (!engine) return;
    downloadSnapshot(engine);
    audio.playUiCue("export");
    setStatus("scene exported");
  }

  async function handleImport(event: ChangeEvent<HTMLInputElement>) {
    if (!engine || !event.target.files?.[0]) return;
    const snapshot = await readSnapshotFile(event.target.files[0]);
    const loaded = snapshot ? applySnapshot(engine, snapshot) : false;
    if (loaded) audio.playUiCue("import");
    setStatus(loaded ? "scene imported" : "invalid scene file");
    event.target.value = "";
  }

  async function handlePostcard() {
    if (!engine || !baseCanvasRef.current || !glowCanvasRef.current) return;
    await exportPostcard(engine, baseCanvasRef.current, glowCanvasRef.current);
    audio.playUiCue("export");
    setStatus("postcard exported");
  }

  async function handleEnableSound() {
    const nextPrefs = { ...audioPrefs, enabled: true };
    const ready = await audio.init(nextPrefs);
    if (!ready) {
      setStatus("audio unavailable");
      return;
    }
    setAudioPrefs(nextPrefs);
    audio.playUiCue("toggle");
    setStatus("rain desk audio on");
  }

  function handleMuteAudio() {
    if (!audioPrefs.enabled) return;
    const muted = !audioPrefs.muted;
    setAudioPrefs((current) => ({ ...current, muted }));
    audio.setMuted(muted);
    if (!muted) audio.playUiCue("toggle");
  }

  function handleAudioVolume(channel: AudioChannel, value: number) {
    setAudioPrefs((current) => ({
      ...current,
      volumes: {
        ...current.volumes,
        [channel]: value
      }
    }));
    audio.setVolume(channel, value);
  }

  return (
    <main className="app-shell">
      <canvas ref={motesCanvasRef} className="motes-canvas" aria-hidden="true" />
      <section className="workspace" aria-label="Cozy pixel sandbox">
        <aside className="tool-panel" aria-label="Materials">
          <div className="brand-mark">
            <Sparkles size={18} />
            <span>Night Desk Terrarium</span>
          </div>

          {Object.entries(groupedMaterials).map(([group, materials]) => (
            <div className="tool-group" key={group}>
              <span className="group-label">{group}</span>
              <div className="material-grid">
                {materials.map((material) => {
                  const MaterialIcon = MATERIAL_ICONS[material.id];
                  return (
                    <button
                      className={`material-button ${selected === material.id ? "active" : ""}`}
                      key={material.id}
                      type="button"
                      title={material.label}
                      style={{ "--material-color": material.color } as React.CSSProperties}
                      onClick={() => setSelected(material.id)}
                    >
                      <span className="material-icon">
                        <MaterialIcon size={17} strokeWidth={2.15} />
                      </span>
                      <span>{material.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </aside>

        <section className="sandbox-stage">
          <div className="window-scene" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <div
            className="tray"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            <canvas ref={glowCanvasRef} className="sandbox-canvas glow-canvas" />
            <canvas ref={baseCanvasRef} className="sandbox-canvas base-canvas" />
            <div className="glass-sheen" aria-hidden="true" />
          </div>
          <div className="status-bar">
            <span>{status}</span>
            <span>{engine?.source ?? "loading"} - {fps} fps</span>
          </div>
        </section>

        <aside className="control-panel" aria-label="Controls">
          <div className="control-row">
            <button type="button" className="icon-button" title={paused ? "Play" : "Pause"} onClick={() => setPaused((value) => !value)}>
              {paused ? <Play size={18} /> : <Pause size={18} />}
            </button>
            <button type="button" className="icon-button" title="Clear" onClick={handleClear}>
              <RotateCcw size={18} />
            </button>
            <button type="button" className="icon-button" title="Use eraser" onClick={() => setSelected(MATERIAL.Empty)}>
              <Eraser size={18} />
            </button>
          </div>

          <label className="brush-control">
            <span>
              <Brush size={16} /> Brush
            </span>
            <input
              type="range"
              min={1}
              max={12}
              value={brushSize}
              onChange={(event) => setBrushSize(Number(event.target.value))}
            />
            <output>{brushSize}</output>
          </label>

          <div className="audio-panel" aria-label="Audio">
            <div className="audio-panel-header">
              <span className="audio-panel-title">
                <Music2 size={16} /> Sound
              </span>
              <button
                type="button"
                className={`audio-enable-button ${audioPrefs.enabled ? "active" : ""}`}
                title={audioPrefs.enabled ? "Sound enabled" : "Enable sound"}
                disabled={audioPrefs.enabled}
                onClick={handleEnableSound}
              >
                {audioPrefs.enabled ? "On" : "Enable"}
              </button>
            </div>

            <button
              type="button"
              className={`audio-mute-button ${audioPrefs.muted ? "muted" : ""}`}
              title={audioPrefs.muted ? "Unmute" : "Mute"}
              disabled={!audioPrefs.enabled}
              onClick={handleMuteAudio}
            >
              {audioPrefs.muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
              {audioPrefs.muted ? "Muted" : "Mute"}
            </button>

            <div className="audio-sliders">
              {AUDIO_CHANNELS.map((channel) => (
                <label className="audio-slider" key={channel}>
                  <span>{AUDIO_CHANNEL_LABELS[channel]}</span>
                  <output>{Math.round(audioPrefs.volumes[channel] * 100)}</output>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={audioPrefs.volumes[channel]}
                    disabled={!audioPrefs.enabled}
                    onChange={(event) => handleAudioVolume(channel, Number(event.target.value))}
                  />
                </label>
              ))}
            </div>
          </div>

          <div className="control-stack">
            <button type="button" onClick={handleSave}>
              <Save size={16} /> Save
            </button>
            <button type="button" onClick={handleLoad}>
              <FolderOpen size={16} /> Load
            </button>
            <button type="button" onClick={handleExport}>
              <Download size={16} /> Export
            </button>
            <button type="button" onClick={() => fileInputRef.current?.click()}>
              <FolderOpen size={16} /> Import
            </button>
            <button type="button" onClick={handlePostcard}>
              <ImageDown size={16} /> Postcard
            </button>
          </div>
          <input ref={fileInputRef} type="file" accept="application/json" hidden onChange={handleImport} />
        </aside>
      </section>
    </main>
  );
}

function seedOpeningScene(engine: SandboxEngine) {
  for (let x = 0; x < engine.width(); x++) {
    engine.paint(x, engine.height() - 2, 1, MATERIAL.Stone);
  }
  for (let x = 22; x < 74; x++) {
    engine.paint(x, 28, 1, MATERIAL.Sand);
  }
  for (let x = 120; x < 168; x++) {
    engine.paint(x, 35, 1, MATERIAL.Moonwater);
  }
  engine.paint(58, 102, 9, MATERIAL.Soil);
  engine.paint(62, 94, 4, MATERIAL.Moss);
  engine.paint(172, 92, 5, MATERIAL.Wood);
  engine.paint(172, 82, 3, MATERIAL.Fire);
  engine.paint(136, 26, 3, MATERIAL.Stardust);
}
