function formatBuildDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "data lokalna";
  return new Intl.DateTimeFormat("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

const fullVersion = import.meta.env.VITE_APP_VERSION || "dev";
const shortVersion = fullVersion === "dev" ? "lokalna" : fullVersion.slice(0, 7);
const versionText = fullVersion === "dev" ? "wersja lokalna" : `v${shortVersion}`;
const buildDate = formatBuildDate(import.meta.env.VITE_APP_BUILD_DATE || "");

export function BuildInfo({ className = "" }: { className?: string }) {
  const label = `Wersja ${shortVersion}, aktualizacja ${buildDate}`;
  return <div className={`build-info${className ? ` ${className}` : ""}`} aria-label={label} title={`${label}. Pełna wersja: ${fullVersion}`}>{versionText} · {buildDate}</div>;
}
