import type { MusicProvider, MusicProviderDef } from "./types";

export const MUSIC_PROVIDERS: MusicProviderDef[] = [
  {
    id: "generated",
    label: "Generated",
    title: "Generated lo-fi jazz",
    status: "generated music selected",
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

export const DEFAULT_MUSIC_PROVIDER: MusicProvider = "generated";

export function getMusicProviderDef(provider: MusicProvider) {
  return MUSIC_PROVIDERS.find((candidate) => candidate.id === provider) ?? MUSIC_PROVIDERS[0];
}

export function isMusicProvider(value: unknown): value is MusicProvider {
  return typeof value === "string" && MUSIC_PROVIDERS.some((candidate) => candidate.id === value);
}

export function isAvailableMusicProvider(value: unknown): value is MusicProvider {
  return typeof value === "string" && MUSIC_PROVIDERS.some((candidate) => candidate.id === value && candidate.available);
}
