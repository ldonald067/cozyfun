const DESK_RADIO_KEY = "cozy-pixel-sandbox:desk-radio:v1";

export type DeskRadioSource = {
  kind: "video" | "playlist";
  id: string;
  label: string;
  startSeconds?: number;
};

export function loadDeskRadioSource(): DeskRadioSource | null {
  try {
    const raw = localStorage.getItem(DESK_RADIO_KEY);
    return raw ? validateDeskRadioSource(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function saveDeskRadioSource(source: DeskRadioSource | null) {
  try {
    if (source) localStorage.setItem(DESK_RADIO_KEY, JSON.stringify(source));
    else localStorage.removeItem(DESK_RADIO_KEY);
  } catch {
    // Desk Radio is optional; storage failure should not block the sandbox.
  }
}

export function parseDeskRadioUrl(value: string): DeskRadioSource | null {
  const text = value.trim();
  if (!text) return null;
  if (/^[a-zA-Z0-9_-]{11}$/.test(text)) return videoSource(text);

  try {
    const url = new URL(text);
    const host = url.hostname.replace(/^www\./, "");
    const startSeconds = parseStartSeconds(url);
    if (host === "youtu.be") return videoSource(url.pathname.split("/").filter(Boolean)[0], startSeconds);
    if (host !== "youtube.com" && host !== "music.youtube.com" && host !== "m.youtube.com" && host !== "youtube-nocookie.com") {
      return null;
    }

    const playlist = url.searchParams.get("list");
    if (playlist) return playlistSource(playlist);

    if (url.pathname === "/watch") return videoSource(url.searchParams.get("v"), startSeconds);
    const [, route, id] = url.pathname.split("/");
    if (route === "embed" || route === "live" || route === "shorts") return videoSource(id, startSeconds);
    return null;
  } catch {
    return null;
  }
}

export function validateDeskRadioSource(value: unknown): DeskRadioSource | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<DeskRadioSource>;
  if (candidate.kind === "video") return videoSource(candidate.id, candidate.startSeconds);
  if (candidate.kind === "playlist") return playlistSource(candidate.id);
  return null;
}

export function deskRadioWatchUrl(source: DeskRadioSource) {
  if (source.kind === "playlist") return `https://www.youtube.com/playlist?list=${source.id}`;
  const start = source.startSeconds ? `&t=${source.startSeconds}s` : "";
  return `https://www.youtube.com/watch?v=${source.id}${start}`;
}

export function deskRadioDisplayLabel(source: DeskRadioSource) {
  if (source.kind === "playlist") return "Playlist";
  if (!source.startSeconds) return "Video";
  return `Video - starts ${formatDuration(source.startSeconds)}`;
}

function videoSource(id: unknown, startSeconds?: unknown): DeskRadioSource | null {
  if (typeof id !== "string" || !/^[a-zA-Z0-9_-]{11}$/.test(id)) return null;
  const start = normalizeStartSeconds(startSeconds);
  return { kind: "video", id, label: "YouTube video", ...(start ? { startSeconds: start } : {}) };
}

function playlistSource(id: unknown): DeskRadioSource | null {
  if (typeof id !== "string" || !/^[a-zA-Z0-9_-]{10,80}$/.test(id)) return null;
  return { kind: "playlist", id, label: "YouTube playlist" };
}

function parseStartSeconds(url: URL) {
  return normalizeStartSeconds(url.searchParams.get("start") ?? url.searchParams.get("t"));
}

function normalizeStartSeconds(value: unknown) {
  if (typeof value === "number") return Number.isInteger(value) && value > 0 && value <= 86_400 ? value : undefined;
  if (typeof value !== "string" || value.trim().length === 0) return undefined;
  const text = value.trim().toLowerCase();
  if (/^\d+$/.test(text)) return normalizeStartSeconds(Number(text));

  const match = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/.exec(text);
  if (!match) return undefined;
  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2] ?? 0);
  const seconds = Number(match[3] ?? 0);
  return normalizeStartSeconds(hours * 3600 + minutes * 60 + seconds);
}

function formatDuration(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const paddedSeconds = String(seconds).padStart(2, "0");
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, "0")}:${paddedSeconds}`;
  return `${minutes}:${paddedSeconds}`;
}
