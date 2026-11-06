import "fake-indexeddb/auto";
import { it, expect } from "vitest";
import { seedDemo } from "../src/database/demo";
import { LocalMonitoringRepository } from "../src/database/monitoring";
import { LocalTrapRepository } from "../src/database/traps";
import { getDb } from "../src/offline/db";
it("seeds only once and persists a session + image across repository instances", async () => {
  await seedDemo();
  await seedDemo();
  const db = await getDb();
  expect(await db.count("greenhouse")).toBe(3);
  expect(await db.count("traps")).toBe(6);
  expect(await db.count("sessions")).toBe(24);
  const repo = new LocalMonitoringRepository(),
    sample = (await repo.list())[0];
  await repo.save(
    { ...sample, id: "test-observation" },
    new Blob(["photo"], { type: "image/webp" }),
  );
  const restored = new LocalMonitoringRepository();
  expect(
    (await restored.list()).find((s) => s.id === "test-observation")
      ?.model_version,
  ).toBe("mock-v1");
  expect(await (await restored.image("test-observation"))?.text()).toBe(
    "photo",
  );
});
it("rejects duplicate greenhouse/trap identifiers locally", async () => {
  await seedDemo();
  const repo = new LocalTrapRepository(),
    sample = (await repo.list())[0];
  await expect(repo.save({ ...sample, id: "duplicate-id" })).rejects.toThrow(
    "sudah digunakan",
  );
});
