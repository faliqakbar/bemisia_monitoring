export async function readImage(file: File): Promise<HTMLCanvasElement> {
  if (!file.type.startsWith("image/"))
    throw new Error("Pilih file gambar JPG, PNG, atau WebP.");
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    if (image.width * image.height > 50000000)
      throw new Error("Foto terlalu besar (maksimum 50 megapixel).");
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    canvas.getContext("2d")!.drawImage(image, 0, 0);
    return canvas;
  } catch (error) {
    throw new Error(
      error instanceof Error && error.message.includes("megapixel")
        ? error.message
        : "Foto gagal dibaca. Coba format JPG atau WebP.",
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}
export async function compressedImage(image: HTMLCanvasElement): Promise<Blob> {
  const scale = Math.min(1, 1920 / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);
  canvas.getContext("2d")!.drawImage(image, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("Gagal menyiapkan gambar.")),
      "image/webp",
      0.82,
    ),
  );
}
