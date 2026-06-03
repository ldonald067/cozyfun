import { useEffect, useRef } from "react";
import { ExternalLink, Radio, X } from "lucide-react";
import { deskRadioDisplayLabel, deskRadioWatchUrl, type DeskRadioSource } from "../deskRadio";

export type DeskRadioPlaybackState = "idle" | "loading" | "ready" | "blocked";

type YouTubeEvent = {
  data?: number;
};

type YouTubePlayer = {
  destroy(): void;
};

type YouTubePlayerOptions = {
  videoId?: string;
  playerVars: Record<string, number | string>;
  events: {
    onReady(): void;
    onError(event: YouTubeEvent): void;
  };
};

type YouTubeNamespace = {
  Player: new (element: HTMLElement, options: YouTubePlayerOptions) => YouTubePlayer;
};

declare global {
  interface Window {
    YT?: YouTubeNamespace;
    onYouTubeIframeAPIReady?: () => void;
    __cozyYouTubeApiPromise?: Promise<YouTubeNamespace>;
  }
}

type DeskRadioPanelProps = {
  inputValue: string;
  playbackState: DeskRadioPlaybackState;
  source: DeskRadioSource | null;
  usingExternalProvider: boolean;
  onClear(): void;
  onEmbedBlocked(code: number): void;
  onEmbedReady(source: DeskRadioSource): void;
  onInputChange(value: string): void;
  onTune(): void;
};

export function DeskRadioPanel({
  inputValue,
  playbackState,
  source,
  usingExternalProvider,
  onClear,
  onEmbedBlocked,
  onEmbedReady,
  onInputChange,
  onTune
}: DeskRadioPanelProps) {
  const watchUrl = source ? deskRadioWatchUrl(source) : "";

  return (
    <form
      className="desk-radio-panel"
      aria-label="Desk Radio"
      onSubmit={(event) => {
        event.preventDefault();
        onTune();
      }}
    >
      <div className="desk-radio-header">
        <span>
          <Radio size={15} /> Desk Radio
        </span>
        {source && (
          <button type="button" className="desk-radio-clear" title="Clear desk radio" data-testid="desk-radio-clear" onClick={onClear}>
            <X size={14} />
          </button>
        )}
      </div>
      {source && usingExternalProvider && (
        <DeskRadioPlayer
          key={`${source.kind}:${source.id}:${source.startSeconds ?? 0}`}
          source={source}
          onBlocked={onEmbedBlocked}
          onReady={() => onEmbedReady(source)}
        />
      )}
      {source && playbackState === "ready" && usingExternalProvider && (
        <div className="desk-radio-now" data-testid="desk-radio-now">
          <span>{deskRadioDisplayLabel(source)}</span>
          <a href={watchUrl} target="_blank" rel="noreferrer" aria-label="Open Desk Radio source on YouTube">
            <ExternalLink size={12} />
            Open
          </a>
        </div>
      )}
      {source && playbackState === "loading" && usingExternalProvider && <p className="desk-radio-hint">Checking YouTube player...</p>}
      {source && playbackState === "blocked" && (
        <div className="desk-radio-message" data-testid="desk-radio-message">
          <strong>YouTube will not embed this link.</strong>
          <span>Generated music is still playing. Try a public video or playlist with embedding enabled.</span>
          <a href={watchUrl} target="_blank" rel="noreferrer">
            Open on YouTube
          </a>
        </div>
      )}
      <div className="desk-radio-controls">
        <input
          type="text"
          inputMode="url"
          value={inputValue}
          placeholder="YouTube URL or video ID"
          aria-label="YouTube desk radio URL"
          data-testid="desk-radio-input"
          onChange={(event) => onInputChange(event.target.value)}
        />
        <button type="submit" data-testid="desk-radio-tune">
          Tune
        </button>
      </div>
    </form>
  );
}

function DeskRadioPlayer({
  source,
  onBlocked,
  onReady
}: {
  source: DeskRadioSource;
  onBlocked(code: number): void;
  onReady(): void;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const onBlockedRef = useRef(onBlocked);
  const onReadyRef = useRef(onReady);

  useEffect(() => {
    onBlockedRef.current = onBlocked;
    onReadyRef.current = onReady;
  }, [onBlocked, onReady]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let cancelled = false;
    let player: YouTubePlayer | null = null;
    const mount = document.createElement("div");
    host.replaceChildren(mount);

    loadYouTubeApi()
      .then((youtube) => {
        if (cancelled) return;
        const playerVars: Record<string, number | string> = {
          origin: window.location.origin,
          playsinline: 1,
          rel: 0
        };
        if (source.kind === "playlist") {
          playerVars.listType = "playlist";
          playerVars.list = source.id;
        }
        if (source.kind === "video" && source.startSeconds) {
          playerVars.start = source.startSeconds;
        }

        player = new youtube.Player(mount, {
          videoId: source.kind === "video" ? source.id : undefined,
          playerVars,
          events: {
            onReady: () => {
              if (!cancelled) onReadyRef.current();
            },
            onError: (event) => {
              if (!cancelled) onBlockedRef.current(Number(event.data ?? 0));
            }
          }
        });
      })
      .catch(() => {
        if (!cancelled) onBlockedRef.current(0);
      });

    return () => {
      cancelled = true;
      player?.destroy();
      host.replaceChildren();
    };
  }, [source.id, source.kind, source.startSeconds]);

  return <div ref={hostRef} className="desk-radio-frame" data-testid="desk-radio-frame" aria-label="YouTube Desk Radio player" />;
}

function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (window.__cozyYouTubeApiPromise) return window.__cozyYouTubeApiPromise;

  window.__cozyYouTubeApiPromise = new Promise((resolve, reject) => {
    const previousReady = window.onYouTubeIframeAPIReady;
    let poll: number | undefined;
    let timeout: number | undefined;

    const cleanup = () => {
      if (poll) window.clearInterval(poll);
      if (timeout) window.clearTimeout(timeout);
    };

    const resolveReady = () => {
      if (!window.YT?.Player) return false;
      cleanup();
      resolve(window.YT);
      return true;
    };

    const fail = (message: string) => {
      cleanup();
      window.__cozyYouTubeApiPromise = undefined;
      reject(new Error(message));
    };

    window.onYouTubeIframeAPIReady = () => {
      previousReady?.();
      if (!resolveReady()) fail("YouTube player API did not load");
    };

    const existing = document.querySelector('script[data-cozy-youtube-api="true"]');
    poll = window.setInterval(resolveReady, 80);
    timeout = window.setTimeout(() => fail("YouTube player API timed out"), 10_000);
    if (existing) return;

    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.dataset.cozyYoutubeApi = "true";
    script.onerror = () => fail("YouTube player API failed");
    document.head.appendChild(script);
  });

  return window.__cozyYouTubeApiPromise;
}
