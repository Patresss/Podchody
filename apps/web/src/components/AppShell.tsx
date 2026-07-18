import { FolderHeart, LogOut, MapPinned } from "lucide-react";
import type { ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";

type AppShellProps = {
  children: ReactNode;
  username: string;
  onLogout: () => void;
};

export function AppShell({ children, username, onLogout }: AppShellProps) {
  return (
    <div className="app-layout">
      <aside className="sidebar">
        <Link className="brand" to="/">
          <span className="brand-mark"><MapPinned size={22} /></span>
          <span>Podchody</span>
        </Link>
        <nav className="sidebar-nav" aria-label="Główna nawigacja">
          <NavLink to="/" end><FolderHeart size={18} /> Projekty</NavLink>
        </nav>
        <div className="sidebar-footer">
          <div className="avatar">{username.slice(0, 1).toUpperCase()}</div>
          <div><strong>{username}</strong><span>Administrator</span></div>
          <button className="icon-button" type="button" onClick={onLogout} aria-label="Wyloguj"><LogOut size={18} /></button>
        </div>
      </aside>
      <div className="app-main">
        <header className="mobile-header">
          <Link className="brand" to="/"><span className="brand-mark"><MapPinned size={20} /></span><span>Podchody</span></Link>
          <button className="icon-button" type="button" onClick={onLogout} aria-label="Wyloguj"><LogOut size={18} /></button>
        </header>
        {children}
      </div>
    </div>
  );
}
