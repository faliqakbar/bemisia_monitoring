import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import type {
  AnalysisJob,
  Draft,
  Greenhouse,
  Trap,
  MonitoringSession,
  Settings,
} from "./types";
import { DEFAULT_SETTINGS } from "./types";
import { greenhouseRepository } from "./database/greenhouse";
import { trapRepository } from "./database/traps";
import { monitoringRepository } from "./database/monitoring";
import { seedDemo } from "./database/demo";
import { getDb } from "./offline/db";
import { syncQueue } from "./offline/syncQueue";
import {
  enqueueAnalysis,
  jobPhoto,
  listJobs,
  nextWaitingJob,
  recoverInterruptedJobs,
  removeJob,
  saveJob,
} from "./offline/analysisQueue";
import { detectImage } from "./ai/detector";
import { readImage, sourceFiles } from "./utils/image";
import type { QualityResult } from "./imageQuality/qualityEvaluator";
interface State {
  greenhouses: Greenhouse[];
  traps: Trap[];
  sessions: MonitoringSession[];
  settings: Settings;
  saveSettings: (s: Settings) => Promise<void>;
  refresh: () => Promise<void>;
  draft: Draft | null;
  setDraft: (draft: Draft | null) => void;
  loading: boolean;
  error: string;
  notice: string;
  notify: (message: string) => void;
  sync: () => Promise<void>;
  jobs: AnalysisJob[];
  jobProgress: Record<string, string>;
  queueAnalysis: (input: {
    trap: Trap;
    label: string;
    image: HTMLCanvasElement;
    quality: QualityResult;
    capturedAt: string;
  }) => Promise<void>;
  retryJob: (job: AnalysisJob) => Promise<void>;
  deleteJob: (id: string) => Promise<void>;
}
const Context = createContext<State | null>(null);
export function AppProvider({ children }: { children: ReactNode }) {
  const [greenhouses, setGreenhouses] = useState<Greenhouse[]>([]),
    [traps, setTraps] = useState<Trap[]>([]),
    [sessions, setSessions] = useState<MonitoringSession[]>([]),
    [settings, setSettings] = useState(DEFAULT_SETTINGS),
    [draft, setDraft] = useState<Draft | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [notice, notify] = useState(""),
    [jobs, setJobs] = useState<AnalysisJob[]>([]),
    [jobProgress, setJobProgress] = useState<Record<string, string>>({});
  const analysing = useRef(false);
  const refreshJobs = useCallback(async () => setJobs(await listJobs()), []);
  const refresh = useCallback(async () => {
    const [g, t, m] = await Promise.all([
      greenhouseRepository.list(),
      trapRepository.list(),
      monitoringRepository.list(),
    ]);
    setGreenhouses(g);
    setTraps(t);
    setSessions(m);
  }, []);
  const sync = useCallback(async () => {
    try {
      const result = await syncQueue();
      notify(
        `${result.synced} data tersinkron${result.failed ? `; ${result.failed} masih menunggu. Coba kembali.` : "."}`,
      );
      await refresh();
    } catch (e) {
      notify(e instanceof Error ? e.message : "Sinkronisasi belum berhasil.");
    }
  }, [refresh]);
  useEffect(() => {
    void (async () => {
      try {
        await seedDemo();
        const saved = await (await getDb()).get("meta", "settings");
        if (saved) setSettings({ ...DEFAULT_SETTINGS, ...(saved as Settings) });
        await refresh();
        await recoverInterruptedJobs();
        await refreshJobs();
      } catch {
        setError(
          "Penyimpanan lokal tidak tersedia. Izinkan penyimpanan browser lalu muat ulang.",
        );
      } finally {
        setLoading(false);
      }
    })();
  }, [refresh, refreshJobs]);
  useEffect(() => {
    const online = () => {
      void sync();
    };
    window.addEventListener("online", online);
    return () => window.removeEventListener("online", online);
  }, [sync]);
  // Background analysis: one photo at a time while the app is open, on any page.
  useEffect(() => {
    const job = nextWaitingJob(jobs);
    if (loading || !job || analysing.current) return;
    analysing.current = true;
    void (async () => {
      const show = (message: string) =>
        setJobProgress((p) => ({ ...p, [job.id]: message }));
      try {
        await saveJob({ ...job, status: "processing" });
        await refreshJobs();
        const photo = await jobPhoto(job.id);
        if (!photo) throw new Error("Foto antrean tidak ditemukan.");
        const image = await readImage(
          new File([photo], job.file_name, { type: photo.type }),
        );
        const start = performance.now();
        const result = await detectImage(image, job.settings, show);
        await saveJob({
          ...job,
          status: "done",
          result,
          total_ms: performance.now() - start,
          error: undefined,
        });
        notify(`${job.label}: ${result.count} Bemisia, siap direview.`);
      } catch (e) {
        await saveJob({
          ...job,
          status: "failed",
          attempts: job.attempts + 1,
          error: e instanceof Error ? e.message : "Analisis gagal.",
        });
      } finally {
        setJobProgress(({ [job.id]: _, ...rest }) => rest);
        analysing.current = false;
        await refreshJobs();
      }
    })();
  }, [jobs, loading, refreshJobs]);
  async function queueAnalysis(input: {
    trap: Trap;
    label: string;
    image: HTMLCanvasElement;
    quality: QualityResult;
    capturedAt: string;
  }) {
    // The original file keeps server results identical to an immediate analysis.
    const file = sourceFiles.get(input.image);
    const photo =
      file ??
      (await new Promise<Blob>((resolve, reject) =>
        input.image.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("Foto gagal disimpan."))),
          "image/png",
        ),
      ));
    const id = crypto.randomUUID();
    await enqueueAnalysis(
      {
        id,
        trap_id: input.trap.id,
        label: input.label,
        captured_at: input.capturedAt,
        created_at: new Date().toISOString(),
        quality: input.quality,
        settings,
        file_name: file?.name ?? `${id}.png`,
        status: "waiting",
        attempts: 0,
      },
      photo,
    );
    await refreshJobs();
  }
  async function retryJob(job: AnalysisJob) {
    await saveJob({ ...job, status: "waiting", error: undefined });
    await refreshJobs();
  }
  async function deleteJob(id: string) {
    await removeJob(id);
    await refreshJobs();
  }
  async function saveSettings(value: Settings) {
    await (await getDb()).put("meta", value, "settings");
    setSettings(value);
    notify("Pengaturan tersimpan.");
  }
  return (
    <Context.Provider
      value={{
        greenhouses,
        traps,
        sessions,
        settings,
        saveSettings,
        refresh,
        draft,
        setDraft,
        loading,
        error,
        notice,
        notify,
        sync,
        jobs,
        jobProgress,
        queueAnalysis,
        retryJob,
        deleteJob,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useApp() {
  const state = useContext(Context);
  if (!state) throw new Error("AppProvider required");
  return state;
}
