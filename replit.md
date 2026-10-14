# Land Record Intelligence System

An officer workspace for creating land acquisition cases, storing source documents securely, and preparing records for later verification phases.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)
- Auth: Replit-managed Clerk with browser session cookies
- File storage: Replit App Storage with private object paths and direct presigned uploads

## Where things live

- `artifacts/land-record-intelligence/src/` — officer-facing React/Vite application and institutional theme
- `artifacts/api-server/src/routes/` — REST route handlers
- `lib/api-spec/openapi.yaml` — source of truth for API contracts
- `lib/db/src/schema/` — Drizzle tables for profiles, cases, and documents
- `artifacts/api-server/src/lib/storage.ts` — private object storage adapter
- `artifacts/land-record-intelligence/public/logo.svg` — branded auth/workspace mark

## Architecture decisions

- Clerk owns registration, email/password sign-in, sessions, and logout; protected API routes validate the Clerk session server-side.
- Document bytes go directly to private App Storage through presigned URLs; PostgreSQL stores only metadata and object paths.
- Phase 1 keeps processing, extraction, reconciliation, verification, and audit surfaces explicitly inactive rather than simulating results.
- The OpenAPI document remains the contract boundary between the shared API server and generated frontend hooks.

## Product

- Public overview and branded officer sign-in/sign-up
- Database-backed dashboard KPIs and recent activity
- Searchable case register and draft case creation
- Case workspace with multi-file PDF/JPG/JPEG/PNG upload, serial numbering, document metadata, and deletion
- Honest placeholders for records and audit trail until later processing phases

## User preferences

No additional preferences recorded.

## Gotchas

- After changing `lib/api-spec/openapi.yaml`, run `pnpm --filter @workspace/api-spec run codegen`.
- The browser uses Clerk cookies; do not add bearer-token handling to this web app.
- Uploaded objects are private and must be accessed through authenticated API routes.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
