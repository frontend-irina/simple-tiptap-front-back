import type { DocumentInput, DocumentRecord, DocumentSummary, NoteResponse, SaveTransactions } from "@app/shared";
import { flatBlocksToTree } from "./flatBlocks";

const baseUrl = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, { ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.message ?? `HTTP ${response.status}`);
  }
  return response.status === 204 ? undefined as T : response.json();
}

function inflateNote(note: NoteResponse): DocumentRecord {
  return { ...note, blocks: flatBlocksToTree(note.blocks) };
}

export const api = {
  list: () => request<DocumentSummary[]>("/api/notes"),
  get: (noteId: string) => request<NoteResponse>(`/api/notes/${noteId}`).then(inflateNote),
  create: (input: DocumentInput) => request<NoteResponse>("/api/notes", { method: "POST", body: JSON.stringify(input) }).then(inflateNote),
  updateTitle: (noteId: string, title: string) => request<NoteResponse>(`/api/notes/${noteId}`, { method: "PATCH", body: JSON.stringify({ title }) }).then(inflateNote),
  saveTransactions: (noteId: string, payload: SaveTransactions) => request<NoteResponse & { appliedTransactionIds: string[] }>(`/api/notes/${noteId}/saveTransactions`, { method: "POST", body: JSON.stringify(payload) }).then((note) => ({ ...inflateNote(note), appliedTransactionIds: note.appliedTransactionIds })),
  remove: (noteId: string) => request<void>(`/api/notes/${noteId}`, { method: "DELETE" })
};
