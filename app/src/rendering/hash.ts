export function hashCell(x: number, y: number, variant = 0) {
  let hash = Math.imul(x + 374761393, 668265263) ^ Math.imul(y + 1442695041, 2246822519) ^ Math.imul(variant + 1, 326648991);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 1274126177);
  return (hash ^ (hash >>> 16)) >>> 0;
}
