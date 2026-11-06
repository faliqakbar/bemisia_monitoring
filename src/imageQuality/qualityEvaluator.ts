import { luminances, brightnessCheck } from "./brightnessCheck";
import { blurCheck } from "./blurCheck";
import { glareCheck } from "./glareCheck";
import { resolutionCheck } from "./resolutionCheck";
import type { Settings } from "../types";
export interface QualityMetrics {
  width: number;
  height: number;
  sharpnessScore: number;
  brightness: number;
  glarePercent: number;
}
export interface QualityResult extends QualityMetrics {
  qualityScore: number;
  status: "GOOD" | "WARNING" | "RETAKE";
  messages: string[];
  coverage: "UNKNOWN";
  resolutionGood: boolean;
}
export function trapCoverageCheck(): "UNKNOWN" {
  return "UNKNOWN";
}
export function scoreQuality(
  m: QualityMetrics,
  s: Pick<Settings, "minResolution" | "blurRetake" | "blurWarning">,
): QualityResult {
  const messages: string[] = [];
  let penalty = 0,
    retake = false;
  const resolutionGood = resolutionCheck(m.width, m.height, s.minResolution);
  if (!resolutionGood) {
    messages.push(
      `Resolusi minimum ${s.minResolution} × ${s.minResolution} px.`,
    );
    penalty += 50;
    retake = true;
  }
  if (m.sharpnessScore < s.blurRetake) {
    messages.push("Foto terlalu blur. Silakan ambil ulang.");
    penalty += 50;
    retake = true;
  } else if (m.sharpnessScore < s.blurWarning) {
    messages.push("Foto sedikit kurang tajam tetapi masih dapat dianalisis.");
    penalty += 20;
  }
  if (m.brightness < 35 || m.brightness > 245) {
    messages.push("Pencahayaan terlalu gelap atau terlalu terang.");
    penalty += 40;
    retake = true;
  } else if (m.brightness < 65 || m.brightness > 225) {
    messages.push("Periksa pencahayaan foto.");
    penalty += 15;
  }
  // High threshold avoids treating a bright yellow card itself as specular glare.
  if (m.glarePercent > 30) {
    messages.push("Pantulan cahaya terlalu luas. Ubah posisi kamera.");
    penalty += 40;
    retake = true;
  } else if (m.glarePercent > 10) {
    messages.push("Ada pantulan cahaya; periksa detail serangga.");
    penalty += 15;
  }
  return {
    ...m,
    resolutionGood,
    qualityScore: Math.max(0, 100 - penalty),
    status: retake ? "RETAKE" : penalty ? "WARNING" : "GOOD",
    messages: messages.length ? messages : ["Foto siap dianalisis"],
    coverage: trapCoverageCheck(),
  };
}
export function evaluateQuality(image: HTMLCanvasElement, s: Settings) {
  const scale = Math.min(1, 768 / Math.max(image.width, image.height)),
    canvas = document.createElement("canvas");
  canvas.width = Math.max(3, Math.round(image.width * scale));
  canvas.height = Math.max(3, Math.round(image.height * scale));
  const c = canvas.getContext("2d")!;
  c.drawImage(image, 0, 0, canvas.width, canvas.height);
  const l = luminances(c.getImageData(0, 0, canvas.width, canvas.height).data);
  return scoreQuality(
    {
      width: image.width,
      height: image.height,
      sharpnessScore: blurCheck(l, canvas.width, canvas.height),
      brightness: brightnessCheck(l),
      glarePercent: glareCheck(l),
    },
    s,
  );
}
