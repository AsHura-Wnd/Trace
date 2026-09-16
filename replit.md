# Trace

AI-powered collaborative memory system for teams — capture discussions, decisions, and notes; retrieve them instantly with AI Q&A and insights.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/trace run dev` — run the frontend (port assigned via $PORT)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React 19 + Vite, Tailwind CSS v4, shadcn/ui, wouter routing, TanStack Query
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec) — generates React Query hooks + Zod schemas
- AI: OpenAI gpt-5.1 via `@workspace/integrations-openai-ai-server`
- Build: esbuild (CJS bundle for API), Vite (frontend)

## Where things live

- `lib/api-spec/openapi.yaml` — source of truth for API contract
- `lib/api-client-react/src/generated/` — generated React Query hooks (do not edit)
- `lib/api-zod/src/generated/` — generated Zod schemas (do not edit)
- `lib/db/src/schema/` — Drizzle ORM schema (projects, memories, tasks, conversations, messages)
- `artifacts/api-server/src/routes/` — Express route handlers (projects, memories, tasks, ai)
- `artifacts/trace/src/pages/` — React pages (dashboard, project)
- `artifacts/trace/src/components/` — Shared UI components

## Architecture decisions

- **OpenAPI-first**: All API changes start in `openapi.yaml`, then `codegen` regenerates hooks/schemas.
- **TS2308 fix**: `lib/api-zod/src/index.ts` uses `export * from "./generated/api"` + explicit `export type { ... }` from `./generated/types` excluding `ListMemoriesParams`, `ListTasksParams`, `SearchProjectMemoriesParams` (collide as both Zod schemas and TS types).
- **AI model**: `gpt-5.1` — note this model does NOT support the `temperature` parameter.
- **Search**: Keyword/substring search for MVP. Semantic search with pgvector planned for v2.
- **Memory deletion**: Hard deletion (`DELETE FROM memories` returning 204). Soft-delete and memory versioning are deferred to v2.
- **Conversations & Messages schema**: The database schema defines `conversations` and `messages` tables prepared as infrastructure for future persistent chat. Current MVP Ask AI maintains conversation history in client-side React component state.
- **Screenshot type**: The `screenshot` memory type is recognized in the OpenAPI schema, database, and badge components, but binary image upload/storage is deferred to a future phase (text-based content capture only for MVP).
- **Project Isolation / Scoping**: All project-scoped memory and task endpoints enforce `resource.projectId === params.projectId` at the SQL level, returning 404 for cross-project access.
- **AI Task Extraction**: Strips markdown code fences, validates structure with Zod, and performs a single atomic batch insert.

## Product

- **Dashboard**: View and manage all projects. Create new ones.
- **Project workspace**: Tabbed interface with Memories, Tasks, Ask AI, Insights, and Search tabs.
  - **Memories**: Capture discussions, decisions, links, notes. Type badges. AI summarize or extract tasks from any memory.
  - **Tasks**: CRUD task list with status (open / in_progress / done). Filter by status. AI-extracted tasks land here.
  - **Ask AI**: Conversational Q&A grounded in project memory. Cites relevant memory IDs.
  - **Insights**: AI-generated project overview, key decisions, action items, and risks/blockers.
  - **Search**: Keyword search across all project memories.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- `gpt-5.1` does NOT accept `temperature` parameter — do not add it to OpenAI calls.
- Run `pnpm --filter @workspace/api-spec run codegen` after any OpenAPI spec change.
- Do not run `pnpm dev` at workspace root — use workflow restart or `pnpm --filter` commands.
- Seeded data: 2 projects, 9 memories, 10 tasks pre-loaded for development.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
- OpenAPI spec: `.local/skills/pnpm-workspace/references/openapi.md`
- DB patterns: `.local/skills/pnpm-workspace/references/db.md`
- Server patterns: `.local/skills/pnpm-workspace/references/server.md`
