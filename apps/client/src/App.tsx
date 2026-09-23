import { useEffect, useRef, useState } from "react";
import type { BlockNoteBlock, DocumentRecord, DocumentSummary } from "@app/shared";
import { v7 as uuidv7 } from "uuid";
import { api } from "./api";
import { Editor } from "./Editor";
import { diffBlocks } from "./blockDiff";

function emptyBlocks(): BlockNoteBlock[] {
  return [{ id: uuidv7(), type: "paragraph", props: { backgroundColor: "default", textColor: "default", textAlignment: "left" }, content: [], children: [] }];
}

export function App() {
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [active, setActive] = useState<DocumentRecord | null>(null);
  const [title, setTitle] = useState("Без названия");
  const [blocks, setBlocks] = useState<BlockNoteBlock[]>(emptyBlocks);
  const [status, setStatus] = useState("Загрузка…");
  const [error, setError] = useState("");
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const maxTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hydrated = useRef(false);
  const loadSequence = useRef(0);
  const activeRef = useRef<DocumentRecord | null>(null);
  const latestDraft = useRef({ title, blocks });
  const confirmedTitle = useRef(title);
  const confirmedBlocks = useRef<BlockNoteBlock[]>(blocks);
  const saveInFlight = useRef(false);
  const pendingSave = useRef(false);

  activeRef.current = active;
  latestDraft.current = { title, blocks };

  useEffect(() => {
    api.list().then((items) => {
      setDocuments(items);
      if (items[0]) void loadDocument(items[0].id);
      else { hydrated.current = true; setStatus("Новый документ"); }
    }).catch(showError);
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    setStatus("Есть изменения…");
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => void save(), 1_000);
    if (!maxTimer.current) maxTimer.current = setTimeout(() => void save(), 5_000);
  }, [title, blocks]);

  useEffect(() => {
    const flushWhenHidden = () => { if (document.visibilityState === "hidden") void save(); };
    window.addEventListener("pagehide", flushWhenHidden);
    document.addEventListener("visibilitychange", flushWhenHidden);
    return () => {
      clearSaveTimers();
      window.removeEventListener("pagehide", flushWhenHidden);
      document.removeEventListener("visibilitychange", flushWhenHidden);
    };
  }, []);

  function clearSaveTimers() {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    if (maxTimer.current) clearTimeout(maxTimer.current);
    idleTimer.current = null;
    maxTimer.current = null;
  }

  function showError(reason: unknown) { setError(reason instanceof Error ? reason.message : "Неизвестная ошибка"); setStatus("Ошибка сохранения"); }

  async function loadDocument(id: string) {
    if (hydrated.current) await save();
    const sequence = ++loadSequence.current;
    hydrated.current = false;
    clearSaveTimers();
    setStatus("Загружаю блоки…");
    setError("");
    try {
      const document = await api.get(id);
      if (sequence !== loadSequence.current) return;
      setActive(document);
      activeRef.current = document;
      setTitle(document.title);
      setBlocks(document.blocks);
      confirmedTitle.current = document.title;
      confirmedBlocks.current = structuredClone(document.blocks);
      setStatus(`Загружено блоков: ${document.blocks.length}`);
      window.setTimeout(() => { hydrated.current = true; }, 0);
    } catch (reason) {
      if (sequence === loadSequence.current) showError(reason);
    }
  }

  async function save() {
    clearSaveTimers();
    if (saveInFlight.current) {
      pendingSave.current = true;
      return;
    }
    const draft = { title: latestDraft.current.title.trim(), blocks: structuredClone(latestDraft.current.blocks) };
    if (!draft.title) return setStatus("Добавьте название");
    saveInFlight.current = true;
    try {
      setStatus("Сохраняю…"); setError("");
      let saved: DocumentRecord;
      const current = activeRef.current;
      if (!current) {
        saved = await api.create(draft);
        activeRef.current = saved;
      } else {
        const operations = diffBlocks(confirmedBlocks.current, draft.blocks);
        saved = current;
        if (operations.length) {
          saved = await api.saveTransactions(current.id, {
            transactions: [{ id: uuidv7(), operations }]
          });
        }
        if (draft.title !== confirmedTitle.current) saved = await api.updateTitle(current.id, draft.title);
      }
      confirmedTitle.current = draft.title;
      confirmedBlocks.current = structuredClone(draft.blocks);
      activeRef.current = saved;
      setActive(saved);
      const summary: DocumentSummary = { id: saved.id, title: saved.title, createdAt: saved.createdAt, updatedAt: saved.updatedAt };
      setDocuments((items) => [summary, ...items.filter((item) => item.id !== saved.id)]);
      const hasNewChanges = latestDraft.current.title.trim() !== confirmedTitle.current || diffBlocks(confirmedBlocks.current, latestDraft.current.blocks).length > 0;
      setStatus(hasNewChanges ? "Есть изменения…" : "Сохранено");
    } catch (reason) {
      showError(reason);
    } finally {
      saveInFlight.current = false;
      if (pendingSave.current) {
        pendingSave.current = false;
        void save();
      }
    }
  }

  async function createDocument() {
    if (hydrated.current) await save();
    loadSequence.current += 1;
    hydrated.current = false;
    clearSaveTimers();
    const newBlocks = emptyBlocks();
    setActive(null); activeRef.current = null;
    setTitle("Без названия"); setBlocks(newBlocks); setStatus("Новый документ");
    confirmedTitle.current = "Без названия";
    confirmedBlocks.current = structuredClone(newBlocks);
    window.setTimeout(() => { hydrated.current = true; }, 0);
  }

  async function removeDocument() {
    if (!active || !window.confirm(`Удалить «${active.title}»?`)) return;
    try {
      clearSaveTimers();
      await api.remove(active.id);
      const rest = documents.filter((item) => item.id !== active.id);
      setDocuments(rest);
      if (rest[0]) await loadDocument(rest[0].id); else createDocument();
    } catch (reason) { showError(reason); }
  }

  return <main className="layout">
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark">N</span><span>Local Notes</span></div>
      <button className="new-button" onClick={() => void createDocument()}>＋ Новый документ</button>
      <nav className="document-list" aria-label="Документы">
        {documents.map((document) => <button key={document.id} onClick={() => void loadDocument(document.id)} className={active?.id === document.id ? "selected" : ""}>
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
