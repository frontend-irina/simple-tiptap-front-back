import type { DocumentInput, DocumentRecord } from "@app/shared";

const baseUrl = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, { ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.message ?? `HTTP ${response.status}`);
  }
  return response.status === 204 ? undefined as T : response.json();
}

export const api = {
  list: () => request<DocumentRecord[]>("/api/documents"),
  create: (input: DocumentInput) => request<DocumentRecord>("/api/documents", { method: "POST", body: JSON.stringify(input) }),
  update: (id: string, input: DocumentInput) => request<DocumentRecord>(`/api/documents/${id}`, { method: "PUT", body: JSON.stringify(input) }),
  remove: (id: string) => request<void>(`/api/documents/${id}`, { method: "DELETE" })
};
