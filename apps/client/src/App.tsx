import { useEffect, useRef, useState } from "react";
import type { BlockNoteBlock, DocumentRecord } from "@app/shared";
import { v7 as uuidv7 } from "uuid";
import { api } from "./api";
import { Editor } from "./Editor";

function emptyBlocks(): BlockNoteBlock[] {
  return [{ id: uuidv7(), type: "paragraph", props: { backgroundColor: "default", textColor: "default", textAlignment: "left" }, content: [], children: [] }];
}

export function App() {
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [active, setActive] = useState<DocumentRecord | null>(null);
  const [title, setTitle] = useState("Без названия");
  const [blocks, setBlocks] = useState<BlockNoteBlock[]>(emptyBlocks);
  const [status, setStatus] = useState("Загрузка…");
  const [error, setError] = useState("");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hydrated = useRef(false);

  useEffect(() => {
    api.list().then((items) => {
      setDocuments(items);
      if (items[0]) select(items[0]);
      else { hydrated.current = true; setStatus("Новый документ"); }
    }).catch(showError);
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setStatus("Есть изменения…");
    saveTimer.current = setTimeout(() => void save(), 700);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [title, blocks]);

  function showError(reason: unknown) { setError(reason instanceof Error ? reason.message : "Неизвестная ошибка"); setStatus("Ошибка сохранения"); }

  function select(document: DocumentRecord) {
    hydrated.current = false;
    setActive(document); setTitle(document.title); setBlocks(document.blocks); setStatus("Сохранено");
    queueMicrotask(() => { hydrated.current = true; });
  }

  async function save() {
    if (!title.trim()) return setStatus("Добавьте название");
    try {
      setStatus("Сохраняю…"); setError("");
      const saved = active
        ? await api.update(active.id, { title: title.trim(), blocks })
        : await api.create({ title: title.trim(), blocks });
      setActive(saved);
      setDocuments((items) => [saved, ...items.filter((item) => item.id !== saved.id)]);
      setStatus("Сохранено");
    } catch (reason) { showError(reason); }
  }

  function createDocument() {
    hydrated.current = false;
    setActive(null); setTitle("Без названия"); setBlocks(emptyBlocks()); setStatus("Новый документ");
    queueMicrotask(() => { hydrated.current = true; });
  }

  async function removeDocument() {
    if (!active || !window.confirm(`Удалить «${active.title}»?`)) return;
    try {
      await api.remove(active.id);
      const rest = documents.filter((item) => item.id !== active.id);
      setDocuments(rest);
      if (rest[0]) select(rest[0]); else createDocument();
    } catch (reason) { showError(reason); }
  }

  return <main className="layout">
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark">N</span><span>Local Notes</span></div>
      <button className="new-button" onClick={createDocument}>＋ Новый документ</button>
      <nav className="document-list" aria-label="Документы">
        {documents.map((document) => <button key={document.id} onClick={() => select(document)} className={active?.id === document.id ? "selected" : ""}>
          <span>{document.title}</span><small>{new Date(document.updatedAt).toLocaleDateString("ru-RU")}</small>
        </button>)}
      </nav>
      <div className="db-label"><span /> PostgreSQL · локально</div>
    </aside>
    <section className="workspace">
      <header className="topbar">
        <span className={`save-status ${error ? "error" : ""}`}>{status}</span>
        <div className="actions"><button onClick={() => void save()}>Сохранить</button>{active && <button className="danger" onClick={() => void removeDocument()}>Удалить</button>}</div>
      </header>
      <article className="page">
        <input className="title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={200} aria-label="Название документа" />
        {error && <div className="error-banner">{error}. Проверьте, что API и PostgreSQL запущены.</div>}
        <Editor key={active?.id ?? "new"} blocks={blocks} onChange={setBlocks} />
      </article>
    </section>
  </main>;
}
