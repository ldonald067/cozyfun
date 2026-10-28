import type { CSSProperties } from "react";
import type { MaterialDef, MaterialId } from "../materials";
import { MaterialChip, readableMaterialColor } from "./MaterialChip";

type MaterialPanelProps = {
  groupedMaterials: Record<string, MaterialDef[]>;
  selected: MaterialId;
  onSelect(material: MaterialDef): void;
};

export function MaterialPanel({ groupedMaterials, selected, onSelect }: MaterialPanelProps) {
  return (
    <aside className="tool-panel" aria-label="Materials">
      <div className="brand-mark">
        <span>Night Desk Terrarium</span>
      </div>

      {Object.entries(groupedMaterials).map(([group, materials]) => (
        <div className="tool-group" key={group}>
          <span className="group-label">{group}</span>
          <div className="material-grid">
            {materials.map((material) => {
              const materialHint = `${material.label}: ${material.description} Identity: ${material.identity.join("; ")}.`;
              return (
                <button
                  className={`material-button ${selected === material.id ? "active" : ""}`}
                  key={material.id}
                  type="button"
                  aria-label={materialHint}
                  aria-pressed={selected === material.id}
                  title={materialHint}
                  style={{ "--material-color": readableMaterialColor(material.color) } as CSSProperties}
                  onClick={() => onSelect(material)}
                >
                  <MaterialChip material={material} />
                  <span>{material.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </aside>
  );
}
