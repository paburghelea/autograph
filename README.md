# GraphHopper


## Features

- **3D graph viewer** — Interactive force-directed graph using Three.js and `react-force-graph-3d`
- **Graph files** — Save, load, duplicate, and delete named graphs; list all saved files in a sidebar
- **Rhino integration** — Attach and download Rhino `.3dm` files per graph
- **Metadata styling** — Color nodes and links by numeric attributes (e.g. `uValue`, `level`)
- **Node details** — Click a node to see its attributes in a side panel
- **Column/floor test** — Run a built-in test that applies results to node metadata
- **Live updates** — Optional polling to refresh when the current file changes on the server
- **Error preview** — Toggle to highlight nodes/links with error-related metadata
- **Dark/light theme** — Theme toggle in the UI

## Tech stack

- **Framework:** Next.js 16, React 19
- **3D:** Three.js, react-force-graph-3d
- **State:** Zustand
- **Database:** Turso (libSQL) via `@libsql/client`
- **UI:** Tailwind CSS, shadcn/ui, Base UI, Lucide icons

## Getting started

### Prerequisites

- Node.js (v18+)
- A [Turso](https://turso.tech/) database (or compatible libSQL endpoint)

### Environment

Create a `.env.local` (or set in your environment):

```env
TURSO_DATABASE_URL=libsql://your-database.turso.io
TURSO_AUTH_TOKEN=your-auth-token
```

### Install and run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Scripts

| Script   | Description              |
|----------|--------------------------|
| `npm run dev`   | Start dev server        |
| `npm run build` | Production build       |
| `npm run start` | Start production server |

## Data model

- **Graph:** `nodes` (id, name, arbitrary key-value metadata) and `links` (array of link sets; each set has `set`, optional `notes`, and `links` with `source`, `target`, optional `name`, and metadata).
- **Graph file:** A saved record with id, name, graph JSON, optional Rhino file (base64), and timestamps. Stored in Turso in the `graph_files` table.

## API

- `GET /api/graphs` — List all graph files
- `POST /api/graphs` — Create a new graph file (body: `name`, `graph`, optional `rhinoFileBase64`, `rhinoFileName`)
- `GET /api/graphs/[id]` — Get one graph file
- `PATCH /api/graphs/[id]` — Update name, graph, or Rhino attachment
- `DELETE /api/graphs/[id]` — Delete a graph file
- `GET /api/graphs/[id]/rhino` — Download the attached Rhino file

## Project structure (high level)

```
src/
├── app/           # Next.js app router (page, layout, api routes)
├── components/    # GraphViewer, MetadataStylePanel, NodeDetailPanel, UI
├── lib/           # store (Turso CRUD), db client, metadata helpers, column-floor-test
├── store/         # Zustand use-graph-store
└── types/         # graph.ts (GraphNode, GraphLink, GraphData, GraphFile, API payloads)
```
