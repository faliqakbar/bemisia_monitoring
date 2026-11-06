export function glareCheck(values: Float32Array, threshold = 250) {
  let bright = 0;
  for (const v of values) if (v > threshold) bright++;
  return values.length ? (bright / values.length) * 100 : 0;
}
