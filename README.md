# Local Notes

Локальное full-stack приложение заметок: React + TypeScript + Vite, Tiptap, Node.js/Express и PostgreSQL. Идентификаторы документов и блоков создаются как UUID v7. Контент хранится в `jsonb` в формате блоков BlockNote (`id`, `type`, `props`, `content`, `children`).

## Запуск

Требуются Node.js 22+, npm и Docker.

```bash
cp .env.example .env
npm install
docker compose up -d
npm run db:migrate
npm run dev
```

Откройте http://localhost:5173. API доступно на http://localhost:3001, проверка — `GET /health`.

## Команды

- `npm run dev` — frontend и API одновременно;
- `npm run build` — production-сборка всех workspace;
- `npm run typecheck` — проверка TypeScript;
- `npm run db:migrate` — создание таблицы и индекса;
- `docker compose down` — остановка PostgreSQL (данные останутся в volume).

## API

- `GET /api/documents`
- `GET /api/documents/:id`
- `POST /api/documents`
- `PUT /api/documents/:id`
- `DELETE /api/documents/:id`

Тело POST/PUT:

```json
{
  "title": "Название",
  "blocks": [{
    "id": "0199...",
    "type": "paragraph",
    "props": { "backgroundColor": "default", "textColor": "default", "textAlignment": "left" },
    "content": [{ "type": "text", "text": "Текст", "styles": {} }],
    "children": []
  }]
}
```
