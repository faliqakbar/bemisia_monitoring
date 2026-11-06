export function luminances(data: Uint8ClampedArray) {
  const values = new Float32Array(data.length / 4);
  for (let i = 0; i < values.length; i++)
    values[i] =
      0.2126 * data[i * 4] +
      0.7152 * data[i * 4 + 1] +
      0.0722 * data[i * 4 + 2];
  return values;
}
export function brightnessCheck(values: Float32Array) {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}
