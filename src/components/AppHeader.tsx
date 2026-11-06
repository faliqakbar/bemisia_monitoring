import { Leaf, CloudOff, CheckCircle2 } from "lucide-react";
import { useEffect, useState } from "react";
import { isDemo } from "../database/supabase";
export function AppHeader() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return (
    <header className="app-header">
      <a className="brand" href="#/">
        <span className="brand-mark">
          <Leaf size={24} />
        </span>
        <span>
          bemisia<span className="brand-sub">GREENHOUSE MONITORING</span>
        </span>
      </a>
      <div className="header-status">
        <span className="connection">
          {online ? <CheckCircle2 size={15} /> : <CloudOff size={15} />}{" "}
          {online ? "Perangkat online" : "Offline"}
        </span>
        <span className="badge demo">
          {isDemo ? "DEMO MODE" : "CLOUD MODE"}
        </span>
      </div>
    </header>
  );
}
