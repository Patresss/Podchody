import { Eye, EyeOff, MapPinned, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { BuildInfo } from "../components/BuildInfo";

export function LoginPage({ onLogin }: { onLogin: (username: string, password: string) => Promise<void> }) {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  return (
    <main className="login-page">
      <section className="login-story">
        <div className="brand brand-light"><span className="brand-mark"><MapPinned size={23} /></span><span>Podchody</span></div>
        <div className="story-copy">
          <span className="story-kicker">Od zdjęcia do przygody</span>
          <h1>Trasy, które dzieci rozumieją bez jednego słowa.</h1>
          <p>Ułóż punkty na mapie, wylosuj długą trasę i wydrukuj obrazkowe karty gotowe do schowania.</p>
        </div>
        <div className="story-path" aria-hidden="true"><span>1</span><i /><span>4</span><i /><span>7</span><i /><span>10</span></div>
        <div className="login-story-footer"><small>Twoje zdjęcia pozostają na Twoim serwerze.</small><BuildInfo /></div>
      </section>
      <section className="login-panel">
        <form className="login-card" onSubmit={async (event) => {
          event.preventDefault();
          setLoading(true); setError("");
          try { await onLogin(username, password); } catch (caught) { setError(caught instanceof Error ? caught.message : "Nie udało się zalogować."); } finally { setLoading(false); }
        }}>
          <div className="login-icon"><ShieldCheck size={24} /></div>
          <div><span className="eyebrow">Prywatna przestrzeń</span><h2>Witaj ponownie</h2><p>Zaloguj się, aby zarządzać projektami.</p></div>
          <label><span>Login</span><input autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} required /></label>
          <label><span>Hasło</span><div className="password-field"><input type={showPassword ? "text" : "password"} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Ukryj hasło" : "Pokaż hasło"}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></label>
          {error && <div className="form-error" role="alert">{error}</div>}
          <button className="button button-primary button-large" disabled={loading} type="submit">{loading ? "Loguję…" : "Zaloguj się"}</button>
        </form>
      </section>
    </main>
  );
}
