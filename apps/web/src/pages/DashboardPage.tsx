import { ArrowRight, Camera, FolderPlus, Images, Map, Plus, Route as RouteIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { versionedPhotoUrl } from "../lib/photo-url";
import type { Project } from "../types";
import { Modal } from "../components/Modal";

export function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    api.projects().then((result) => setProjects(result.projects)).finally(() => setLoading(false));
  }, []);

  return (
    <main className="page dashboard-page">
      <header className="page-hero">
        <div><span className="eyebrow">Twoja baza przygód</span><h1>Projekty</h1><p>Każde miejsce ma własne zdjęcia, mapę i dowolną liczbę tras.</p></div>
        <button className="button button-primary" type="button" onClick={() => setShowCreate(true)}><Plus size={18} /> Nowy projekt</button>
      </header>

      {!loading && projects.length === 0 ? (
        <section className="empty-projects">
          <div className="empty-visual"><Map size={56} /><span className="empty-pin one"><Camera size={18} /></span><span className="empty-pin two"><Camera size={18} /></span><span className="empty-pin three"><Camera size={18} /></span></div>
          <div><span className="eyebrow">Pierwszy krok</span><h2>Zamień zdjęcia w trasę</h2><p>Utwórz projekt, prześlij zdjęcia z telefonu i pozwól aplikacji odczytać miejsca z GPS.</p></div>
          <button className="button button-primary button-large" type="button" onClick={() => setShowCreate(true)}><FolderPlus size={19} /> Utwórz pierwszy projekt</button>
        </section>
      ) : (
        <section className="project-grid" aria-busy={loading}>
          {loading && [1, 2, 3].map((item) => <div className="project-card skeleton" key={item} />)}
          {projects.map((project) => (
            <Link className="project-card" to={`/projects/${project.id}`} key={project.id}>
              <div className="project-cover">
                {project.coverUrl ? <img src={versionedPhotoUrl(project.coverUrl, project.updatedAt)} alt="" /> : <div className="project-placeholder"><Images size={36} /></div>}
                <span className="project-open"><ArrowRight size={20} /></span>
              </div>
              <div className="project-body">
                <div><h2>{project.name}</h2><p>{project.description || "Projekt podchodów"}</p></div>
                <div className="project-stats"><span><Images size={15} /> {project.pointCount} zdjęć</span><span><RouteIcon size={15} /> {project.routeCount} tras</span></div>
              </div>
            </Link>
          ))}
          <button className="project-card project-card-new" type="button" onClick={() => setShowCreate(true)}><span><Plus size={28} /></span><strong>Nowy projekt</strong><small>Dodaj kolejne miejsce</small></button>
        </section>
      )}

      {showCreate && <CreateProjectModal onClose={() => setShowCreate(false)} onCreate={async (name, description) => {
        const { project } = await api.createProject(name, description);
        navigate(`/projects/${project.id}`);
      }} />}
    </main>
  );
}

function CreateProjectModal({ onClose, onCreate }: { onClose: () => void; onCreate: (name: string, description: string) => Promise<void> }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  return (
    <Modal title="Nowy projekt" onClose={onClose}>
      <form className="form-stack" onSubmit={async (event) => {
        event.preventDefault(); setSaving(true);
        try { await onCreate(name, description); } finally { setSaving(false); }
      }}>
        <div className="modal-illustration"><FolderPlus size={34} /><small>nowe miejsce</small></div>
        <label><span>Nazwa</span><input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="np. Podchody na osiedlu" maxLength={80} required /></label>
        <label><span>Opis <em>opcjonalnie</em></span><textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Krótka informacja o miejscu lub okazji" maxLength={500} rows={3} /></label>
        <div className="modal-actions"><button className="button button-secondary" type="button" onClick={onClose}>Anuluj</button><button className="button button-primary" disabled={saving} type="submit">{saving ? "Tworzę…" : "Utwórz projekt"}</button></div>
      </form>
    </Modal>
  );
}
