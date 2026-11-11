// Share of the photo that is yellow-trap coloured: a photo without a trap (a room, a
// leaf) can be sharp and well lit, so the technical checks alone would pass it.
// Calibrated on field photos: a trap filling the frame is ~90%, photos without a
// trap are near 0%.
export const TRAP_MISSING_BELOW = 0.15;
export const TRAP_SMALL_BELOW = 0.4;

// Yellow by hue, saturated enough to exclude beige walls and wood, bright enough
// to exclude dark backgrounds; shaded parts of the card still count.
export function isTrapYellow(r: number, g: number, b: number) {
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b),
    delta = max - min;
  if (!delta || max / 255 < 0.3 || delta / max < 0.35) return false;
  const hue =
    max === r
      ? 60 * (((g - b) / delta + 6) % 6)
      : max === g
        ? 60 * ((b - r) / delta + 2)
        : 60 * ((r - g) / delta + 4);
  return hue >= 35 && hue <= 75;
}

// RGBA pixels (canvas ImageData) -> fraction 0..1 of trap-yellow pixels.
export function trapCoverage(data: ArrayLike<number>) {
  const pixels = Math.floor(data.length / 4);
  let yellow = 0;
  for (let i = 0; i < pixels; i++)
    if (isTrapYellow(data[i * 4], data[i * 4 + 1], data[i * 4 + 2])) yellow++;
  return pixels ? yellow / pixels : 0;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Where the trap is, as fractions 0..1 of the photo: the rows and columns in which
// trap yellow is more than a quarter as common as in the most yellow row/column,
// so specks of yellow in the background do not stretch the box.
export function trapBounds(
  data: ArrayLike<number>,
  width: number,
  height: number,
): Rect | null {
  const cols = new Uint32Array(width),
    rows = new Uint32Array(height);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (isTrapYellow(data[i], data[i + 1], data[i + 2])) {
        cols[x]++;
        rows[y]++;
      }
    }
  const span = (counts: Uint32Array) => {
    let max = 0;
    for (const c of counts) max = Math.max(max, c);
    if (!max) return null;
    let start = 0,
      end = counts.length - 1;
    while (counts[start] <= max / 4) start++;
    while (counts[end] <= max / 4) end--;
    return [start, end + 1] as const;
  };
  const xs = span(cols),
    ys = span(rows);
  if (!xs || !ys) return null;
  return {
    x: xs[0] / width,
    y: ys[0] / height,
    width: (xs[1] - xs[0]) / width,
    height: (ys[1] - ys[0]) / height,
  };
}
