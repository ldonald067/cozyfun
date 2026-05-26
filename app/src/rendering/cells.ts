import { CELL_STRIDE, MATERIAL } from "../materials";

export function readU16(bytes: Uint8Array, offset: number) {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

export function kindAt(cells: Uint8Array, width: number, height: number, x: number, y: number) {
  if (x < 0 || y < 0 || x >= width || y >= height) return -1;
  return cells[(y * width + x) * CELL_STRIDE];
}

export function sameKind(cells: Uint8Array, width: number, height: number, x: number, y: number, kind: number) {
  return kindAt(cells, width, height, x, y) === kind;
}

export function sameLiquid(cells: Uint8Array, width: number, height: number, x: number, y: number, kind: number) {
  const other = kindAt(cells, width, height, x, y);
  if (kind === MATERIAL.Moonwater) return other === MATERIAL.Moonwater || other === MATERIAL.Water;
  return other === kind;
}

export type EdgeInfo = {
  top: boolean;
  right: boolean;
  bottom: boolean;
  left: boolean;
  count: number;
};

export function edgeInfo(cells: Uint8Array, width: number, height: number, x: number, y: number, kind: number): EdgeInfo {
  const top = !sameKind(cells, width, height, x, y - 1, kind);
  const right = !sameKind(cells, width, height, x + 1, y, kind);
  const bottom = !sameKind(cells, width, height, x, y + 1, kind);
  const left = !sameKind(cells, width, height, x - 1, y, kind);
  return { top, right, bottom, left, count: Number(top) + Number(right) + Number(bottom) + Number(left) };
}

export function hasNearbyKind(
  cells: Uint8Array,
  width: number,
  height: number,
  x: number,
  y: number,
  kinds: readonly number[],
  radius = 1
) {
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (dx === 0 && dy === 0) continue;
      if (kinds.includes(kindAt(cells, width, height, x + dx, y + dy))) return true;
    }
  }
  return false;
}

export function cardinalNeighborCount(cells: Uint8Array, width: number, height: number, x: number, y: number, kind: number) {
  let count = 0;
  if (sameKind(cells, width, height, x, y - 1, kind)) count++;
  if (sameKind(cells, width, height, x + 1, y, kind)) count++;
  if (sameKind(cells, width, height, x, y + 1, kind)) count++;
  if (sameKind(cells, width, height, x - 1, y, kind)) count++;
  return count;
}
