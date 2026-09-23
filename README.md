# Local Notes

Локальное full-stack приложение заметок: React + TypeScript + Vite, Tiptap, Node.js/Express и PostgreSQL. Идентификаторы документов и блоков создаются как UUID v7. Контент хранится в `jsonb` в формате блоков BlockNote (`id`, `type`, `props`, `content`, `children`).

Подробное описание транзакционного сохранения: [docs/saving.md](docs/saving.md).

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

- `GET /api/notes`
- `GET /api/notes/:noteId`
- `POST /api/notes`
- `PUT /api/notes/:noteId`
- `PATCH /api/notes/:noteId/blocks` — пакетные операции `create`, `update`, `delete`, `move`
- `POST /api/notes/:noteId/saveTransactions` — атомарное сохранение транзакций `create`, `update`, `delete`, `move`
- `DELETE /api/notes/:noteId`

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

`GET /api/notes/:noteId` возвращает плоский массив блоков. Каждый блок содержит
`parentId` и относительную позицию `{ before, after }`, где значения — UUID
соседних блоков или `null` на границе списка. Клиент восстанавливает дерево
`children` по `parentId`.

Фронтенд сохраняет изменения блоков через `saveTransactions`: через 1 секунду
после последнего изменения или принудительно через 5 секунд после начала
непрерывной серии изменений. В транзакцию попадают только операции над
изменившимися блоками, а не вся заметка.
