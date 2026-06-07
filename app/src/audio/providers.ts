import type { AudioProvider, AudioProviderDef } from "./types";

export const AUDIO_PROVIDERS: AudioProviderDef[] = [
  {
    id: "native",
    label: "Native",
    title: "Native ambience",
    status: "native ambience selected",
    available: true
  },
  {
    id: "external",
    label: "Desk Radio",
    title: "YouTube desk radio",
    status: "desk radio selected",
    available: true
  }
];

export const DEFAULT_AUDIO_PROVIDER: AudioProvider = "native";

export function getAudioProviderDef(provider: AudioProvider) {
  return AUDIO_PROVIDERS.find((candidate) => candidate.id === provider) ?? AUDIO_PROVIDERS[0];
}

export function isAudioProvider(value: unknown): value is AudioProvider {
  return typeof value === "string" && AUDIO_PROVIDERS.some((candidate) => candidate.id === value);
}

export function isAvailableAudioProvider(value: unknown): value is AudioProvider {
  return typeof value === "string" && AUDIO_PROVIDERS.some((candidate) => candidate.id === value && candidate.available);
}

export function normalizeAudioProvider(value: unknown): AudioProvider {
  if (value === "generated") return "native";
  return isAvailableAudioProvider(value) ? value : DEFAULT_AUDIO_PROVIDER;
}
