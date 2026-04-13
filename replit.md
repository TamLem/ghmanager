# Workspace

## Overview

GitHub Profile & Repository Manager — a full-stack web app that lets users connect their GitHub account via Personal Access Token (PAT) and manage their profile and repositories with one-click actions.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM (provisioned but not used for MVP — GitHub data is fetched live)
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **GitHub API**: @octokit/rest
- **Sessions**: express-session (server-side, cookie-based)

## Artifacts

- `artifacts/api-server` — Express 5 API server (port via PORT env var, preview path `/api`)
- `artifacts/github-manager` — React + Vite frontend (preview path `/`)

## Authentication Flow

Users connect their GitHub account directly within the app using a Personal Access Token (PAT). The Replit GitHub OAuth connector was intentionally not used — auth is set up from within the app itself, not through an external flow. The PAT is validated with GitHub's API and stored securely in a server-side session (httpOnly cookie).

- POST `/api/github/auth/connect` — accepts `{ token }`, validates with GitHub API, stores in session
- POST `/api/github/auth/disconnect` — clears session token  
- GET `/api/github/auth/status` — returns `{ authenticated, login, avatarUrl }`

Required PAT scopes: `repo`, `user`

> Note: The Replit GitHub connector (connector:ccfg_github_01K4B9XD3VRVD2F99YM91YTCAF) was dismissed by the user — in-app PAT setup is the intended design.

## API Endpoints

All under `/api/github/`:
- `GET /auth/status` — auth check
- `POST /auth/connect` — connect with PAT
- `POST /auth/disconnect` — disconnect
- `GET /profile` — get authenticated user's profile
- `PATCH /profile` — update profile (name, bio, location, blog, twitterUsername, company)
- `GET /repos` — list all repos (supports sort, direction, per_page, page)
- `POST /repos` — create a new repo
- `PATCH /repos/:owner/:repo` — update repo settings (visibility, archive, hasIssues, hasWiki, hasProjects)
- `GET /stats` — aggregated stats (total stars, forks, language breakdown, most starred repo)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/api-server run dev` — run API server locally
- `pnpm --filter @workspace/github-manager run dev` — run frontend locally

## Environment Variables

- `SESSION_SECRET` — secret for express-session (set as a secret in Replit)
- `PORT` — assigned automatically per artifact
- `BASE_PATH` — assigned automatically per artifact (frontend)

## Future Extensions

The architecture is designed for easy additions:
- Bulk repo actions (batch update visibility, topics)
- Repository topics management
- GitHub Actions workflow management
- Branch protection rules
- Organization repositories
- Webhook management

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
