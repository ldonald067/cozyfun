import { ChangeEvent, PointerEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Brush, Eraser, FolderOpen, Maximize2, Minimize2, Pause, Play, RotateCcw, Save } from "lucide-react";
import {
  AUDIO_MOODS,
  createAudioController,
  getAudioMoodDef,
  getAudioProviderDef,
  loadAudioPrefs,
  AUDIO_PROVIDERS,
  saveAudioPrefs,
  type AudioChannel,
  type AudioMood,
  type AudioPrefs,
  type AudioProvider
} from "./audio";
import { assetUrl } from "./assetUrl";
import { detectReactionCues } from "./audio/reactions";
import { SegmentedControl, type SegmentOption } from "./components/SegmentedControl";
import { AudioPanel } from "./components/AudioPanel";
import type { DeskRadioPlaybackState } from "./components/DeskRadioPanel";
import { MaterialPanel } from "./components/MaterialPanel";
import { SharePanel } from "./components/SharePanel";
import {
  loadDeskRadioSource,
  parseDeskRadioUrl,
  saveDeskRadioSource,
  type DeskRadioSource
} from "./deskRadio";
import { createEngine, type SandboxEngine } from "./engine";
import { FieldNoteJournal, NOTE_LINGER_MS, SAMPLE_EVERY_TICKS } from "./fieldNotes";
import { RoomWeather } from "./weather";
import { MATERIAL, MATERIALS, type MaterialDef, type MaterialId } from "./materials";
import {
  applySnapshot,
  downloadSnapshot,
  loadAutoLocal,
  loadLocal,
  saveAutoLocal,
  readSnapshotFile,
  saveLocal,
  type SceneSnapshotContext,
  type SceneSnapshotMetadata
} from "./storage";
import { exportClip, exportPostcard, renderSandbox } from "./renderer";
import { wakeTerrarium } from "./slowWorld";
import {
  getSceneEnvironment,
  loadSceneEnvironmentId,
  saveSceneEnvironmentId,
  SCENE_ENVIRONMENTS,
  type SceneEnvironmentId
} from "./sceneEnvironments";

const WORLD_WIDTH = 220;
// How much an absence is worth, and in what order it is spent, belongs to
// `slowWorld.ts` — see `wakeTerrarium`. What lives here is only the PACING of the
// catch-up it hands back, which is a presentation choice.
const FAST_FORWARD_TICKS_PER_FRAME = 250;
// The last stretch of catch-up plays on screen at roughly 4x, so returning to a grown
// garden means WATCHING the buds you came back to actually open, not teleporting to
// the aftermath. Everything before this window still runs invisibly fast.
const WAKE_UP_REPLAY_TICKS = 600;
const WAKE_UP_TICKS_PER_FRAME = 2;
const AUTOSAVE_INTERVAL_MS = 30_000;
const WINDOW_OPEN_KEY = "cozy-pixel-sandbox:window:v1";
const WORLD_HEIGHT = 140;
const DEFAULT_SEED = 1107;
const SIM_TICK_MS = 38;

// Powders and liquids sprinkle like a real pour; solids and the eraser paint dense.
const PAINT_DENSITY: Partial<Record<MaterialId, number>> = {
  [MATERIAL.Empty]: 100,
  [MATERIAL.Wall]: 100,
  [MATERIAL.Stone]: 100,
  [MATERIAL.Wood]: 100,
  [MATERIAL.Ice]: 100,
  [MATERIAL.Moss]: 100,
  [MATERIAL.Wellspring]: 100
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
  const activeAudioProvider = getAudioProviderDef(audioPrefs.provider);
  const soundSourceLabel = audioPrefs.provider === "external" && deskRadioSource ? deskRadioSource.label : activeAudioProvider.label;
  const [engine, setEngine] = useState<SandboxEngine | null>(null);
  const [selected, setSelected] = useState<MaterialId>(MATERIAL.Sand);
  const [sceneEnvironment, setSceneEnvironment] = useState<SceneEnvironmentId>(() => loadSceneEnvironmentId());
  const activeSceneEnvironment = getSceneEnvironment(sceneEnvironment);
  const [brushSize, setBrushSize] = useState(4);
  const [paused, setPaused] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  // One window tends the terrarium at a time. The newest surface (embed, tab, whatever)
  // claims it over a BroadcastChannel; everyone else pauses with a clear status. Two live
  // engines diverging from the same autosave was the "why does it look different over
  // there" bug — ownership makes the second copy impossible instead of merely less likely.
  const ownershipRef = useRef<{ channel: BroadcastChannel | null; id: string }>({ channel: null, id: "" });
  // Ownership has to gate WRITES, not just the tick loop. Pausing a losing window still
  // left it finishing its wake-up catch-up and still let its unconditional close-handler
  // save fire, so closing a stale second copy could overwrite the scene the player had
  // just been tending in the other one. Defaults to true: a lone window in a browser
  // without BroadcastChannel is the owner by default, or nothing would ever save.
  const ownsTerrariumRef = useRef(true);
  const [status, setStatus] = useState("warming tray");
  const [fps, setFps] = useState(0);
  const [fieldNote, setFieldNote] = useState<string | null>(null);
  const [windowOpen, setWindowOpen] = useState(() => localStorage.getItem(WINDOW_OPEN_KEY) !== "shut");
  const windowOpenRef = useRef(windowOpen);
  const sceneEnvironmentRef = useRef<SceneEnvironmentId | null>(null);
  const weatherRef = useRef<RoomWeather | null>(null);
  const fieldNoteJournalRef = useRef<FieldNoteJournal | null>(null);
  const fieldNoteTimerRef = useRef(0);
  const fastForwardRef = useRef(0);
  const snapshotContextRef = useRef<SceneSnapshotContext | null>(null);
  const baseCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const glowCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const motesCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const pointerDownRef = useRef(false);
  const lastPaintCellRef = useRef<{ x: number; y: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let active = true;
    let createdEngine: SandboxEngine | null = null;
    createEngine(WORLD_WIDTH, WORLD_HEIGHT, DEFAULT_SEED, assetUrl("sim/cozy_sandbox_sim.wasm")).then((created) => {
      if (!active) {
        created.dispose();
        return;
      }
      createdEngine = created;
      setEngine(created);
      // Resume the saved terrarium and wake it: `wakeTerrarium` takes the slow steps
      // the absence earned and hands back the ordinary catch-up still owed, which runs
      // chunked inside the render loop (fastForwardRef) so boot never blocks.
      weatherRef.current = new RoomWeather();
      const auto = loadAutoLocal(created);
      const restored = auto.loaded ? auto : loadLocal(created);
      if (restored.loaded) {
        applySnapshotMetadata(restored.metadata);
        const savedAtMs = restored.savedAt ? Date.parse(restored.savedAt) : Number.NaN;
        const secondsAway = Number.isFinite(savedAtMs) ? Math.floor((Date.now() - savedAtMs) / 1000) : 0;
        const woken = wakeTerrarium(created, secondsAway);
        if (woken.catchUpTicks >= 60) {
          fastForwardRef.current = woken.catchUpTicks;
          setStatus(
            woken.slowSteps > 0
              ? "your terrarium changed while you were away"
              : "your terrarium kept growing while you were away"
          );
        } else {
          setStatus("terrarium resumed");
        }
      } else {
        setStatus(created.source === "wasm" ? "wasm sim online" : "js fallback online");
      }
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
    audio.setRoom(sceneEnvironment);
  }, [audio, sceneEnvironment]);

  useEffect(() => {
    if (audioPrefs.provider !== "external" || deskRadioSource) return;
    setAudioPrefs((current) => ({ ...current, provider: "native" }));
    audio.setAudioProvider("native");
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
      if (fastForwardRef.current > 0 && ownsTerrariumRef.current) {
        // Catching up on time away. Chunked so even the JS fallback stays responsive,
        // and reaction cues are skipped — 4000 ticks of retroactive pops would be noise.
        // The final WAKE_UP_REPLAY_TICKS play at ~4x so the wake-up is watched, not skipped.
        const chunk = fastForwardRef.current > WAKE_UP_REPLAY_TICKS
          ? Math.min(FAST_FORWARD_TICKS_PER_FRAME, fastForwardRef.current - WAKE_UP_REPLAY_TICKS)
          : Math.min(WAKE_UP_TICKS_PER_FRAME, fastForwardRef.current);
        for (let i = 0; i < chunk; i++) engine.tick();
        fastForwardRef.current -= chunk;
        lastSimTick = time;
      } else if (!paused && time - lastSimTick >= SIM_TICK_MS) {
        const reactionCellsBefore = audio.canPlayReactionCues() ? engine.getCellBytes() : null;
        engine.tick();
        if (reactionCellsBefore) {
          audio.playReactionCues(detectReactionCues(reactionCellsBefore, engine.getCellBytes()));
        }
        // Field notes sample on a slow cadence, never during catch-up: a retroactive
        // discovery is exactly the "wait, what was that?" confusion they exist to avoid.
        if (engine.tickCount() % SAMPLE_EVERY_TICKS === 0) {
          fieldNoteJournalRef.current ??= new FieldNoteJournal();
          const note = fieldNoteJournalRef.current.sample(engine.getCellBytes(), performance.now());
          if (note) {
            setFieldNote(note.text);
            window.clearTimeout(fieldNoteTimerRef.current);
            fieldNoteTimerRef.current = window.setTimeout(() => setFieldNote(null), NOTE_LINGER_MS);
          }
        }
        // Room weather: real cells through the same paint API as the brush. The drop is
        // also registered as "brushwork" with the journal, so tonight's sky can never
        // masquerade as a discovery the player made.
        if (windowOpenRef.current && sceneEnvironmentRef.current) {
          const drop = weatherRef.current?.drop(
            sceneEnvironmentRef.current,
            engine.tickCount(),
            engine.width(),
            engine.height(),
            () => engine.getCellBytes()
          );
          if (drop) {
            engine.paint(drop.x, drop.y, drop.radius, drop.material, drop.density);
            fieldNoteJournalRef.current?.notePaint(drop.material, performance.now());
          }
        }
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
  }, [audio, engine, paused]);

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

  const providerOptions = useMemo<SegmentOption<AudioProvider>[]>(
    () =>
      AUDIO_PROVIDERS.map((provider) => ({
        value: provider.id,
        label: provider.label,
        title: provider.title,
        badge: provider.badge,
        testId: `audio-provider-${provider.id}`
      })),
    []
  );

  const selectedMaterial = useMemo(() => MATERIALS.find((material) => material.id === selected) ?? MATERIALS[0], [selected]);

  const sceneShellStyle = useMemo(
    () =>
      ({
        "--room-image": `url("${assetUrl(activeSceneEnvironment.image)}")`,
        "--room-image-position": activeSceneEnvironment.imagePosition,
        "--room-image-opacity": activeSceneEnvironment.imageOpacity,
        "--room-image-filter": activeSceneEnvironment.imageFilter,
        "--selected-material-color": selectedMaterial.color
      }) as React.CSSProperties,
    [activeSceneEnvironment, selectedMaterial.color]
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
      audioProvider: audioPrefs.provider,
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
      const density = PAINT_DENSITY[selected] ?? 55;
      // Interpolate between pointer events so fast strokes paint continuous lines.
      const last = lastPaintCellRef.current;
      if (last) {
        const steps = Math.max(Math.abs(x - last.x), Math.abs(y - last.y), 1);
        for (let step = 1; step <= steps; step++) {
          engine.paint(
            Math.round(last.x + ((x - last.x) * step) / steps),
            Math.round(last.y + ((y - last.y) * step) / steps),
            brushSize,
            selected,
            density
          );
        }
      } else {
        engine.paint(x, y, brushSize, selected, density);
      }
      lastPaintCellRef.current = { x, y };
      if (paused) setPaused(false);
      claimOwnership();
      fieldNoteJournalRef.current?.notePaint(selected, performance.now());
      audio.playPaintCue(selected);
    },
    [audio, brushSize, engine, paused, selected]
  );

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    pointerDownRef.current = true;
    lastPaintCellRef.current = null;
    event.currentTarget.setPointerCapture(event.pointerId);
    paintAtPointer(event);
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!pointerDownRef.current) return;
    paintAtPointer(event);
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    pointerDownRef.current = false;
    lastPaintCellRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function handleSelectMaterial(material: MaterialDef) {
    setSelected(material.id);
    // Teach the material's behavior in the status line, so touch and keyboard
    // players (who never see the hover tooltip) learn how each one plays.
    setStatus(`${material.label}: ${material.description}`);
  }

  function applySnapshotMetadata(metadata: SceneSnapshotMetadata | null) {
    if (!metadata) return;
    const deskRadio = metadata.musicProvider === "external" ? (metadata.deskRadio ?? null) : null;
    const audioProvider: AudioProvider = metadata.musicProvider === "external" ? "external" : "native";
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
    setAudioPrefs((current) => ({ ...current, mood: metadata.mood, provider: audioProvider }));
    audio.setMoodAndRoom(metadata.mood, metadata.room);
    audio.setAudioProvider(audioProvider);
  }

  function handleClear() {
    if (!engine) return;
    engine.clear();
    setStatus("tray cleared");
  }

  useEffect(() => {
    snapshotContextRef.current = snapshotContext;
  }, [snapshotContext]);

  useEffect(() => {
    windowOpenRef.current = windowOpen;
    localStorage.setItem(WINDOW_OPEN_KEY, windowOpen ? "open" : "shut");
  }, [windowOpen]);

  useEffect(() => {
    sceneEnvironmentRef.current = sceneEnvironment;
  }, [sceneEnvironment]);

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const id = crypto.randomUUID();
    const channel = new BroadcastChannel("cozy-pixel-sandbox:owner");
    ownershipRef.current = { channel, id };
    channel.onmessage = (event) => {
      if (event.data?.type !== "claim" || event.data.id === id) return;
      // Someone else took the desk chair. Sit back; unpausing or painting reclaims it.
      // Standing up means stopping any catch-up still in flight AND giving up the right
      // to write the save, not merely stopping the clock.
      ownsTerrariumRef.current = false;
      setPaused(true);
      setStatus("another window is tending this terrarium — press play to take over");
    };
    channel.postMessage({ type: "claim", id });
    return () => {
      channel.close();
      ownershipRef.current = { channel: null, id: "" };
    };
  }, []);

  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  useEffect(() => {
    if (!engine) return;
    // Autosave makes "grow while you were away" real: without it only players who
    // pressed Save ever had a scene to come back to. pagehide catches tab closes.
    // ?cozyNoAutosave=1 is a QA hook: the pagehide save records "last seen" so
    // faithfully that a test can never stage an old timestamp without it.
    if (new URLSearchParams(window.location.search).has("cozyNoAutosave")) return;
    // Only the window tending the terrarium may write it. Two windows run live engines
    // against the same storage key, so any write from the other one is how "my scene
    // looks different over there" happens — and on close it is worse than a diff, it is
    // the stale copy landing last. The visibility check stays on top of ownership: a
    // background tab that still holds the claim has nothing new worth saving either.
    const save = () => {
      if (!ownsTerrariumRef.current) return;
      saveAutoLocal(engine, snapshotContextRef.current ?? undefined);
    };
    const interval = window.setInterval(() => {
      if (!document.hidden) save();
    }, AUTOSAVE_INTERVAL_MS);
    // pagehide is what records "last seen" for the away-time growth, so the owner must
    // still save on close even though it is about to become hidden.
    window.addEventListener("pagehide", save);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("pagehide", save);
    };
  }, [engine]);

  function claimOwnership() {
    ownsTerrariumRef.current = true;
    ownershipRef.current.channel?.postMessage({ type: "claim", id: ownershipRef.current.id });
  }

  async function handleFullscreen() {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        // Inside the embed iframe this fills the whole screen (allow="fullscreen" is
        // already on the iframe), which makes opening a second copy in a new tab
        // unnecessary — and a second copy is a second, diverging terrarium.
        await document.documentElement.requestFullscreen();
      }
    } catch {
      setStatus("fullscreen unavailable");
    }
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
      soundSource: soundSourceLabel
    });
    setStatus("postcard PNG exported");
  }

  async function handleClip() {
    if (!engine || !baseCanvasRef.current || !glowCanvasRef.current) return;
    setStatus("recording clip");
    const exported = await exportClip(engine, baseCanvasRef.current, glowCanvasRef.current, {
      sceneTitle: activeSceneEnvironment.title,
      moodTitle: activeMood.title,
      soundSource: soundSourceLabel
    });
    setStatus(exported ? "clip WebM exported" : "clip unavailable");
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
    const ready = await audio.init(nextPrefs, sceneEnvironment);
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

  function handleAudioProvider(provider: AudioProvider) {
    const providerDef = getAudioProviderDef(provider);
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
    audio.setAudioProvider(provider);
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
    audio.setAudioProvider("external");
    setStatus("checking desk radio");
  }

  function handleDeskRadioClear() {
    setDeskRadioSource(null);
    setDeskRadioInput("");
    setDeskRadioOpen(false);
    setDeskRadioPlayback("idle");
    saveDeskRadioSource(null);
    setAudioPrefs((current) => ({ ...current, provider: "native" }));
    audio.setAudioProvider("native");
    setStatus("native ambience selected");
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
    setAudioPrefs((current) => (current.provider === "external" ? { ...current, provider: "native" } : current));
    audio.setAudioProvider("native");
    setStatus(code === 101 || code === 150 ? "YouTube blocked embed; native ambience restored" : "YouTube player unavailable; native ambience restored");
  }

  function handleSceneEnvironment(id: SceneEnvironmentId) {
    const scene = getSceneEnvironment(id);
    setSceneEnvironment(id);
    setAudioPrefs((current) => ({ ...current, mood: scene.mood }));
    audio.setMoodAndRoom(scene.mood, id);
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
        <MaterialPanel groupedMaterials={groupedMaterials} selected={selected} onSelect={handleSelectMaterial} />

        <section className="sandbox-stage">
          <div
            className="tray"
            data-testid="sandbox-tray"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            <canvas ref={baseCanvasRef} className="sandbox-canvas base-canvas" />
            <canvas ref={glowCanvasRef} className="sandbox-canvas glow-canvas" />
            <div className="glass-sheen" aria-hidden="true" />
          </div>
          <div className="status-bar">
            <span data-testid="status-message" role="status" aria-live="polite">{status}</span>
            <span className="field-note" data-testid="field-note" aria-live="polite">
              {fieldNote ?? ""}
            </span>
            <span className="status-meta">
              {paused && <span className="status-paused">paused</span>}
              {engine?.source ?? "loading"} - {fps} fps
            </span>
          </div>
        </section>

        <aside className="control-panel" aria-label="Controls">
          <div className="control-row">
            <button
              type="button"
              className="icon-button"
              title={paused ? "Play" : "Pause"}
              aria-label={paused ? "Play simulation" : "Pause simulation"}
              data-testid="pause-toggle"
              onClick={() => {
                setPaused((value) => {
                  if (value) claimOwnership();
                  return !value;
                });
              }}
            >
              {paused ? <Play size={18} /> : <Pause size={18} />}
            </button>
            {document.fullscreenEnabled && (
              <button
                type="button"
                title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
                aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
                data-testid="fullscreen-toggle"
                onClick={handleFullscreen}
              >
                {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
              </button>
            )}
            <button type="button" className="icon-button" title="Clear" aria-label="Clear tray" data-testid="clear-scene" onClick={handleClear}>
              <RotateCcw size={18} />
            </button>
            <button
              type="button"
              className="icon-button"
              title="Use eraser"
              aria-label="Use eraser"
              onClick={() => {
                setSelected(MATERIAL.Empty);
                setStatus("Eraser ready");
              }}
            >
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
              <button
                type="button"
                className="window-toggle"
                data-testid="window-toggle"
                title="With the window open, the room's weather drifts into the tray as real material"
                aria-pressed={windowOpen}
                onClick={() => setWindowOpen((open) => !open)}
              >
                {windowOpen ? "window: open" : "window: shut"}
              </button>
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
              soundSource={soundSourceLabel}
              onExportClip={handleClip}
              onExportPostcard={handlePostcard}
              onExportScene={handleExport}
              onImportScene={() => fileInputRef.current?.click()}
            />
          </div>

          <AudioPanel
            activeMoodTitle={activeMood.title}
            audioPrefs={audioPrefs}
            deskRadioInput={deskRadioInput}
            deskRadioOpen={deskRadioOpen}
            deskRadioPlayback={deskRadioPlayback}
            deskRadioSource={deskRadioSource}
            moodOptions={moodOptions}
            providerOptions={providerOptions}
            onAudioMood={handleAudioMood}
            onAudioVolume={handleAudioVolume}
            onDeskRadioBlocked={handleDeskRadioBlocked}
            onDeskRadioClear={handleDeskRadioClear}
            onDeskRadioInputChange={setDeskRadioInput}
            onDeskRadioReady={handleDeskRadioReady}
            onDeskRadioTune={handleDeskRadioTune}
            onAudioProvider={handleAudioProvider}
            onMuteAudio={handleMuteAudio}
            onToggleSound={handleToggleSound}
          />
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
