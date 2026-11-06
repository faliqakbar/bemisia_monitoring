import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type {
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
    [notice, notify] = useState("");
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
      } catch {
        setError(
          "Penyimpanan lokal tidak tersedia. Izinkan penyimpanan browser lalu muat ulang.",
        );
      } finally {
        setLoading(false);
      }
    })();
  }, [refresh]);
  useEffect(() => {
    const online = () => {
      void sync();
    };
    window.addEventListener("online", online);
    return () => window.removeEventListener("online", online);
  }, [sync]);
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
