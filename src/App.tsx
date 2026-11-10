import { Component, type ReactNode } from "react";
import { HashRouter, Routes, Route, Link } from "react-router-dom";
import { AppProvider, useApp } from "./state";
import { AppHeader } from "./components/AppHeader";
import { BottomNavigation } from "./components/BottomNavigation";
import { DashboardPage } from "./pages/DashboardPage";
import { MonitoringPage } from "./pages/MonitoringPage";
import { CapturePage } from "./pages/CapturePage";
import { DetectionResultPage } from "./pages/DetectionResultPage";
import { TrapHistoryPage } from "./pages/TrapHistoryPage";
import { TrapManagementPage } from "./pages/TrapManagementPage";
import { SettingsPage } from "./pages/SettingsPage";
import { UpdateBanner } from "./components/UpdateBanner";
class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: boolean }
> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <main className="panel">
        <h1>Aplikasi perlu dimuat ulang</h1>
        <p>
          Catatan yang sudah disimpan tetap berada di penyimpanan perangkat.
        </p>
        <button className="button primary" onClick={() => location.reload()}>
          Muat ulang
        </button>
      </main>
    ) : (
      this.props.children
    );
  }
}
function Shell() {
  const { loading, error, notice, notify } = useApp();
  return (
    <>
      <AppHeader />
      <BottomNavigation />
      <main className="main-content">
        {loading ? (
          <div className="panel empty">Menyiapkan greenhouse...</div>
        ) : error ? (
          <div className="panel error">{error}</div>
        ) : (
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/monitoring" element={<MonitoringPage />} />
            <Route path="/capture/:trapId" element={<CapturePage />} />
            <Route path="/result" element={<DetectionResultPage />} />
            <Route path="/history" element={<TrapHistoryPage />} />
            <Route path="/history/:trapId" element={<TrapHistoryPage />} />
            <Route path="/traps" element={<TrapManagementPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route
              path="*"
              element={
                <section className="panel">
                  <h1>Halaman tidak ditemukan</h1>
                  <Link to="/">Kembali ke dashboard</Link>
                </section>
              }
            />
          </Routes>
        )}
      </main>
      <UpdateBanner />
      {notice && (
        <div className="toast" role="status">
          {notice}
          <button onClick={() => notify("")} aria-label="Tutup pemberitahuan">
            ×
          </button>
        </div>
      )}
    </>
  );
}
export default function App() {
  return (
    <ErrorBoundary>
      <HashRouter>
        <AppProvider>
          <Shell />
        </AppProvider>
      </HashRouter>
    </ErrorBoundary>
  );
}
