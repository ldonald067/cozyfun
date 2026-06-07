import { Clapperboard, Copy, FileJson, FolderOpen, ImageDown, Share2 } from "lucide-react";

type SharePanelProps = {
  sceneTitle: string;
  moodTitle: string;
  soundSource: string;
  onCopyNote(): void;
  onExportClip(): void;
  onExportPostcard(): void;
  onExportScene(): void;
  onImportScene(): void;
};

export function SharePanel({
  sceneTitle,
  moodTitle,
  soundSource,
  onCopyNote,
  onExportClip,
  onExportPostcard,
  onExportScene,
  onImportScene
}: SharePanelProps) {
  return (
    <div className="share-panel" aria-label="Share and export">
      <div className="share-panel-header">
        <span>
          <Share2 size={16} /> Share
        </span>
      </div>
      <div className="share-summary">
        <span>{sceneTitle}</span>
        <small>{moodTitle} / {soundSource}</small>
      </div>
      <div className="share-actions">
        <button type="button" title="Download scene JSON" data-testid="export-scene" onClick={onExportScene}>
          <FileJson size={16} /> Scene
        </button>
        <button type="button" title="Import scene JSON" data-testid="import-scene" onClick={onImportScene}>
          <FolderOpen size={16} /> Import
        </button>
        <button type="button" title="Download postcard PNG" data-testid="postcard-scene" onClick={onExportPostcard}>
          <ImageDown size={16} /> Card
        </button>
        <button type="button" title="Record short WebM clip" data-testid="clip-scene" onClick={onExportClip}>
          <Clapperboard size={16} /> Clip
        </button>
        <button type="button" title="Copy share note" data-testid="copy-share-note" onClick={onCopyNote}>
          <Copy size={16} /> Note
        </button>
      </div>
    </div>
  );
}
