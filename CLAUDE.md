# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Related Repositories

The frontend repository is located at `../../hello-dreams-ai-frontend` relative to this directory (`C:\Users\BBPC\Documents\Projects\hello-dreams-ai-frontend`).

## Commands

```bash
# Development
npm run start:dev          # Watch mode
npm run start:debug        # Debug mode with inspector

# Build
npm run build              # Compile TypeScript
npm run build:with-migrations

# Testing
npm run test               # Unit tests (Jest)
npm run test:watch
npm run test:cov
npm run test:e2e           # Config: test/jest-e2e.json
# Run a single test file:
npx jest src/path/to/file.spec.ts

# Linting & formatting
npm run lint               # ESLint with auto-fix
npm run format             # Prettier

# Database
npm run migration:run      # Run pending migrations (dev)
npm run migration:run:prod
npm run migration:generate # Generate migration from entity changes
npm run migration:reset
npm run db:check
```

## Architecture

NestJS modular monolith. TypeScript, PostgreSQL via TypeORM, Supabase for file storage, OpenAI as the primary AI provider with Gemini and HuggingFace as fallbacks.

### Module layout (`src/`)

| Module | Purpose |
|---|---|
| `auth/` | JWT (access + refresh tokens) + Google OAuth, Passport strategies |
| `users/` | User entity and management |
| `shared/` | Global providers: OpenAIService, VoiceService, EmbeddingService, SupabaseStorageService, ContextIndexerService, PromptInjectionGuardService |
| `credits/` | Credit system (CreditGuard enforces balance) |
| `payments/` | Paystack integration, subscriptions, webhooks |
| `resume-builder/` | Conversation → resume JSON generation |
| `career-profile/` | Career discovery conversations |
| `document-generator/` | Cover letters and personal statements |
| `persona-builder/` | Professional persona questionnaire |
| `linkedin-optimization/` | LinkedIn profile generation |
| `headshot-generator/` | AI headshot generation via Replicate |
| `admin/` | Dashboard stats, usage tracking, SSE real-time updates |
| `common/` | Shared decorators, filters, guards, middleware |
| `config/` | Environment validation (`env.validation.ts`) |

### Conversation pattern

Most AI features share the same flow: **create conversation → send messages → trigger generation**. Each such module has a Controller, Service, AiChatService (conversation turns), a generator service (final output), and TypeORM entities for the conversation and messages.

### Guard stack

- `JwtAuthGuard` — token validation on protected routes
- `RolesGuard` — role-based access (User, Admin, Superuser)
- `CreditGuard` — deducts credits before AI operations
- `ThrottlerGuard` — default 100 req/min, AI operations 10 req/hour

### Database

- TypeORM with `synchronize: false` — always use migrations, never enable sync
- Migrations live in `src/migrations/`
- Entities use UUID PKs and standard `createdAt`/`updatedAt` timestamps
- Connect via `DATABASE_URL` (Supabase string) or individual `DB_*` vars

### Key environment variables

```
JWT_SECRET
DATABASE_URL          # or DB_HOST/PORT/USERNAME/PASSWORD/NAME
OPENAI_API_KEY        # primary AI provider
GEMINI_API_KEY        # fallback
HUGGINGFACE_API_KEY   # fallback
REPLICATE_API_TOKEN   # headshot generation
PAYSTACK_SECRET_KEY
SUPABASE_URL
SUPABASE_ANON_KEY
CORS_ORIGIN           # comma-separated origins
```

### API conventions

- Swagger docs at `/api-docs`
- Paginated responses: `{ data: [], meta: { page, limit, total, totalPages, hasPrevious, hasNext } }`
- Validation pipe enforces `whitelist: true, forbidNonWhitelisted: true`
- Global exception filter standardizes error shape: `{ statusCode, message }`
