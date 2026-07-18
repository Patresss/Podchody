import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowLeft, Brain, ChevronDown, ChevronRight, Download, FileText, Flag, Footprints, GripVertical, Map as MapIcon, MoreHorizontal, RefreshCw, Route as RouteIcon, Sparkles, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { MapView, type MapViewHandle } from "../components/MapView";
import { PointSymbolIcon } from "../components/PointSymbol";
import { PuzzleSettingsModal } from "../components/PuzzleSettingsModal";
import { Toast, type ToastState } from "../components/Toast";
import { api } from "../lib/api";
import { distanceMeters, formatDistance } from "../lib/geo";
import { optimizeHidingOrder, pathDistanceMeters } from "../lib/hiding-order";
import type { PrintDocumentKind } from "../lib/pdf";
import { versionedPhotoUrl } from "../lib/photo-url";
import { puzzleSelectionLabel } from "../lib/puzzles";
import type { Point, Project, RouteDistanceMode, RoutePlan } from "../types";

export function RoutePage() {
  const { projectId = "", routeId = "" } = useParams();
  const navigate = useNavigate();
  const mapRef = useRef<MapViewHandle>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [route, setRoute] = useState<RoutePlan | null>(null);
  const [points, setPoints] = useState<Point[]>([]);
  const [working, setWorking] = useState("");
  const [toast, setToast] = useState<ToastState>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const [showPuzzleSettings, setShowPuzzleSettings] = useState(false);
  const [orderView, setOrderView] = useState<"game" | "hiding">("game");
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    Promise.all([api.route(routeId), api.project(projectId)]).then(([routeResult, projectResult]) => {
      setRoute(routeResult.route); setPoints(routeResult.points); setProject(projectResult.project);
    });
  }, [routeId, projectId]);

  const pointMap = useMemo(() => new globalThis.Map(points.map((point) => [point.id, point])), [points]);
  const orderedPoints = useMemo(() => route?.pointIds.map((id) => pointMap.get(id)).filter((point): point is Point => Boolean(point)) ?? [], [route, pointMap]);
  const hidingPoints = useMemo(() => optimizeHidingOrder(orderedPoints), [orderedPoints]);
  const hidingPointIds = useMemo(() => hidingPoints.map((point) => point.id), [hidingPoints]);
  const hidingDistance = useMemo(() => pathDistanceMeters(hidingPoints), [hidingPoints]);
  const activePointIds = orderView === "game" ? route?.pointIds ?? [] : hidingPointIds;

  const handleDragEnd = async ({ active, over }: DragEndEvent) => {
    if (!route || !over || active.id === over.id) return;
    const oldIndex = route.pointIds.indexOf(String(active.id));
    const newIndex = route.pointIds.indexOf(String(over.id));
    const nextOrder = arrayMove(route.pointIds, oldIndex, newIndex);
    setRoute({ ...route, pointIds: nextOrder });
    try { const result = await api.reorderRoute(route.id, nextOrder); setRoute(result.route); }
    catch (error) { setRoute(route); setToast({ kind: "error", message: error instanceof Error ? error.message : "Nie udało się zmienić kolejności." }); }
  };

  const handleDownload = async (kind: PrintDocumentKind | "package") => {
    if (!project || !route || (kind !== "cards" && !mapRef.current)) return;
    setWorking(kind === "cards" ? "Przygotowuję karty…" : "Przygotowuję mapę…");
    try {
      const routeMap = kind === "organizer" || kind === "package" ? await mapRef.current!.capture(true, route.pointIds) : "";
      const input = { project, route, orderedPoints, hidingPointIds, routeMap };
      const pdf = await import("../lib/pdf");
      if (kind === "package") {
        await pdf.generatePrintPackage(input, setWorking);
        setToast({ kind: "success", message: "Paczka z dwoma PDF-ami jest gotowa." });
      } else {
        await pdf.generateSinglePdf(input, kind, setWorking);
        setToast({ kind: "success", message: "PDF jest gotowy do pobrania." });
      }
    } catch (error) {
      setToast({ kind: "error", message: error instanceof Error ? error.message : "Nie udało się wygenerować PDF-u." });
    } finally {
      setWorking("");
    }
  };

  if (!project || !route) return <main className="page"><div className="page-loading"><span /><p>Układam trasę…</p></div></main>;

  return (
    <main className="page route-page">
      <div className="breadcrumb"><Link to={`/projects/${project.id}`}><ArrowLeft size={16} /> {project.name}</Link></div>
      <header className="route-header">
        <div><span className="eyebrow"><Sparkles size={14} /> {route.generationMode === "automatic" ? "Automatycznie wybrana trasa" : "Trasa z zaznaczonych zdjęć"}</span><h1>{route.name}</h1><p>Przeciągnij punkty, jeśli chcesz skorygować kolejność.</p></div>
        <div className="header-actions route-actions">
          <button className="button button-secondary" type="button" disabled={Boolean(working)} onClick={async () => {
            setWorking(route.generationMode === "automatic" ? "Wybieram nowy zestaw i kolejność…" : "Losuję nową kolejność…");
            try { const result = await api.rerollRoute(route.id); setRoute(result.route); setToast({ kind: "success", message: route.generationMode === "automatic" ? "Wylosowano nowy zestaw zdjęć i kolejność." : "Wylosowano nową kolejność." }); }
            catch (error) { setToast({ kind: "error", message: error instanceof Error ? error.message : "Nie udało się losować." }); }
            finally { setWorking(""); }
          }}><RefreshCw size={17} /> Losuj ponownie</button>
          <div className="download-split">
            <button className="button button-primary" type="button" disabled={Boolean(working)} onClick={() => { setShowDownloadMenu(false); void handleDownload("package"); }}><Download size={17} /> Pobierz wszystko (ZIP)</button>
            <button className="download-options-button" type="button" disabled={Boolean(working)} aria-label="Pobierz osobny PDF" aria-expanded={showDownloadMenu} onClick={() => { setShowMenu(false); setShowDownloadMenu((value) => !value); }}><ChevronDown size={17} /></button>
            {showDownloadMenu && <div className="dropdown-menu download-menu">
              <button type="button" onClick={() => { setShowDownloadMenu(false); void handleDownload("organizer"); }}><FileText size={16} /><span><strong>Plan organizatora</strong><small>Osobny PDF</small></span></button>
              <button type="button" onClick={() => { setShowDownloadMenu(false); void handleDownload("cards"); }}><FileText size={16} /><span><strong>Karty A4</strong><small>Osobny PDF</small></span></button>
            </div>}
          </div>
          <div className="menu-wrap"><button className="icon-button icon-button-bordered" type="button" onClick={() => { setShowDownloadMenu(false); setShowMenu((value) => !value); }} aria-label="Więcej opcji"><MoreHorizontal size={20} /></button>{showMenu && <div className="dropdown-menu"><button type="button" onClick={async () => { if (window.confirm("Usunąć tę trasę?")) { await api.deleteRoute(route.id); navigate(`/projects/${project.id}`); } }}><Trash2 size={16} /> Usuń trasę</button></div>}</div>
        </div>
      </header>

      <section className="route-stats">
        <div><span className="stat-icon stat-green"><RouteIcon size={19} /></span><span><small>Trasa szukających</small><strong>{formatDistance(route.totalDistanceMeters)}</strong></span></div>
        <div><span className="stat-icon stat-blue"><Footprints size={19} /></span><span><small>Trasa chowającego</small><strong>{formatDistance(hidingDistance)}</strong></span></div>
        <div><span className="stat-icon stat-orange"><MapIcon size={19} /></span><span><small>Punkty</small><strong>{route.pointIds.length}</strong></span></div>
        <div className="route-score"><label><span>STYL TRASY</span><select aria-label="Styl trasy" value={route.distanceMode} disabled={Boolean(working)} onChange={async (event) => {
          const distanceMode = event.target.value as RouteDistanceMode;
          setWorking("Dopasowuję trasę do nowego stylu…");
          try {
            const result = await api.rerollRoute(route.id, distanceMode);
            setRoute(result.route);
            setToast({ kind: "success", message: "Zmieniono styl i ponownie ułożono trasę." });
          } catch (error) { setToast({ kind: "error", message: error instanceof Error ? error.message : "Nie udało się zmienić stylu trasy." }); }
          finally { setWorking(""); }
        }}><option value="maximum">Dużo biegania</option><option value="balanced">Zrównoważona</option><option value="compact">Krótsze przejścia</option></select></label></div>
        <div className="route-score route-puzzle-score"><Brain size={18} aria-hidden="true" /><button type="button" disabled={Boolean(working)} aria-label="Zmień zagadki na kartach" onClick={() => setShowPuzzleSettings(true)}><span>ZAGADKI</span><strong>{puzzleSelectionLabel(route.puzzleTypes)}</strong><ChevronRight size={16} aria-hidden="true" /></button></div>
      </section>

      <div className="route-order-tabs" role="tablist" aria-label="Rodzaj kolejności">
        <button type="button" role="tab" aria-selected={orderView === "game"} className={orderView === "game" ? "is-active" : ""} onClick={() => setOrderView("game")}><Footprints size={17} /><span><strong>Kolejność gry</strong><small>Trasa dzieci od startu do mety</small></span></button>
        <button type="button" role="tab" aria-selected={orderView === "hiding"} className={orderView === "hiding" ? "is-active" : ""} onClick={() => setOrderView("hiding")}><MapIcon size={17} /><span><strong>Kolejność chowania</strong><small>Najkrótsza droga · {formatDistance(hidingDistance)}</small></span></button>
      </div>

      <section className="route-workspace">
        <div className="route-map-panel">
          <div className="panel-heading"><div><span className="eyebrow">Podgląd</span><h2>{orderView === "game" ? "Mapa gry" : "Droga do chowania"}</h2></div><button className="text-button" type="button" onClick={() => mapRef.current?.fit()}>Pokaż całość</button></div>
          <MapView ref={mapRef} points={orderedPoints} orderedIds={activePointIds} className="route-map" />
          <div className="map-legend"><span><i className="legend-line" /> {orderView === "game" ? "Kolejność gry" : "Kolejność chowania"}</span><span><i className="legend-dot" /> Punkt ze zdjęciem</span></div>
        </div>
        <div className="route-order-panel">
          <div className="panel-heading"><div><span className="eyebrow">Kolejność</span><h2>{orderView === "game" ? "Od startu do mety" : "Schowaj po kolei"}</h2></div></div>
          {orderView === "game" ? <>
            <div className="start-row"><span><Footprints size={18} /></span><div><strong>START</strong><small>Karta startowa prowadzi do punktu 1</small></div></div>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={route.pointIds} strategy={verticalListSortingStrategy}>
                <div className="sortable-list">{orderedPoints.map((point, index) => <SortablePoint key={point.id} point={point} index={index} next={orderedPoints[index + 1] ?? null} />)}</div>
              </SortableContext>
            </DndContext>
            <div className="finish-row"><span><Flag size={18} /></span><div><strong>META</strong><small>Ostatnia karta kończy zabawę</small></div></div>
          </> : <>
            <div className="start-row hiding-start"><span><MapIcon size={18} /></span><div><strong>ZACZNIJ OD NUMERU 1</strong><small>Numery są również na niebieskich polach kart</small></div></div>
            <div className="sortable-list">{hidingPoints.map((point, index) => <HidingPoint key={point.id} point={point} index={index} gameIndex={orderedPoints.findIndex((candidate) => candidate.id === point.id)} next={hidingPoints[index + 1] ?? null} />)}</div>
            <div className="finish-row"><span><Flag size={18} /></span><div><strong>WSZYSTKO SCHOWANE</strong><small>To koniec najkrótszej wyznaczonej drogi</small></div></div>
          </>}
        </div>
      </section>

      {working && <div className="working-overlay" role="status"><span className="working-spinner" /><strong>{working}</strong><small>Nie zamykaj tej karty.</small></div>}
      {showPuzzleSettings && <PuzzleSettingsModal selected={route.puzzleTypes} onClose={() => setShowPuzzleSettings(false)} onSave={async (puzzleTypes) => {
        const result = await api.updateRoutePuzzles(route.id, puzzleTypes);
        setRoute(result.route);
        setShowPuzzleSettings(false);
        setToast({ kind: "success", message: puzzleTypes.length ? "Zapisano zestaw zagadek. Karty zostaną podzielone możliwie równo i losowo." : "Wyłączono zagadki na kartach." });
      }} />}
      <Toast toast={toast} onClose={() => setToast(null)} />
    </main>
  );
}

function HidingPoint({ point, index, gameIndex, next }: { point: Point; index: number; gameIndex: number; next: Point | null }) {
  return (
    <div className="sortable-point hiding-point">
      <span className="order-number hiding-order-number">{index + 1}</span>
      <img src={versionedPhotoUrl(point.previewUrl, point.createdAt)} alt="" />
      <span className="point-copy"><strong>{point.symbol && <PointSymbolIcon symbol={point.symbol} size={14} />}{point.displayName || `Punkt gry ${gameIndex + 1}`}</strong><small>{next ? `${formatDistance(distanceMeters(point, next))} do następnego` : "Ostatnie miejsce chowania"}</small></span>
      <span className="game-order-pill">Gra {gameIndex + 1}</span>
    </div>
  );
}

function SortablePoint({ point, index, next }: { point: Point; index: number; next: Point | null }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: point.id });
  return (
    <div ref={setNodeRef} className={`sortable-point${isDragging ? " is-dragging" : ""}`} style={{ transform: CSS.Transform.toString(transform), transition }}>
      <button type="button" className="drag-handle" {...attributes} {...listeners} aria-label={`Przeciągnij punkt ${index + 1}`}><GripVertical size={18} /></button>
      <span className="order-number">{index + 1}</span>
      <img src={versionedPhotoUrl(point.previewUrl, point.createdAt)} alt="" />
      <span className="point-copy"><strong>{point.symbol && <PointSymbolIcon symbol={point.symbol} size={14} />}{point.displayName || `Punkt ${index + 1}`}</strong><small>{next ? `${formatDistance(distanceMeters(point, next))} do następnego` : "Ostatni punkt"}</small></span>
      {next ? <span className="to-next">→</span> : <Flag size={17} className="finish-icon" />}
    </div>
  );
}
