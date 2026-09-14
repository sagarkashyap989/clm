# Contract Management System (CML)

Production-oriented contract management platform. **Phase 1** delivers monorepo setup, authentication, organizations, and RBAC.

## Stack

- **Web:** React, TypeScript, Vite, Tailwind, TanStack Query, Zustand, React Hook Form, Zod
- **API:** Node.js, Express, TypeScript, MongoDB/Mongoose, JWT HttpOnly cookies, bcrypt
- **Shared:** Zod schemas and role enums (`@cml/shared`)
- **Infra (Docker):** MongoDB, Redis, Mailhog, MinIO (MinIO unused until Phase 2)

## Quick start

```bash
# Install
pnpm install

# Environment
cp .env.example .env

# Infrastructure (requires Docker Desktop running)
docker compose up -d

# Build shared package, then run all apps
pnpm --filter @cml/shared build
pnpm dev
```

- Web: http://localhost:5173
- API: http://localhost:5000
- Mailhog UI: http://localhost:8025

If `docker compose` fails with a pipe/engine error, start **Docker Desktop** first, then retry.

## Scripts

| Command | Description |
| --- | --- |
| `pnpm dev` | Start API + web in watch mode |
| `pnpm build` | Build all packages |
| `pnpm lint` | Typecheck all packages |
| `pnpm test` | Run API tests |

## Phase 1 capabilities

- Register (create org) / login / logout / refresh
- Email verification + forgot/reset password (via Mailhog)
- Organization settings (admin)
- Invite members by email + role
- Accept invitation flow
- Member role updates / removals (admin)
- Profile name + change password
- Audit logs for key auth/org actions

## Phase 1 out of scope

Contracts, uploads, editor, chat, sharing, notifications beyond invite/password emails, S3/MinIO usage.
