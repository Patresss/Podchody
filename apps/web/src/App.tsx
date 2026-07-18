import { lazy, Suspense, useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { api } from "./lib/api";
import { LoginPage } from "./pages/LoginPage";

const DashboardPage = lazy(() => import("./pages/DashboardPage").then((module) => ({ default: module.DashboardPage })));
const ProjectPage = lazy(() => import("./pages/ProjectPage").then((module) => ({ default: module.ProjectPage })));
const RoutePage = lazy(() => import("./pages/RoutePage").then((module) => ({ default: module.RoutePage })));

export function App() {
  const [username, setUsername] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    api.session().then((session) => setUsername(session.username)).catch(() => setUsername(null)).finally(() => setChecking(false));
  }, []);

  if (checking) return <div className="app-splash"><span className="splash-mark">P</span><div /><small>Przygotowuję mapę przygody</small></div>;
  if (!username) return <LoginPage onLogin={async (login, password) => { const session = await api.login(login, password); setUsername(session.username); }} />;

  return (
    <AppShell username={username} onLogout={async () => { await api.logout(); setUsername(null); }}>
      <Suspense fallback={<main className="page"><div className="page-loading"><span /><p>Otwieram widok…</p></div></main>}>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/projects/:projectId" element={<ProjectPage />} />
        <Route path="/projects/:projectId/routes/:routeId" element={<RoutePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
    </AppShell>
  );
}
