import type { CSSProperties } from "react";
import {
  BrickWall,
  CloudFog,
  Droplet,
  Eraser,
  Flame,
  Flower2,
  Gem,
  Grid2x2,
  Leaf,
  Moon,
  Mountain,
  Orbit,
  Shell,
  Snowflake,
  Sparkle,
  Sparkles,
  Sprout,
  TreePine,
  Waves,
  Wind,
  type LucideIcon
} from "lucide-react";
import { MATERIAL, type MaterialDef, type MaterialId } from "../materials";

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
  [MATERIAL.Moonwater]: Moon,
  [MATERIAL.Glass]: Grid2x2,
  [MATERIAL.Ember]: Flame,
  [MATERIAL.Pollen]: Sparkle
};

type MaterialPanelProps = {
  groupedMaterials: Record<string, MaterialDef[]>;
  selected: MaterialId;
  onSelect(material: MaterialDef): void;
};

export function MaterialPanel({ groupedMaterials, selected, onSelect }: MaterialPanelProps) {
  return (
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
              const materialHint = `${material.label}: ${material.description} Identity: ${material.identity.join("; ")}.`;
              return (
                <button
                  className={`material-button ${selected === material.id ? "active" : ""}`}
                  key={material.id}
                  type="button"
                  aria-label={materialHint}
                  title={materialHint}
                  style={{ "--material-color": material.color } as CSSProperties}
                  onClick={() => onSelect(material)}
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
  );
}
