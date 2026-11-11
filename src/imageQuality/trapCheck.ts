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
