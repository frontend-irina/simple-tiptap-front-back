import cors from "cors";
import express from "express";
import { v7 as uuidv7 } from "uuid";
import { ZodError } from "zod";
import { blockChangesSchema, blockSchema, blockTreeSchema, documentInputSchema, noteTitleSchema, saveTransactionsSchema, type BlockOperation } from "@app/shared";
import { pool } from "./db.js";
import { applyBlockOperations } from "./blockOperations.js";
import { treeToFlatBlocks } from "./flatBlocks.js";

const app = express();
app.use(cors({ origin: process.env.CLIENT_ORIGIN ?? "http://localhost:5173" }));
app.use(express.json({ limit: "2mb" }));

const selectColumns = `id, title, blocks, created_at AS "createdAt", updated_at AS "updatedAt"`;
const summaryColumns = `id, title, created_at AS "createdAt", updated_at AS "updatedAt"`;

function serializeNote(row: Record<string, unknown>) {
  const blocks = blockSchema.array().parse(row.blocks);
  return { ...row, blocks: treeToFlatBlocks(blocks) };
}

async function saveBlockTransactions(noteId: string, transactionOperations: BlockOperation[][]) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const current = await client.query<{ blocks: unknown }>("SELECT blocks FROM documents WHERE id = $1 FOR UPDATE", [noteId]);
    if (!current.rows[0]) {
      await client.query("ROLLBACK");
      return null;
    }
    let blocks = blockSchema.array().parse(current.rows[0].blocks);
    for (const operations of transactionOperations) blocks = applyBlockOperations(blocks, operations);
    blocks = blockTreeSchema.parse(blocks);
    const { rows } = await client.query(
      `UPDATE documents SET blocks = $2, updated_at = now() WHERE id = $1 RETURNING ${selectColumns}`,
      [noteId, JSON.stringify(blocks)]
    );
    await client.query("COMMIT");
    return rows[0] as Record<string, unknown>;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

app.get("/health", async (_req, res, next) => {
  try { await pool.query("SELECT 1"); res.json({ status: "ok" }); } catch (error) { next(error); }
});

app.get("/api/notes", async (_req, res, next) => {
  try {
    const { rows } = await pool.query(`SELECT ${summaryColumns} FROM documents ORDER BY updated_at DESC`);
    res.json(rows);
  } catch (error) { next(error); }
});

app.get("/api/notes/:noteId", async (req, res, next) => {
  try {
    const { rows } = await pool.query(`SELECT ${selectColumns} FROM documents WHERE id = $1`, [req.params.noteId]);
    if (!rows[0]) return res.status(404).json({ message: "Документ не найден" });
    res.json(serializeNote(rows[0]));
  } catch (error) { next(error); }
});

app.post("/api/notes", async (req, res, next) => {
  try {
    const input = documentInputSchema.parse(req.body);
    const id = uuidv7();
    const { rows } = await pool.query(
      `INSERT INTO documents (id, title, blocks) VALUES ($1, $2, $3) RETURNING ${selectColumns}`,
      [id, input.title, JSON.stringify(input.blocks)]
    );
    res.status(201).json(serializeNote(rows[0]));
  } catch (error) { next(error); }
});

app.put("/api/notes/:noteId", async (req, res, next) => {
  try {
    const input = documentInputSchema.parse(req.body);
    const { rows } = await pool.query(
      `UPDATE documents SET title = $2, blocks = $3, updated_at = now() WHERE id = $1 RETURNING ${selectColumns}`,
      [req.params.noteId, input.title, JSON.stringify(input.blocks)]
    );
    if (!rows[0]) return res.status(404).json({ message: "Документ не найден" });
    res.json(serializeNote(rows[0]));
  } catch (error) { next(error); }
});

app.patch("/api/notes/:noteId", async (req, res, next) => {
  try {
    const input = noteTitleSchema.parse(req.body);
    const { rows } = await pool.query(
      `UPDATE documents SET title = $2, updated_at = now() WHERE id = $1 RETURNING ${selectColumns}`,
      [req.params.noteId, input.title]
    );
    if (!rows[0]) return res.status(404).json({ message: "Документ не найден" });
    res.json(serializeNote(rows[0]));
  } catch (error) { next(error); }
});

app.patch("/api/notes/:noteId/blocks", async (req, res, next) => {
  try {
    const changes = blockChangesSchema.parse(req.body);
    const row = await saveBlockTransactions(req.params.noteId, [changes.operations]);
    if (!row) return res.status(404).json({ message: "Документ не найден" });
    res.json({ ...serializeNote(row), clientMutationId: changes.clientMutationId });
  } catch (error) {
    next(error);
  }
});

app.post("/api/notes/:noteId/saveTransactions", async (req, res, next) => {
  try {
    const payload = saveTransactionsSchema.parse(req.body);
    const row = await saveBlockTransactions(
      req.params.noteId,
      payload.transactions.map((transaction) => transaction.operations)
    );
    if (!row) return res.status(404).json({ message: "Документ не найден" });
    res.json({
      ...serializeNote(row),
      appliedTransactionIds: payload.transactions.map((transaction) => transaction.id)
    });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/notes/:noteId", async (req, res, next) => {
  try {
    const result = await pool.query("DELETE FROM documents WHERE id = $1", [req.params.noteId]);
    if (!result.rowCount) return res.status(404).json({ message: "Документ не найден" });
    res.status(204).end();
  } catch (error) { next(error); }
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (error instanceof ZodError) return res.status(400).json({ message: "Некорректный документ", issues: error.issues });
  console.error(error);
  res.status(500).json({ message: "Внутренняя ошибка сервера" });
});

const port = Number(process.env.PORT ?? 3001);
app.listen(port, () => console.log(`API started on http://localhost:${port}`));
