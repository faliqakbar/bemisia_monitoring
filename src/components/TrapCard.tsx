import { ArrowUpRight, MapPin } from "lucide-react";
import { Link } from "react-router-dom";
import type { Trap, MonitoringSession } from "../types";
import { number } from "../utils/format";
export function TrapCard({
  trap,
  last,
}: {
  trap: Trap;
  last?: MonitoringSession;
}) {
  return (
    <Link className="trap-card" to={`/capture/${trap.id}`}>
      <span className="trap-icon">▥</span>
      <div>
        <h3>Yellow Trap {trap.trap_code}</h3>
        <p>
          <MapPin size={13} />
          {trap.location_description || "Lokasi belum diisi"}
        </p>
        <small>
          {last
            ? `${number(last.bemisia_count)} Bemisia pada monitoring terakhir`
            : "Belum ada monitoring"}
        </small>
      </div>
      <ArrowUpRight size={20} />
    </Link>
  );
}
