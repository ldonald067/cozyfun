import { ChangeEvent, PointerEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BrickWall,
  Brush,
  CloudFog,
  Droplet,
  Eraser,
  Flame,
  Flower2,
  FolderOpen,
  Gem,
  Info,
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
  AUDIO_CHANNELS,
  AUDIO_MOODS,
  createAudioController,
  getAudioMoodDef,
  getMusicProviderDef,
  loadAudioPrefs,
  MUSIC_PROVIDERS,
  saveAudioPrefs,
  type AudioChannel,
  type AudioMood,
  type AudioPrefs,
  type MusicProvider
} from "./audio";
import { SegmentedControl, type SegmentOption } from "./components/SegmentedControl";
import { DeskRadioPanel, type DeskRadioPlaybackState } from "./components/DeskRadioPanel";
import { SharePanel } from "./components/SharePanel";
import {
  loadDeskRadioSource,
  parseDeskRadioUrl,
  saveDeskRadioSource,
  type DeskRadioSource
} from "./deskRadio";
import { createEngine, type SandboxEngine } from "./engine";
import { MATERIAL, MATERIALS, type MaterialDef, type MaterialId } from "./materials";
import {
  applySnapshot,
  downloadSnapshot,
  loadLocal,
  readSnapshotFile,
  saveLocal,
  type SceneSnapshotContext,
  type SceneSnapshotMetadata
} from "./storage";
import { exportClip, exportPostcard, renderSandbox } from "./renderer";
import {
  getSceneEnvironment,
  loadSceneEnvironmentId,
  saveSceneEnvironmentId,
  SCENE_ENVIRONMENTS,
  type SceneEnvironmentId
} from "./sceneEnvironments";

const WORLD_WIDTH = 220;
const WORLD_HEIGHT = 140;
const DEFAULT_SEED = 1107;
const SIM_TICK_MS = 38;

const AUDIO_CHANNEL_LABELS: Record<AudioChannel, string> = {
  master: "Master",
  ambience: "Ambience",
  music: "Music"
};

const AUDIO_CHANNEL_HINTS: Record<AudioChannel, string> = {
  master: "Overall volume for the whole soundscape.",
  ambience: "Rain, window hush, room tone, and other environmental sounds.",
  music: "Quiet lo-fi chords, beat, and vinyl texture."
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
  [MATERIAL.Flower]: Flower2,
  [MATERIAL.Oil]: Droplet,
  [MATERIAL.Ice]: Snowflake,
  [MATERIAL.Steam]: Wind,
  [MATERIAL.Stardust]: Sparkles,
  [MATERIAL.Meteor]: Orbit,
  [MATERIAL.Moonwater]: Moon
};

export function App() {
  const audio = useMemo(() => createAudioController(), []);
  const previewBadge = usePreviewBadge();
  const [deskRadioSource, setDeskRadioSource] = useState<DeskRadioSource | null>(() => loadDeskRadioSource());
  const [deskRadioInput, setDeskRadioInput] = useState("");
  const [deskRadioOpen, setDeskRadioOpen] = useState(false);
  const [deskRadioPlayback, setDeskRadioPlayback] = useState<DeskRadioPlaybackState>("idle");
  const [audioPrefs, setAudioPrefs] = useState<AudioPrefs>(() => loadAudioPrefs());
  const activeMood = getAudioMoodDef(audioPrefs.mood);
  const activeMusicProvider = getMusicProviderDef(audioPrefs.provider);
  const musicSourceLabel = audioPrefs.provider === "external" && deskRadioSource ? deskRadioSource.label : activeMusicProvider.label;
  const [engine, setEngine] = useState<SandboxEngine | null>(null);
  const [selected, setSelected] = useState<MaterialId>(MATERIAL.Sand);
  const [sceneEnvironment, setSceneEnvironment] = useState<SceneEnvironmentId>(() => loadSceneEnvironmentId());
  const activeSceneEnvironment = getSceneEnvironment(sceneEnvironment);
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
    if (audioPrefs.provider !== "external" || deskRadioSource) return;
    setAudioPrefs((current) => ({ ...current, provider: "generated" }));
    audio.setMusicProvider("generated");
    setDeskRadioPlayback("idle");
  }, [audio, audioPrefs.provider, deskRadioSource]);

  useEffect(() => {
    saveSceneEnvironmentId(sceneEnvironment);
  }, [sceneEnvironment]);

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
      basic: MATERIALS.filter((material) => material.group === "basic" && material.userSelectable !== false),
      life: MATERIALS.filter((material) => material.group === "life" && material.userSelectable !== false),
      heat: MATERIALS.filter((material) => material.group === "heat" && material.userSelectable !== false),
      cosmic: MATERIALS.filter((material) => material.group === "cosmic" && material.userSelectable !== false)
    }),
    []
  );

  const moodOptions = useMemo<SegmentOption<AudioMood>[]>(
    () =>
      AUDIO_MOODS.map((mood) => ({
        value: mood.id,
        label: mood.label,
        title: mood.title,
        testId: `audio-mood-${mood.id}`
      })),
    []
  );

  const providerOptions = useMemo<SegmentOption<MusicProvider>[]>(
    () =>
      MUSIC_PROVIDERS.map((provider) => ({
        value: provider.id,
        label: provider.label,
        title: provider.title,
        badge: provider.badge,
        testId: `music-provider-${provider.id}`
      })),
    []
  );

  const sceneShellStyle = useMemo(
    () =>
      ({
        "--room-image": `url("${activeSceneEnvironment.image}")`,
        "--room-image-position": activeSceneEnvironment.imagePosition,
        "--room-image-opacity": activeSceneEnvironment.imageOpacity,
        "--room-image-filter": activeSceneEnvironment.imageFilter
      }) as React.CSSProperties,
    [activeSceneEnvironment]
  );

  const sceneOptions = useMemo<SegmentOption<SceneEnvironmentId>[]>(
    () =>
      SCENE_ENVIRONMENTS.map((scene) => ({
        value: scene.id,
        label: scene.label,
        title: scene.title,
        testId: `scene-environment-${scene.id}`
      })),
    []
  );

  const snapshotContext = useMemo<SceneSnapshotContext>(
    () => ({
      title: activeSceneEnvironment.title,
      room: sceneEnvironment,
      mood: audioPrefs.mood,
      musicProvider: audioPrefs.provider,
      deskRadio: deskRadioSource
    }),
    [activeSceneEnvironment.title, audioPrefs.mood, audioPrefs.provider, deskRadioSource, sceneEnvironment]
  );

  const paintAtPointer = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (!engine || !baseCanvasRef.current) return;
      const rect = baseCanvasRef.current.getBoundingClientRect();
      const x = Math.floor(((event.clientX - rect.left) / rect.width) * engine.width());
      const y = Math.floor(((event.clientY - rect.top) / rect.height) * engine.height());
      engine.paint(x, y, brushSize, selected);
      audio.playPaintCue(selected);
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

  function applySnapshotMetadata(metadata: SceneSnapshotMetadata | null) {
    if (!metadata) return;
    const deskRadio = metadata.musicProvider === "external" ? (metadata.deskRadio ?? null) : null;
    if (deskRadio) {
      setDeskRadioSource(deskRadio);
      setDeskRadioOpen(true);
      setDeskRadioPlayback("loading");
      saveDeskRadioSource(deskRadio);
    } else {
      setDeskRadioPlayback("idle");
      setDeskRadioOpen(false);
      saveDeskRadioSource(null);
    }
    setSceneEnvironment(metadata.room);
    setAudioPrefs((current) => ({ ...current, mood: metadata.mood, provider: metadata.musicProvider }));
    audio.setMood(metadata.mood);
    audio.setMusicProvider(metadata.musicProvider);
  }

  function handleClear() {
    if (!engine) return;
    engine.clear();
    setStatus("tray cleared");
  }

  function handleSave() {
    if (!engine) return;
    const saved = saveLocal(engine, snapshotContext);
    setStatus(saved ? "saved in browser" : "browser save failed");
  }

  function handleLoad() {
    if (!engine) return;
    const result = loadLocal(engine);
    if (result.loaded) {
      applySnapshotMetadata(result.metadata);
    }
    setStatus(result.loaded ? "browser save loaded" : "no browser save yet");
  }

  function handleExport() {
    if (!engine) return;
    downloadSnapshot(engine, snapshotContext);
    setStatus("scene JSON exported");
  }

  async function handleImport(event: ChangeEvent<HTMLInputElement>) {
    if (!engine || !event.target.files?.[0]) return;
    const snapshot = await readSnapshotFile(event.target.files[0]);
    const result = snapshot ? applySnapshot(engine, snapshot) : { loaded: false, metadata: null };
    if (result.loaded) {
      applySnapshotMetadata(result.metadata);
    }
    setStatus(result.loaded ? "scene JSON imported" : "invalid scene file");
    event.target.value = "";
  }

  async function handlePostcard() {
    if (!engine || !baseCanvasRef.current || !glowCanvasRef.current) return;
    await exportPostcard(engine, baseCanvasRef.current, glowCanvasRef.current, {
      sceneTitle: activeSceneEnvironment.title,
      moodTitle: activeMood.title,
      musicSource: musicSourceLabel
    });
    setStatus("postcard PNG exported");
  }

  async function handleClip() {
    if (!engine || !baseCanvasRef.current || !glowCanvasRef.current) return;
    setStatus("recording clip");
    const exported = await exportClip(engine, baseCanvasRef.current, glowCanvasRef.current, {
      sceneTitle: activeSceneEnvironment.title,
      moodTitle: activeMood.title,
      musicSource: musicSourceLabel
    });
    setStatus(exported ? "clip WebM exported" : "clip unavailable");
  }

  async function handleCopyShareNote() {
    if (!engine || !navigator.clipboard?.writeText) {
      setStatus("clipboard unavailable");
      return;
    }

    const shareSummary = [
      "Night Desk Terrarium scene",
      `Room: ${activeSceneEnvironment.title}`,
      `Sound: ${activeMood.title} / ${musicSourceLabel}`,
      `Sim: ${engine.source.toUpperCase()}, tick ${engine.tickCount()}`
    ].join("\n");

    try {
      await navigator.clipboard.writeText(shareSummary);
      setStatus("share note copied");
    } catch {
      setStatus("clipboard unavailable");
    }
  }

  async function handleToggleSound() {
    if (audioPrefs.enabled) {
      const nextPrefs = { ...audioPrefs, enabled: false };
      setAudioPrefs(nextPrefs);
      audio.setEnabled(false);
      setStatus(`${activeMood.title} resting`);
      return;
    }

    const nextPrefs = { ...audioPrefs, enabled: true, muted: false };
    const ready = await audio.init(nextPrefs);
    if (!ready) {
      setStatus("audio unavailable");
      return;
    }
    setAudioPrefs(nextPrefs);
    setStatus(getAudioMoodDef(nextPrefs.mood).status);
  }

  function handleMuteAudio() {
    const muted = !audioPrefs.muted;
    setAudioPrefs((current) => ({ ...current, muted }));
    audio.setMuted(muted);
    setStatus(muted ? "audio muted" : "audio unmuted");
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

  function handleAudioMood(mood: AudioMood) {
    const moodDef = getAudioMoodDef(mood);
    setAudioPrefs((current) => ({ ...current, mood }));
    audio.setMood(mood);
    setStatus(audioPrefs.enabled ? moodDef.status : `${moodDef.title} ready`);
  }

  function handleMusicProvider(provider: MusicProvider) {
    const providerDef = getMusicProviderDef(provider);
    if (provider === "external" && !deskRadioSource) {
      setStatus("desk radio needs a YouTube link");
      setDeskRadioOpen(true);
      return;
    }
    if (provider === "external") setDeskRadioPlayback("loading");
    else {
      setDeskRadioOpen(false);
      setDeskRadioPlayback("idle");
    }
    setAudioPrefs((current) => ({ ...current, provider }));
    audio.setMusicProvider(provider);
    setStatus(providerDef.status);
  }

  function handleDeskRadioTune() {
    const source = parseDeskRadioUrl(deskRadioInput);
    if (!source) {
      setStatus("invalid YouTube link");
      return;
    }
    setDeskRadioSource(source);
    setDeskRadioOpen(true);
    setDeskRadioPlayback("loading");
    setAudioPrefs((current) => ({ ...current, provider: "external" }));
    audio.setMusicProvider("external");
    setStatus("checking desk radio");
  }

  function handleDeskRadioClear() {
    setDeskRadioSource(null);
    setDeskRadioInput("");
    setDeskRadioOpen(false);
    setDeskRadioPlayback("idle");
    saveDeskRadioSource(null);
    setAudioPrefs((current) => ({ ...current, provider: "generated" }));
    audio.setMusicProvider("generated");
    setStatus("generated music selected");
  }

  function handleDeskRadioReady(source: DeskRadioSource) {
    setDeskRadioPlayback("ready");
    setDeskRadioInput("");
    saveDeskRadioSource(source);
    setStatus("desk radio ready");
  }

  function handleDeskRadioBlocked(code: number) {
    setDeskRadioPlayback("blocked");
    saveDeskRadioSource(null);
    setAudioPrefs((current) => (current.provider === "external" ? { ...current, provider: "generated" } : current));
    audio.setMusicProvider("generated");
    setStatus(code === 101 || code === 150 ? "YouTube blocked embed; generated music restored" : "YouTube player unavailable; generated music restored");
  }

  function handleSceneEnvironment(id: SceneEnvironmentId) {
    const scene = getSceneEnvironment(id);
    setSceneEnvironment(id);
    setAudioPrefs((current) => ({ ...current, mood: scene.mood }));
    audio.setMood(scene.mood);
    setStatus(scene.status);
  }

  return (
    <main className={`app-shell ${activeSceneEnvironment.className}`} style={sceneShellStyle}>
      <canvas ref={motesCanvasRef} className="motes-canvas" aria-hidden="true" />
      {previewBadge && (
        <div className="preview-build-badge" data-testid="preview-build-badge">
          {previewBadge}
        </div>
      )}
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
                      aria-label={`${material.label}: ${material.description}`}
                      title={`${material.label}: ${material.description}`}
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
          <div
            className="tray"
            data-testid="sandbox-tray"
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
            <span data-testid="status-message">{status}</span>
            <span>{engine?.source ?? "loading"} - {fps} fps</span>
          </div>
        </section>

        <aside className="control-panel" aria-label="Controls">
          <div className="control-row">
            <button type="button" className="icon-button" title={paused ? "Play" : "Pause"} onClick={() => setPaused((value) => !value)}>
              {paused ? <Play size={18} /> : <Pause size={18} />}
            </button>
            <button type="button" className="icon-button" title="Clear" data-testid="clear-scene" onClick={handleClear}>
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

          <div className="control-stack">
            <div className="environment-control">
              <span>Room</span>
              <SegmentedControl
                ariaLabel="Room backdrop"
                value={sceneEnvironment}
                options={sceneOptions}
                className="scene-environment-control"
                onChange={handleSceneEnvironment}
              />
            </div>
            <button type="button" title="Save in this browser" data-testid="save-scene" onClick={handleSave}>
              <Save size={16} /> Save
            </button>
            <button type="button" title="Load browser save" data-testid="load-scene" onClick={handleLoad}>
              <FolderOpen size={16} /> Load
            </button>
            <SharePanel
              sceneTitle={activeSceneEnvironment.title}
              moodTitle={activeMood.title}
              musicSource={musicSourceLabel}
              onCopyNote={handleCopyShareNote}
              onExportClip={handleClip}
              onExportPostcard={handlePostcard}
              onExportScene={handleExport}
              onImportScene={() => fileInputRef.current?.click()}
            />
          </div>

          <div className="audio-panel" aria-label="Audio">
            <div className="audio-panel-header">
              <span className="audio-panel-title">
                <Music2 size={16} /> {activeMood.title}
              </span>
              <button
                type="button"
                className={`audio-enable-button ${audioPrefs.enabled ? "active" : ""}`}
                data-testid="audio-toggle"
                title={audioPrefs.enabled ? "Turn sound off" : "Enable sound"}
                onClick={handleToggleSound}
              >
                {audioPrefs.enabled ? "Stop" : "Start"}
              </button>
            </div>

            <button
              type="button"
              className={`audio-mute-button ${audioPrefs.muted ? "muted" : ""}`}
              data-testid="audio-mute"
              title={audioPrefs.muted ? "Unmute" : "Mute"}
              onClick={handleMuteAudio}
            >
              {audioPrefs.muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
              {audioPrefs.muted ? "Muted" : "Mute"}
            </button>

            <SegmentedControl
              ariaLabel="Sound mood"
              value={audioPrefs.mood}
              options={moodOptions}
              className="audio-mood-control"
              onChange={handleAudioMood}
            />

            <SegmentedControl
              ariaLabel="Music source"
              value={audioPrefs.provider}
              options={providerOptions}
              className="music-source-control"
              onChange={handleMusicProvider}
            />

            {(deskRadioOpen || audioPrefs.provider === "external") && (
              <DeskRadioPanel
                inputValue={deskRadioInput}
                playbackState={deskRadioPlayback}
                source={deskRadioSource}
                usingExternalProvider={audioPrefs.provider === "external"}
                onClear={handleDeskRadioClear}
                onEmbedBlocked={handleDeskRadioBlocked}
                onEmbedReady={handleDeskRadioReady}
                onInputChange={setDeskRadioInput}
                onTune={handleDeskRadioTune}
              />
            )}

            <div className="audio-sliders">
              {AUDIO_CHANNELS.map((channel) => (
                <label className="audio-slider" key={channel}>
                  <span className="audio-slider-label">
                    {AUDIO_CHANNEL_LABELS[channel]}
                    <span
                      className="audio-info"
                      tabIndex={0}
                      role="img"
                      aria-label={AUDIO_CHANNEL_HINTS[channel]}
                      title={AUDIO_CHANNEL_HINTS[channel]}
                      data-tooltip={AUDIO_CHANNEL_HINTS[channel]}
                    >
                      <Info size={12} strokeWidth={2.2} />
                    </span>
                  </span>
                  <output>{Math.round(audioPrefs.volumes[channel] * 100)}</output>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={audioPrefs.volumes[channel]}
                    data-testid={`audio-volume-${channel}`}
                    onChange={(event) => handleAudioVolume(channel, Number(event.target.value))}
                  />
                </label>
              ))}
            </div>
          </div>
          <input ref={fileInputRef} type="file" accept="application/json" data-testid="scene-file-input" hidden onChange={handleImport} />
        </aside>
      </section>
    </main>
  );
}

function usePreviewBadge() {
  const [badge, setBadge] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const enabled = ["fresh", "visualQa", "chromeQa", "firefoxQa"].some((key) => params.has(key));
    if (!enabled) return;

    const label = params.get("fresh") ?? params.get("visualQa") ?? params.get("chromeQa") ?? params.get("firefoxQa") ?? "preview";
    const assetName = (value: string | undefined) => (value ? value.split("/").pop() : "missing");
    const script = assetName(Array.from(document.scripts, (item) => item.src).find((src) => src.includes("/assets/index-")));
    const style = assetName(
      Array.from(document.styleSheets, (sheet) => sheet.href ?? "").find((href) => href.includes("/assets/index-"))
    );
    setBadge(`${label} | js ${script} | css ${style}`);
  }, []);

  return badge;
}
