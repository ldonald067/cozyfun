// Where the board sits in the tray, so that every cell reaches the screen at one size.
//
// The tray is sized by the layout, and its box is never a whole number of device pixels per
// cell (3.14 at 1024 wide, 3.2 at 1280, 3.93 at 1440). Nearest-neighbour at a fractional
// scale draws a one-cell line 3 px wide four times in five and 4 px the fifth, so ten
// identical flower stems drew at two widths. Two fits remove that, and they trade
// differently:
//
// - "snap": a whole number of device pixels a cell, centred, leaving a margin inside the
//   frame. Crisp and even, but up to one cell-step smaller, and painting does nothing in the
//   margin. Cheap when a cell is just over a whole number (3.14 px at 1024 wide keeps 96%),
//   ruinous just under one: 2.79 px at 960 wide snaps to 2 and keeps 72%, inside a 94 px band.
// - "smooth": draw the board at the next whole multiple and let the browser scale that down
//   to the full box. Even and full size, with one soft device pixel at some cell seams. That
//   pixel is a third of a cell at 1x and reads as soft, and a sixth at 2x, where it is not
//   seen.
//
// So below 2x the board snaps only where that keeps SNAP_KEEPS of it, and smooths elsewhere;
// from 2x up it always smooths. Both keep cells square: the tray's 11:7 frame left the box 2%
// wider than the board.
// `npm run pixels:even` measures the result on screen.

export type BoardFit = {
  mode: "snap" | "smooth";
  /** CSS px, within the tray's padding box. */
  left: number;
  top: number;
  width: number;
  height: number;
  /** Device px a cell in the drawn bitmap: the display canvas is cols*scale by rows*scale. */
  scale: number;
};

export const SMOOTH_FROM_DPR = 2;
/** The least of the board a snap may keep; below it, smooth instead. Owner's pick, 2026-10-28. */
export const SNAP_KEEPS = 0.9;

export function fitBoard(boxWidth: number, boxHeight: number, cols: number, rows: number, dpr: number): BoardFit | null {
  if (!(boxWidth > 0 && boxHeight > 0 && cols > 0 && rows > 0 && dpr > 0)) return null;
  const perCell = Math.min((boxWidth * dpr) / cols, (boxHeight * dpr) / rows);
  const whole = Math.floor(perCell + 1e-6);
  const exact = perCell - whole < 1e-6;
  const snap = whole >= 1 && (exact || (dpr < SMOOTH_FROM_DPR && whole / perCell >= SNAP_KEEPS));
  const widthDev = snap ? whole * cols : Math.floor(perCell * cols);
  const heightDev = snap ? whole * rows : Math.floor(perCell * rows);
  const leftDev = Math.round((boxWidth * dpr - widthDev) / 2);
  const topDev = Math.round((boxHeight * dpr - heightDev) / 2);
  return {
    mode: snap ? "snap" : "smooth",
    left: leftDev / dpr,
    top: topDev / dpr,
    width: widthDev / dpr,
    height: heightDev / dpr,
    scale: snap ? whole : Math.max(1, Math.ceil(perCell))
  };
}
