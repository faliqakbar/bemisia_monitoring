export interface InstalledModel {
  version: string;
  sha256: string;
  trial: boolean;
  classNames: string[];
  inputSize: number;
}
export function parseModelInfo(value: unknown): InstalledModel {
  if (!value || typeof value !== "object")
    throw new Error("Informasi model tidak valid.");
  const v = value as Partial<InstalledModel>;
  if (
    typeof v.version !== "string" ||
    !/^[a-zA-Z0-9._-]{1,80}$/.test(v.version) ||
    typeof v.sha256 !== "string" ||
    !/^[a-f0-9]{64}$/.test(v.sha256) ||
    typeof v.trial !== "boolean" ||
    v.inputSize !== 640 ||
    !Array.isArray(v.classNames) ||
    v.classNames.length !== 1 ||
    typeof v.classNames[0] !== "string" ||
    v.classNames[0].toLowerCase() !== "bemisia"
  ) {
    throw new Error(
      "Informasi model harus sesuai detektor satu kelas Bemisia dengan input 640 px.",
    );
  }
  return v as InstalledModel;
}
export async function loadModelInfo(): Promise<InstalledModel | null> {
  const response = await fetch(
    `${import.meta.env.BASE_URL}models/model-info.json`,
    { cache: "no-store" },
  );
  if (
    response.status === 404 ||
    response.headers.get("content-type")?.includes("text/html")
  )
    return null;
  if (!response.ok) throw new Error("Informasi model gagal dimuat.");
  return parseModelInfo(await response.json());
}
export function modelIdentity(info: InstalledModel | null, sha256: string) {
  if (info && info.sha256 !== sha256)
    throw new Error(
      "File model dan model-info.json tidak cocok. Ekspor ulang keduanya sebelum analisis.",
    );
  return info
    ? `${info.version}-${sha256.slice(0, 12)}`
    : `bemisia-onnx-${sha256.slice(0, 12)}`;
}
