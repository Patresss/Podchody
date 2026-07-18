import { ArrowLeft, Camera, CheckSquare, Images, ListChecks, LoaderCircle, Map, MoreHorizontal, Route as RouteIcon, Sparkles, Upload, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { CreateRouteModal } from "../components/CreateRouteModal";
import { MapView, type MapViewHandle } from "../components/MapView";
import { Modal } from "../components/Modal";
import { PhotoGallery } from "../components/PhotoGallery";
import { PointInspector } from "../components/PointInspector";
import { PointSymbolIcon } from "../components/PointSymbol";
import { Toast, type ToastState } from "../components/Toast";
import { api } from "../lib/api";
import { versionedPhotoUrl } from "../lib/photo-url";
import type { Point, Project, RoutePlan } from "../types";

type Tab = "photos" | "map" | "routes";

export function ProjectPage() {
  const { projectId = "" } = useParams();
  const navigate = useNavigate();
  const fileInput = useRef<HTMLInputElement>(null);
  const projectMapRef = useRef<MapViewHandle>(null);
  const selectionAnchorId = useRef<string | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [points, setPoints] = useState<Point[]>([]);
  const [routes, setRoutes] = useState<RoutePlan[]>([]);
  const [selectedIds, setSelectedIds] = useState(new Set<string>());
  const [inspected, setInspected] = useState<Point | null>(null);
  const [tab, setTab] = useState<Tab>("photos");
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number; added: number } | null>(null);
  const [showRouteModal, setShowRouteModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [placingPoint, setPlacingPoint] = useState<Point | null>(null);
  const [settingCoverId, setSettingCoverId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);

  const load = async () => {
    const result = await api.project(projectId);
    setProject(result.project); setPoints(result.points); setRoutes(result.routes);
  };

  useEffect(() => { void load(); }, [projectId]);

  const selectedPoints = useMemo(() => points.filter((point) => selectedIds.has(point.id)), [points, selectedIds]);
  const missingLocationCount = selectedPoints.filter((point) => point.latitude == null).length;
  const locatedCount = points.filter((point) => point.latitude != null && point.longitude != null).length;
  const uploading = uploadProgress != null;

  const replacePoint = (updated: Point) => {
    setPoints((current) => current.map((point) => point.id === updated.id ? updated : point));
    setInspected((current) => current?.id === updated.id ? updated : current);
  };

  const togglePointSelection = (id: string, range: boolean) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      const anchorIndex = selectionAnchorId.current == null ? -1 : points.findIndex((point) => point.id === selectionAnchorId.current);
      const clickedIndex = points.findIndex((point) => point.id === id);
      if (range && anchorIndex >= 0 && clickedIndex >= 0) {
        const shouldSelect = !current.has(id);
        const start = Math.min(anchorIndex, clickedIndex);
        const end = Math.max(anchorIndex, clickedIndex);
        for (const point of points.slice(start, end + 1)) {
          if (shouldSelect) next.add(point.id);
          else next.delete(point.id);
        }
      } else if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    if (!range || selectionAnchorId.current == null) selectionAnchorId.current = id;
  };

  const toggleAllPoints = () => {
    const allSelected = selectedIds.size === points.length;
    setSelectedIds(allSelected ? new Set() : new Set(points.map((point) => point.id)));
    selectionAnchorId.current = null;
  };

  const setProjectCover = async (point: Point) => {
    if (!project || project.coverPointId === point.id || settingCoverId != null) return;
    setSettingCoverId(point.id);
    try {
      const result = await api.updateProject(project.id, { coverPointId: point.id });
      setProject(result.project);
      setToast({ kind: "success", message: "Ustawiono zdjęcie główne projektu." });
    } catch (error) {
      setToast({ kind: "error", message: error instanceof Error ? error.message : "Nie udało się ustawić zdjęcia głównego." });
    } finally {
      setSettingCoverId(null);
    }
  };

  if (!project) return <main className="page"><div className="page-loading"><span /><p>Otwieram projekt…</p></div></main>;

  return (
    <main className="page project-page">
      <div className="breadcrumb"><Link to="/"><ArrowLeft size={16} /> Projekty</Link></div>
      <header className="project-header">
        <div><span className="eyebrow">Projekt</span><h1>{project.name}</h1><p>{project.description || "Wybierz zdjęcia i ułóż nową trasę."}</p></div>
        <div className="header-actions">
          <input ref={fileInput} type="file" hidden multiple accept=".jpg,.jpeg,.png,.heic,.heif,.webp,image/*" onChange={async (event) => {
            const files = Array.from(event.target.files ?? []);
            if (!files.length) return;
            setUploadProgress({ done: 0, total: files.length, added: 0 });
            let addedCount = 0;
            const uploadErrors: Array<{ filename: string; error: string; kind?: "duplicate" | "processing" }> = [];
            try {
              const batchSize = 1;
              for (let offset = 0; offset < files.length; offset += batchSize) {
                const batch = files.slice(offset, offset + batchSize);
                const result = await api.uploadPhotos(project.id, batch);
                addedCount += result.points.length;
                uploadErrors.push(...result.errors);
                setPoints((current) => [...current, ...result.points]);
                setProject((current) => {
                  if (!current) return current;
                  const firstAdded = result.points[0];
                  return {
                    ...current,
                    pointCount: current.pointCount + result.points.length,
                    coverPointId: current.coverPointId ?? firstAdded?.id ?? null,
                    coverUrl: current.coverUrl ?? firstAdded?.previewUrl ?? null,
                  };
                });
                setUploadProgress({ done: Math.min(offset + batch.length, files.length), total: files.length, added: addedCount });
              }
              const duplicates = uploadErrors.filter((error) => error.kind === "duplicate").length;
              const failed = uploadErrors.length - duplicates;
              const notes = [duplicates ? `${duplicates} duplikatów pominięto` : "", failed ? `${failed} plików nie udało się przetworzyć` : ""].filter(Boolean).join(". ");
              setToast({ kind: failed ? "error" : "success", message: `Dodano ${addedCount} zdjęć.${notes ? ` ${notes}.` : ""}` });
            } catch (error) {
              setToast({ kind: "error", message: `${addedCount ? `Dodano ${addedCount} zdjęć, ale import został przerwany. ` : ""}${error instanceof Error ? error.message : "Nie udało się przesłać zdjęć."}` });
            } finally { setUploadProgress(null); event.target.value = ""; }
          }} />
          <button className="button button-secondary" type="button" disabled={uploading} onClick={() => fileInput.current?.click()}>{uploadProgress ? <LoaderCircle className="spin-icon" size={17} /> : <Upload size={17} />} {uploadProgress ? `Importuję ${uploadProgress.done}/${uploadProgress.total}` : "Dodaj zdjęcia"}</button>
          <button className="icon-button icon-button-bordered" type="button" onClick={() => setShowSettings(true)} aria-label="Ustawienia projektu"><MoreHorizontal size={20} /></button>
        </div>
      </header>

      {uploadProgress && (
        <section className="upload-progress-panel" role="status" aria-live="polite">
          <span className="upload-progress-icon"><LoaderCircle size={24} /></span>
          <div className="upload-progress-copy">
            <div><strong>Importuję zdjęcia</strong><span>{uploadProgress.done === 0 ? "Przygotowuję pierwsze zdjęcie…" : `Sprawdzono ${uploadProgress.done} z ${uploadProgress.total} · dodano ${uploadProgress.added}`}</span></div>
            <div className={`upload-progress-track${uploadProgress.done === 0 ? " is-starting" : ""}`} role="progressbar" aria-label="Postęp importowania zdjęć" aria-valuemin={0} aria-valuemax={uploadProgress.total} aria-valuenow={uploadProgress.done}>
              <span style={{ width: uploadProgress.done === 0 ? "22%" : `${Math.round(uploadProgress.done / uploadProgress.total * 100)}%` }} />
            </div>
            <small>Nie zamykaj tej strony. Zdjęcia będą pojawiać się poniżej pojedynczo.</small>
          </div>
          <strong className="upload-progress-count">{uploadProgress.done}/{uploadProgress.total}</strong>
        </section>
      )}

      <div className="tabs-toolbar">
        <div className="tabs" role="tablist">
          <button type="button" role="tab" aria-selected={tab === "photos"} onClick={() => setTab("photos")}><Images size={17} /> Zdjęcia <span>{points.length}</span></button>
          <button type="button" role="tab" aria-selected={tab === "map"} onClick={() => setTab("map")}><Map size={17} /> Mapa</button>
          <button type="button" role="tab" aria-selected={tab === "routes"} onClick={() => setTab("routes")}><RouteIcon size={17} /> Trasy <span>{routes.length}</span></button>
        </div>
        {tab !== "routes" && points.length > 0 && (
          <div className="selection-actions">
            <span><CheckSquare size={16} /> {selectedIds.size} wybranych</span>
            <button className="text-button" type="button" onClick={toggleAllPoints}>{selectedIds.size === points.length ? <><X size={14} /> Odznacz wszystkie</> : <><ListChecks size={14} /> Zaznacz wszystkie</>}</button>
            {tab === "photos" && <span className="selection-hint">Shift + kliknięcie = zakres</span>}
            <button className="button button-primary" type="button" disabled={locatedCount < 2} onClick={() => setShowRouteModal(true)}><Sparkles size={17} /> Nowa trasa</button>
          </div>
        )}
      </div>

      {missingLocationCount > 0 && selectedIds.size >= 2 && <div className="notice notice-warning">{missingLocationCount} wybranych zdjęć nie ma współrzędnych. Ustaw je przed utworzeniem trasy.</div>}

      {tab === "photos" && (
        <section>
          {points.length ? (
            <PhotoGallery points={points} selectedIds={selectedIds} coverPointId={project.coverPointId} settingCoverId={settingCoverId} onToggle={togglePointSelection} onOpen={setInspected} onSetCover={(point) => void setProjectCover(point)} />
          ) : (
            <div className="empty-tab"><span><Camera size={34} /></span><h2>Dodaj pierwsze zdjęcia</h2><p>Obsługiwane są pliki JPG, PNG, WebP i HEIC. GPS zostanie odczytany automatycznie.</p><button className="button button-primary" type="button" onClick={() => fileInput.current?.click()}><Upload size={18} /> Wybierz zdjęcia</button></div>
          )}
        </section>
      )}

      {tab === "map" && (
        <section className="project-map-layout">
          <div className="map-with-banner">
          {placingPoint && <div className="map-placement-banner"><span><Map size={16} /> Kliknij mapę, aby ustawić <strong>{placingPoint.originalFilename}</strong></span><button type="button" onClick={() => setPlacingPoint(null)}><X size={16} /> Anuluj</button></div>}
          <MapView ref={projectMapRef} points={points} selectedIds={selectedIds} editable placingPoint={placingPoint} onPlace={async (point, latitude, longitude) => {
            try { const result = await api.updatePoint(point.id, { latitude, longitude }); replacePoint(result.point); setPlacingPoint(null); setToast({ kind: "success", message: "Punkt ustawiony na mapie." }); }
            catch (error) { setToast({ kind: "error", message: error instanceof Error ? error.message : "Nie udało się ustawić punktu." }); }
          }} onSelect={setInspected} onMove={async (point, latitude, longitude) => {
            try { const result = await api.updatePoint(point.id, { latitude, longitude }); replacePoint(result.point); }
            catch (error) { setToast({ kind: "error", message: error instanceof Error ? error.message : "Nie udało się przesunąć punktu." }); }
          }} />
          </div>
          <aside className="map-side-list">
            <div className="section-heading compact"><div><span className="eyebrow">Punkty</span><h3>{points.length} zdjęć</h3></div></div>
            <div className="map-points-scroll">
              {points.map((point) => <button type="button" key={point.id} title={point.latitude == null ? "Ustaw współrzędne" : "Pokaż punkt na mapie"} onClick={() => point.latitude == null || point.longitude == null ? setInspected(point) : projectMapRef.current?.focus(point.id)}><img src={versionedPhotoUrl(point.previewUrl, point.createdAt)} alt="" /><span><strong>{point.symbol && <PointSymbolIcon symbol={point.symbol} size={15} />}{point.displayName || point.originalFilename}</strong><small>{point.latitude == null ? "Brak współrzędnych" : `${point.latitude.toFixed(5)}, ${point.longitude!.toFixed(5)}`}</small></span></button>)}
            </div>
          </aside>
        </section>
      )}

      {tab === "routes" && (
        <section className="routes-section">
          {routes.length ? <div className="routes-list">{routes.map((route) => (
            <Link to={`/projects/${project.id}/routes/${route.id}`} className="route-row" key={route.id}>
              <span className="route-icon"><RouteIcon size={20} /></span>
              <span className="route-main"><strong>{route.name}</strong><small>{route.pointIds.length} punktów · {Math.round(route.totalDistanceMeters)} m</small></span>
              <span className="route-date">{new Intl.DateTimeFormat("pl-PL", { day: "numeric", month: "short" }).format(new Date(route.updatedAt))}</span>
              <ArrowLeft className="row-arrow" size={18} />
            </Link>
          ))}</div> : <div className="empty-tab"><span><RouteIcon size={34} /></span><h2>Nie ma jeszcze tras</h2><p>Wróć do zdjęć, wybierz co najmniej dwa punkty i rozpocznij losowanie.</p><button className="button button-primary" type="button" onClick={() => setTab("photos")}><ListChecks size={18} /> Wybierz zdjęcia</button></div>}
        </section>
      )}

      {inspected && <Modal title={inspected.displayName || "Szczegóły punktu"} onClose={() => setInspected(null)} wide><PointInspector point={inspected} onSave={async (body) => {
        try { const result = await api.updatePoint(inspected.id, body); replacePoint(result.point); setToast({ kind: "success", message: "Punkt zapisany." }); }
        catch (error) { setToast({ kind: "error", message: error instanceof Error ? error.message : "Nie udało się zapisać." }); }
      }} onDelete={async () => {
        try {
          await api.deletePoint(inspected.id);
          const refreshed = await api.project(project.id);
          setProject(refreshed.project); setPoints(refreshed.points); setRoutes(refreshed.routes);
          setSelectedIds((current) => { const next = new Set(current); next.delete(inspected.id); return next; });
          setInspected(null); setToast({ kind: "success", message: "Zdjęcie usunięte." });
        }
        catch (error) { setToast({ kind: "error", message: error instanceof Error ? error.message : "Nie udało się usunąć." }); }
      }} onPlaceOnMap={() => { setPlacingPoint(inspected); setInspected(null); setTab("map"); }} /></Modal>}

      {showRouteModal && <CreateRouteModal availableCount={locatedCount} selectedCount={selectedIds.size} manualAvailable={selectedIds.size >= 2 && missingLocationCount === 0} onClose={() => setShowRouteModal(false)} onCreate={async (name, choice) => {
        const result = await api.createRoute(project.id, name, choice.mode === "automatic" ? choice : { mode: "manual", pointIds: Array.from(selectedIds), distanceMode: choice.distanceMode, puzzleTypes: choice.puzzleTypes });
        navigate(`/projects/${project.id}/routes/${result.route.id}`);
      }} />}

      {showSettings && <ProjectSettings project={project} onClose={() => setShowSettings(false)} onSaved={(updated) => { setProject(updated); setShowSettings(false); }} onDeleted={() => navigate("/")} />}
      <Toast toast={toast} onClose={() => setToast(null)} />
    </main>
  );
}

function ProjectSettings({ project, onClose, onSaved, onDeleted }: { project: Project; onClose: () => void; onSaved: (project: Project) => void; onDeleted: () => void }) {
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description);
  return <Modal title="Ustawienia projektu" onClose={onClose}><form className="form-stack" onSubmit={async (event) => { event.preventDefault(); const result = await api.updateProject(project.id, { name, description }); onSaved(result.project); }}>
    <label><span>Nazwa</span><input value={name} onChange={(event) => setName(event.target.value)} required /></label>
    <label><span>Opis</span><textarea rows={3} value={description} onChange={(event) => setDescription(event.target.value)} /></label>
    <div className="modal-actions spread"><button className="button button-danger-ghost" type="button" onClick={async () => { if (window.confirm("Usunąć cały projekt wraz ze zdjęciami i trasami?")) { await api.deleteProject(project.id); onDeleted(); } }}>Usuń projekt</button><span><button className="button button-secondary" type="button" onClick={onClose}>Anuluj</button><button className="button button-primary" type="submit">Zapisz</button></span></div>
  </form></Modal>;
}
