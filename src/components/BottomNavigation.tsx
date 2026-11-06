import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  ScanLine,
  History,
  Settings2,
  Leaf,
} from "lucide-react";
const links = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/monitoring", label: "Monitoring", icon: ScanLine },
  { to: "/history", label: "History", icon: History },
  { to: "/settings", label: "Settings", icon: Settings2 },
];
export function BottomNavigation() {
  return (
    <nav className="navigation" aria-label="Navigasi utama">
      <div className="nav-heading">WORKSPACE</div>
      {links.map(({ to, label, icon: Icon }) => (
        <NavLink key={to} to={to} end={to === "/"}>
          <Icon size={21} />
          <span>{label}</span>
        </NavLink>
      ))}
      <div className="sidebar-note">
        <Leaf size={24} />
        <strong>
          Pengamatan kecil.
          <br />
          Dampak besar.
        </strong>
        <p>Pantau lebih rutin, kenali perubahan lebih awal.</p>
        <span>PROTOTYPE / R&D · V0.1</span>
      </div>
    </nav>
  );
}
