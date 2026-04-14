# GitHub Manager

A TypeScript monorepo for a **GitHub Profile & Repository Manager** web app.

This project lets users connect a GitHub account using a Personal Access Token (PAT), then view and manage profile/repository data from a React dashboard backed by an Express API.

## Features

- Connect/disconnect GitHub account with PAT authentication
- View authentication status and basic profile info
- Read and update GitHub profile fields
- List repositories with sorting + pagination
- Create repositories
- Update repository settings (visibility, archive, issues/wiki/projects flags)
- View aggregate repository stats (stars, forks, languages, top repo)
- Shared API contracts generated from OpenAPI (client + Zod types)

## Monorepo Structure

- `artifacts/api-server` — Express 5 API server
- `artifacts/github-manager` — React + Vite frontend
- `lib/api-spec` — OpenAPI spec + Orval codegen config
- `lib/api-client-react` — generated API client/hooks for frontend use
- `lib/api-zod` — generated Zod schemas/types used across packages
- `lib/db` — Drizzle schema/config scaffold
- `scripts` — workspace utility scripts

## Tech Stack

- **Runtime/Tooling:** Node.js, pnpm workspaces, TypeScript
- **Frontend:** React, Vite, TanStack Query, Radix UI, Tailwind ecosystem
- **Backend:** Express 5, Octokit REST API client, Pino logging
- **API Validation/Types:** OpenAPI + Orval + Zod
- **Data Layer:** PostgreSQL + Drizzle ORM (scaffolded for future expansion)

## Prerequisites

- Node.js 24+
- pnpm 10+
- A GitHub Personal Access Token with scopes:
  - `repo`
  - `user`

## Getting Started

```bash
pnpm install
```

### Run API server

```bash
pnpm --filter @workspace/api-server run dev
```

### Run frontend

```bash
pnpm --filter @workspace/github-manager run dev
```

The frontend is configured to call the API under `/api` (environment/platform routing may provide this automatically).

## Environment Variables

Set these for local/dev deployments:

- `SESSION_SECRET` — secret for server-side session/cookie protection
- `PORT` — API server port
- `BASE_PATH` — frontend base path (when required by host environment)

## API Overview

All API routes are prefixed with `/api/github`.

Auth:

- `GET /auth/status`
- `POST /auth/connect`
- `POST /auth/disconnect`

Profile:

- `GET /profile`
- `PATCH /profile`

Repositories:

- `GET /repos`
- `POST /repos`
- `PATCH /repos/:owner/:repo`

Stats:

- `GET /stats`

## Useful Workspace Commands

```bash
pnpm run typecheck
pnpm run build
pnpm --filter @workspace/api-spec run codegen
```

## Notes

- PAT auth is implemented in-app (not via external GitHub OAuth connector).
- GitHub data is fetched live for the MVP; DB pieces are scaffolded for future persisted features.

## License

MIT
