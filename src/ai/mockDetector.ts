import type { BemisiaDetector, Detection } from "./types";
import type { Settings } from "../types";
import { getTilePositions, remapDetection } from "./tiling";
import { cropTile } from "./preprocessing";
import { globalNms } from "./nms";
export class MockBemisiaDetector implements BemisiaDetector {
  constructor(private settings: Settings) {}
  async initialize() {}
  getModelInfo() {
    return { version: "mock-v1", simulation: true };
  }
  async detect(
    image: HTMLCanvasElement,
    onProgress?: (message: string) => void,
  ) {
    const start = performance.now();
    const tiles = getTilePositions(
      image.width,
      image.height,
      this.settings.tileSize,
      this.settings.overlap,
    );
    const boxes: Detection[] = [];
    for (let i = 0; i < tiles.length; i++) {
      const tile = tiles[i];
      const sample = cropTile(image, tile, 16)
        .getContext("2d")!
        .getImageData(0, 0, 16, 16).data;
      let seed = (tile.x * 31 + tile.y * 17 + image.width + image.height) >>> 0;
      for (let j = 0; j < sample.length; j += 4)
        seed = (Math.imul(seed, 31) + sample[j] + sample[j + 1]) >>> 0;
      const random = () => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return seed / 4294967296;
      };
      const count = 2 + Math.floor(random() * 7);
      for (let j = 0; j < count; j++) {
        const x = random() * 590,
          y = random() * 590;
        boxes.push(
          remapDetection(
            {
              x1: x,
              y1: y,
              x2: x + 12 + random() * 20,
              y2: y + 12 + random() * 20,
              confidence: 0.2 + random() * 0.75,
              classId: 0,
              className: "Bemisia",
            },
            tile,
          ),
        );
      }
      onProgress?.(`Analyzing tile ${i + 1} / ${tiles.length}`);
      if (i % 4 === 0) await new Promise((resolve) => setTimeout(resolve, 0));
    }
    onProgress?.("Combining detections...");
    const detections = globalNms(
      boxes,
      this.settings.nmsIou,
      this.settings.confidence,
    );
    return {
      detections,
      count: detections.length,
      meanConfidence: detections.length
        ? detections.reduce((sum, d) => sum + d.confidence, 0) /
          detections.length
        : 0,
      inferenceTimeMs: performance.now() - start,
      modelVersion: "mock-v1",
      tileCount: tiles.length,
    };
  }
}
