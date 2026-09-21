import cors from "cors";
import express from "express";
import { v7 as uuidv7 } from "uuid";
import { ZodError } from "zod";
import { documentInputSchema } from "@app/shared";
import { pool } from "./db.js";

const app = express();
app.use(cors({ origin: process.env.CLIENT_ORIGIN ?? "http://localhost:5173" }));
app.use(express.json({ limit: "2mb" }));

const selectColumns = `id, title, blocks, created_at AS "createdAt", updated_at AS "updatedAt"`;

app.get("/health", async (_req, res, next) => {
  try { await pool.query("SELECT 1"); res.json({ status: "ok" }); } catch (error) { next(error); }
});

app.get("/api/documents", async (_req, res, next) => {
  try {
    const { rows } = await pool.query(`SELECT ${selectColumns} FROM documents ORDER BY updated_at DESC`);
    res.json(rows);
  } catch (error) { next(error); }
});

app.get("/api/documents/:id", async (req, res, next) => {
  try {
    const { rows } = await pool.query(`SELECT ${selectColumns} FROM documents WHERE id = $1`, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ message: "Документ не найден" });
    res.json(rows[0]);
  } catch (error) { next(error); }
});

app.post("/api/documents", async (req, res, next) => {
  try {
    const input = documentInputSchema.parse(req.body);
    const id = uuidv7();
    const { rows } = await pool.query(
      `INSERT INTO documents (id, title, blocks) VALUES ($1, $2, $3) RETURNING ${selectColumns}`,
      [id, input.title, JSON.stringify(input.blocks)]
    );
    res.status(201).json(rows[0]);
  } catch (error) { next(error); }
});

app.put("/api/documents/:id", async (req, res, next) => {
  try {
    const input = documentInputSchema.parse(req.body);
    const { rows } = await pool.query(
      `UPDATE documents SET title = $2, blocks = $3, updated_at = now() WHERE id = $1 RETURNING ${selectColumns}`,
      [req.params.id, input.title, JSON.stringify(input.blocks)]
    );
    if (!rows[0]) return res.status(404).json({ message: "Документ не найден" });
    res.json(rows[0]);
  } catch (error) { next(error); }
});

app.delete("/api/documents/:id", async (req, res, next) => {
  try {
    const result = await pool.query("DELETE FROM documents WHERE id = $1", [req.params.id]);
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
