export const number = (value: number | null, digits = 0) =>
  value === null
    ? "—"
    : new Intl.NumberFormat("id-ID", { maximumFractionDigits: digits }).format(
        value,
      );
export const percent = (value: number | null) =>
  value === null
    ? "Belum sebanding"
    : `${value > 0 ? "+" : ""}${number(value, 1)}%`;
