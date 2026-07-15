import { ChevronDown, ChevronUp, Sparkle } from "lucide-react";
import { DISCOVERIES, type DiscoveryId } from "../discoveries";

type DiscoveryPanelProps = {
  discovered: ReadonlySet<DiscoveryId>;
  open: boolean;
  onToggle(): void;
};

export function DiscoveryPanel({ discovered, open, onToggle }: DiscoveryPanelProps) {
  return (
    <div className="discovery-panel" aria-label="Discoveries">
      <button
        type="button"
        className="discovery-toggle"
        data-testid="discovery-toggle"
        title="Interactions you have witnessed in this browser"
        aria-expanded={open}
        onClick={onToggle}
      >
        <span>
          <Sparkle size={16} /> Discoveries
        </span>
        <span className="discovery-count" data-testid="discovery-count">
          {discovered.size}/{DISCOVERIES.length}
        </span>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      {open && (
        <ul className="discovery-list" data-testid="discovery-list">
          {DISCOVERIES.map((discovery) => {
            const seen = discovered.has(discovery.id);
            return (
              <li key={discovery.id} className={seen ? "discovery-item seen" : "discovery-item"}>
                <span className="discovery-title">{seen ? discovery.title : "???"}</span>
                <small>{seen ? discovery.description : discovery.hint}</small>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
