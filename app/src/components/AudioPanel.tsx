import { CloudRain, Info, Volume2, VolumeX } from "lucide-react";
import {
  AUDIO_CHANNELS,
  type AudioChannel,
  type AudioMood,
  type AudioPrefs,
  type AudioProvider
} from "../audio";
import type { DeskRadioSource } from "../deskRadio";
import { DeskRadioPanel, type DeskRadioPlaybackState } from "./DeskRadioPanel";
import { SegmentedControl, type SegmentOption } from "./SegmentedControl";

const AUDIO_CHANNEL_LABELS: Record<AudioChannel, string> = {
  master: "Master",
  ambience: "Ambience"
};

const AUDIO_CHANNEL_HINTS: Record<AudioChannel, string> = {
  master: "Overall volume for the whole soundscape.",
  ambience: "Native rain, thunder, creek, fire crackle, and material cues."
};

type AudioPanelProps = {
  activeMoodTitle: string;
  audioPrefs: AudioPrefs;
  deskRadioInput: string;
  deskRadioOpen: boolean;
  deskRadioPlayback: DeskRadioPlaybackState;
  deskRadioSource: DeskRadioSource | null;
  moodOptions: SegmentOption<AudioMood>[];
  providerOptions: SegmentOption<AudioProvider>[];
  onAudioMood(mood: AudioMood): void;
  onAudioProvider(provider: AudioProvider): void;
  onAudioVolume(channel: AudioChannel, value: number): void;
  onDeskRadioBlocked(code: number): void;
  onDeskRadioClear(): void;
  onDeskRadioInputChange(value: string): void;
  onDeskRadioReady(source: DeskRadioSource): void;
  onDeskRadioTune(): void;
  onMuteAudio(): void;
  onToggleSound(): void | Promise<void>;
};

export function AudioPanel({
  activeMoodTitle,
  audioPrefs,
  deskRadioInput,
  deskRadioOpen,
  deskRadioPlayback,
  deskRadioSource,
  moodOptions,
  providerOptions,
  onAudioMood,
  onAudioProvider,
  onAudioVolume,
  onDeskRadioBlocked,
  onDeskRadioClear,
  onDeskRadioInputChange,
  onDeskRadioReady,
  onDeskRadioTune,
  onMuteAudio,
  onToggleSound
}: AudioPanelProps) {
  return (
    <div className="audio-panel" aria-label="Audio">
      <div className="audio-panel-header">
        <span className="audio-panel-title">
          <CloudRain size={16} /> {activeMoodTitle}
        </span>
        <button
          type="button"
          className={`audio-enable-button ${audioPrefs.enabled ? "active" : ""}`}
          data-testid="audio-toggle"
          title={audioPrefs.enabled ? "Turn sound off" : "Enable sound"}
          onClick={onToggleSound}
        >
          {audioPrefs.enabled ? "Stop" : "Start"}
        </button>
      </div>

      <button
        type="button"
        className={`audio-mute-button ${audioPrefs.muted ? "muted" : ""}`}
        data-testid="audio-mute"
        title={audioPrefs.muted ? "Unmute" : "Mute"}
        onClick={onMuteAudio}
      >
        {audioPrefs.muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
        {audioPrefs.muted ? "Muted" : "Mute"}
      </button>

      <SegmentedControl
        ariaLabel="Sound mood"
        value={audioPrefs.mood}
        options={moodOptions}
        className="audio-mood-control"
        onChange={onAudioMood}
      />

      <SegmentedControl
        ariaLabel="Sound source"
        value={audioPrefs.provider}
        options={providerOptions}
        className="audio-source-control"
        onChange={onAudioProvider}
      />

      {(deskRadioOpen || audioPrefs.provider === "external") && (
        <DeskRadioPanel
          inputValue={deskRadioInput}
          playbackState={deskRadioPlayback}
          source={deskRadioSource}
          usingExternalProvider={audioPrefs.provider === "external"}
          onClear={onDeskRadioClear}
          onEmbedBlocked={onDeskRadioBlocked}
          onEmbedReady={onDeskRadioReady}
          onInputChange={onDeskRadioInputChange}
          onTune={onDeskRadioTune}
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
              onChange={(event) => onAudioVolume(channel, Number(event.target.value))}
            />
          </label>
        ))}
      </div>
    </div>
  );
}
