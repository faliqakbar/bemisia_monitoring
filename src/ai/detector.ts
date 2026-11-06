import { MockBemisiaDetector } from "./mockDetector";
import { OnnxBemisiaDetector } from "./onnxDetector";
import type { Settings } from "../types";
export type { BemisiaDetector } from "./types";
export async function detectImage(
  image: HTMLCanvasElement,
  settings: Settings,
  progress: (message: string) => void,
) {
  if (settings.preferOnnx) {
    const detector = new OnnxBemisiaDetector(settings);
    try {
      progress("Memuat model ONNX di perangkat...");
      await detector.initialize();
      return await detector.detect(image, progress);
    } catch (error) {
      const mock = new MockBemisiaDetector(settings);
      return {
        ...(await mock.detect(image, progress)),
        warning:
          "AI model belum tersedia atau inference gagal — Simulation Mode aktif." +
          (error instanceof Error ? ` ${error.message.slice(0, 240)}` : ""),
      };
    } finally {
      await detector.dispose().catch(() => undefined);
    }
  }
  const detector = new MockBemisiaDetector(settings);
  await detector.initialize();
  return detector.detect(image, progress);
}
