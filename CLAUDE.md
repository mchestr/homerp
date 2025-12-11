# HomERP

Home inventory system with AI-powered item classification for hobbyists.

## Architecture

- **Backend:** FastAPI (Python 3.12, async, uv)
- **Frontend:** Next.js 15 (React, Tailwind CSS, shadcn/ui)
- **Database:** PostgreSQL 16 with Row-Level Security (RLS) for multi-tenancy
- **AI:** OpenAI GPT-4 Vision for image classification
- **Auth:** Google OAuth
- **Billing:** Stripe (credit-based system for AI features)
- **Task Runner:** mise

## Project Structure

```
homerp/
├── mise.toml          # Task runner configuration
├── docker-compose.yml # Development environment
├── backend/           # FastAPI backend
│   ├── src/           # Source code
│   │   ├── auth/      # OAuth + JWT authentication
│   │   ├── users/     # User management
│   │   ├── items/     # Core inventory items
│   │   ├── categories/# Item categories
│   │   ├── locations/ # Storage locations
│   │   ├── images/    # Image upload + storage
│   │   ├── ai/        # OpenAI integration
│   │   ├── billing/   # Stripe billing + credits
│   │   └── common/    # Shared utilities
│   ├── alembic/       # Database migrations
│   └── tests/         # pytest tests
├── frontend/          # Next.js frontend
│   └── src/
│       ├── app/       # App Router pages
│       ├── components/# React components
│       │   └── ui/    # shadcn/ui components
│       └── lib/
│           └── api/   # Generated OpenAPI client
```

## Development

### Prerequisites
- [mise](https://mise.jdx.dev/) - Tool version manager & task runner
- Docker & Docker Compose

### Quick Start
```bash
# Install tools (node, python, uv) and dependencies
mise install
mise run install

# Start all services (PostgreSQL, backend, frontend)
mise run dev
```

### Common Tasks (mise)

```bash
# List all available tasks
mise tasks

# Development
mise run dev              # Start all services with Docker
mise run dev:backend      # Start backend only (no Docker)
mise run dev:frontend     # Start frontend only (no Docker)

# Install dependencies
mise run install          # Install all dependencies
mise run install:backend  # Backend only
mise run install:frontend # Frontend only

# Build
mise run build            # Build all Docker images
mise run build:backend    # Backend only
mise run build:frontend   # Frontend only

# Code quality
mise run lint             # Lint all code
mise run lint:backend     # Backend only
mise run lint:frontend    # Frontend only
mise run format           # Format all code
mise run format:backend   # Backend only
mise run format:frontend  # Frontend only

# Testing
mise run test             # Run all tests
mise run test:backend     # Backend tests only

# Database
mise run db:migrate       # Run migrations
mise run db:migration "description"  # Create new migration

# API
mise run api:generate     # Regenerate frontend API client

# Cleanup
mise run clean            # Remove build artifacts
```

### Manual Commands (without mise)

**Backend:**
```bash
cd backend
uv sync                          # Install dependencies
uv run pytest                    # Run tests
uv run ruff check .              # Lint code
uv run ruff format .             # Format code
uv run alembic upgrade head      # Run migrations
uv run alembic revision --autogenerate -m "description"  # Create migration
```

**Frontend:**
```bash
cd frontend
pnpm install                     # Install dependencies
pnpm dev                         # Start dev server
pnpm build                       # Production build
pnpm lint                        # Lint code
pnpm generate-api                # Regenerate OpenAPI client from backend
```

## Key Patterns

### Multi-tenancy
- All user data is isolated via PostgreSQL Row-Level Security (RLS)
- Each request sets `app.current_user_id` session variable
- RLS policies filter all queries by `user_id`

### Async Everything
- All database operations use async SQLAlchemy
- All API endpoints are async
- Use `asyncpg` driver for PostgreSQL

### Configuration
- `pydantic-settings` for type-safe configuration
- All settings can be overridden via environment variables
- `.env` file for local development

### API Client
- Frontend uses auto-generated TypeScript client from OpenAPI spec
- Run `mise run api:generate` after backend API changes
- Provides full type safety between frontend and backend

## Environment Variables

### Backend
```env
DATABASE_URL=postgresql+asyncpg://homerp:homerp@localhost:5432/homerp
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
JWT_SECRET=your-jwt-secret
OPENAI_API_KEY=your-openai-api-key
STRIPE_SECRET_KEY=sk_test_your-stripe-secret-key
STRIPE_PUBLISHABLE_KEY=pk_test_your-stripe-publishable-key
STRIPE_WEBHOOK_SECRET=whsec_your-stripe-webhook-secret
UPLOAD_DIR=./uploads
```

### Frontend
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## Database Schema

Core tables:
- `users` - OAuth users (tenant root) with billing fields
- `items` - Inventory items with JSONB attributes
- `categories` - Item categories
- `locations` - Storage locations (room, shelf, bin)
- `images` - Item photos with AI classification results
- `credit_packs` - Purchasable credit bundles
- `credit_transactions` - Audit log for credit changes

## API Endpoints

- `POST /api/v1/auth/google` - Initiate OAuth
- `GET /api/v1/auth/callback/google` - OAuth callback
- `GET /api/v1/items` - List items (paginated)
- `POST /api/v1/items` - Create item
- `POST /api/v1/images/upload` - Upload image
- `POST /api/v1/images/classify` - AI classification (requires credits)
- `GET /api/v1/billing/balance` - Get credit balance
- `GET /api/v1/billing/packs` - List credit packs
- `POST /api/v1/billing/checkout` - Create Stripe checkout
- `POST /api/v1/billing/portal` - Stripe customer portal
- `POST /api/v1/billing/webhook` - Stripe webhooks

## Billing System

### Credit Model
- **Free tier:** 5 AI credits per month (resets on signup anniversary)
- **Credit packs:** One-time purchases (25 for $3, 100 for $10, 500 for $40)
- **Credits never expire** once purchased
- **Refunds:** Available if purchased credits are unused

### Stripe Setup
1. Create a Stripe account and get API keys
2. Create a product "HomERP AI Credits" with three prices (one-time)
3. Update `credit_packs` table with real Stripe price IDs
4. Configure webhook endpoint: `POST /api/v1/billing/webhook`
5. Enable webhook events: `checkout.session.completed`, `charge.refunded`

## Guidelines
- always use the most idiomatic and standard way to solve issues, do not invent hacks or workarounds.
- never use browser alerts always use our common modal components
- all frontend strings hould be translated using the i18n library
- always run lint/build/docker build before pushing remotely to ensure the gitlab ci workflows will pass

## Playwright E2E Testing

### Element Selection Best Practices

Prefer `data-testid` attributes for selecting elements in tests. **If an element doesn't have a `data-testid`, add one to the component.**

```tsx
// Component
<Button data-testid="add-item-button">Add Item</Button>

// Test
await page.getByTestId("add-item-button").click();
```

### Route Mocking Best Practices

Playwright routes use **LIFO (Last In, First Out)** matching - the last registered route has highest priority.

**Key rules for `frontend/e2e/mocks/api-handlers.ts`:**

1. **Register specific routes AFTER generic ones** - e.g., `/categories/tree` must be registered after `/categories/[id]`

2. **Use `route.fallback()` not `route.continue()`** - When a generic route needs to skip to a more specific one:
   - `route.continue()` sends the request to the network (bad)
   - `route.fallback()` passes to the next matching route handler (good)

3. **Regex routes like `/[^/]+$/` match "tree"** - The pattern `/\/api\/v1\/categories\/[^/]+$/` matches both `/categories/cat-123` AND `/categories/tree`. Add explicit checks:
   ```typescript
   if (catId === "tree") {
     await route.fallback();
     return;
   }
   ```

4. **Route registration order in api-handlers.ts:**
   ```typescript
   // 1. Base endpoint (exact match with regex)
   await page.route(/\/api\/v1\/categories$/, ...)

   // 2. Generic ID pattern (matches /categories/*)
   await page.route(/\/api\/v1\/categories\/[^/]+$/, ...)

   // 3. Specific sub-routes LAST (highest priority)
   await page.route("**/api/v1/categories/tree", ...)