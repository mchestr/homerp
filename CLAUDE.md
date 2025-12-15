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
mise run build              # Build all Docker images
mise run build:backend      # Backend Docker image
mise run build:frontend     # Frontend Docker image
mise run build:frontend:local  # Frontend Next.js build (local)

# Code quality
mise run lint               # Lint all code
mise run lint:backend       # Backend only
mise run lint:backend:fix   # Backend lint + auto-fix
mise run lint:frontend      # Frontend only
mise run lint:frontend:fix  # Frontend lint + auto-fix
mise run format             # Format all code
mise run format:backend     # Backend only
mise run format:frontend    # Frontend only
mise run format:check       # Check formatting (CI)
mise run format:check:backend   # Backend format check
mise run format:check:frontend  # Frontend format check

# Testing
mise run test               # Run all tests (backend + frontend unit)
mise run test:backend       # Backend tests (pytest)
mise run test:backend:unit  # Backend unit tests only
mise run test:integration   # Backend integration tests
mise run test:frontend      # Frontend unit tests (vitest)
mise run test:frontend:watch  # Frontend unit tests (watch mode)
mise run test:e2e           # Frontend e2e tests (playwright)
mise run test:e2e:ui        # E2e tests with Playwright UI
mise run test:e2e:headed    # E2e tests in headed browser
mise run test:e2e:debug     # E2e tests in debug mode

# CI Checks (run before pushing)
mise run check              # Run ALL CI checks
mise run check:backend      # Backend CI checks only
mise run check:frontend     # Frontend CI checks only

# Database
mise run db:migrate       # Run migrations
mise run db:migration "description"  # Create new migration
mise run db:reset         # Reset database (drop + migrate)

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
pnpm lint:fix                    # Lint and auto-fix
pnpm format                      # Format code
pnpm format:check                # Check formatting (CI)
pnpm test                        # Run unit tests (vitest)
pnpm test:e2e                    # Run e2e tests (playwright)
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

### State Management
- **No Redux/Zustand** - uses React Context + TanStack React Query
- Global state: React Context (`AuthContext`, `InventoryContext`, `ThemeContext`)
- Server state: TanStack React Query with 1-minute stale time
- Local state: React `useState`
- Persistent preferences: `useLocalStorage` hook

### Backend Module Structure
Each feature module follows this pattern:
```
backend/src/{module}/
├── models.py      # SQLAlchemy ORM models
├── schemas.py     # Pydantic request/response schemas
├── router.py      # FastAPI endpoints
├── service.py     # Business logic (optional)
└── repository.py  # Database operations (optional)
```
- **Repository pattern** - Data access with RLS filtering (items, categories, locations)
- **Service pattern** - Business logic, external APIs (billing, AI, auth)

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

## API Client & Data Fetching

### Generated vs Hand-Written Client
- Auto-generated client in `lib/api/` from OpenAPI spec (`pnpm generate-api`)
- Hand-written wrapper functions in `lib/api/api-client.ts`
- Use hand-written functions (`itemsApi.list()`, `categoriesApi.tree()`) for most operations

### React Query Patterns
```tsx
// Queries (reading data)
const { data, isLoading } = useQuery({
  queryKey: ["items", { page, categoryId }],
  queryFn: () => itemsApi.list({ page, category_id: categoryId }),
});

// Mutations (writing data)
const mutation = useMutation({
  mutationFn: (data) => itemsApi.create(data),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["items"] });
  },
});
```

### Query Key Conventions
- `["items"]` - All items
- `["items", { page, categoryId }]` - Filtered/paginated items
- `["categories", "tree"]` - Category tree structure
- `["item", itemId]` - Single item by ID

### API Error Handling
```tsx
try {
  await imagesApi.classify([imageId]);
} catch (err) {
  if (err?.status === 402) {
    showInsufficientCreditsModal();  // Special handling for credits
  } else {
    toast({ title: "Error", description: t("errorMessage"), variant: "destructive" });
  }
}
```

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

## UI Component Patterns

### Modal/Dialog Components
- **Dialog** (`@/components/ui/dialog`) - General purpose modals for forms and content
- **AlertDialog** (`@/components/ui/alert-dialog`) - Destructive action confirmations (delete, remove)
- **ConfirmModal** (`@/components/ui/confirm-modal`) - Promise-based confirmations with loading state

### Hook-Based Modal Pattern
Feature-specific modals use a hook pattern returning the modal component and control functions:
```tsx
const { confirm, setIsLoading, ConfirmModal } = useConfirmModal();

const handleDelete = async () => {
  const confirmed = await confirm({
    title: "Delete Item?",
    message: "This cannot be undone.",
    variant: "danger"  // "danger" | "warning" | "default"
  });
  if (confirmed) {
    setIsLoading(true);
    await deleteItem();
    setIsLoading(false);
  }
};

// In render - always include the modal component
return <><Button onClick={handleDelete}>Delete</Button><ConfirmModal /></>;
```

Other hook-based modals: `useInsufficientCreditsModal()`, `useQRCodeModal()`, `useLabelPrintModal()`

### Toast Notifications
Use `useToast` hook for user feedback (not browser alerts):
```tsx
const { toast } = useToast();

// Success
toast({ title: t("saved"), description: t("itemSaved") });

// Error
toast({ title: t("error"), description: t("saveFailed"), variant: "destructive" });
```

### Error Display
- Use toast notifications for operation errors (variant: "destructive")
- Handle 402 status specially with `useInsufficientCreditsModal()`
- Inline error alerts use: `border-destructive/50 bg-destructive/10 text-destructive`

## Form Handling Patterns

### Form State Management
- Use vanilla React `useState` for form state (no React Hook Form/Formik)
- No validation library - use HTML5 `required` attribute and manual checks
- Use TanStack React Query `useMutation` for form submission

### Form Submission Pattern
```tsx
const createMutation = useMutation({
  mutationFn: (data) => itemsApi.create(data),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["items"] });
    router.push("/items");
  },
});

const handleSubmit = (e: React.FormEvent) => {
  e.preventDefault();
  createMutation.mutate(formData);
};

// Button with loading state
<Button disabled={createMutation.isPending || !formData.name}>
  {createMutation.isPending ? "Creating..." : "Create"}
</Button>
```

### Required Field Indicators
Mark required fields with red asterisk:
```tsx
<Label>{t("name")} <span className="text-destructive">*</span></Label>
```

## Guidelines
- always use the most idiomatic and standard way to solve issues, do not invent hacks or workarounds.
- never use browser alerts always use our common modal components (see UI Component Patterns above)
- all frontend strings should be translated using the i18n library (see i18n section below)
- always run the pre-push checks below before pushing remotely to ensure the GitHub Actions workflows will pass

### File Naming Conventions

**Frontend:**
| Type | Convention | Example |
|------|------------|---------|
| Components | kebab-case.tsx | `image-gallery.tsx`, `confirm-modal.tsx` |
| Hooks | use-kebab-case.ts | `use-local-storage.ts`, `use-toast.tsx` |
| Context | kebab-case-context.tsx | `auth-context.tsx`, `inventory-context.tsx` |
| Props/Types | PascalCase + Props | `ImageGalleryProps`, `AuthState` |

**Backend:**
| Type | Convention | Example |
|------|------------|---------|
| Modules | snake_case.py | `router.py`, `service.py`, `models.py` |
| Classes | PascalCase | `ItemRepository`, `CreditService` |
| Functions | snake_case | `get_current_user`, `create_item` |

**Directory Organization:**
- `components/ui/` - Shared shadcn/ui components
- `components/{feature}/` - Feature-specific components (items, billing, locations)
- `hooks/` - Custom React hooks
- `context/` - React Context providers

### Internationalization (i18n)

**Library:** `next-intl`

**Translation files:** `frontend/messages/{locale}.json` (en, de, es, fr, pt-BR, ja)

**Usage pattern:**
```tsx
import { useTranslations } from "next-intl";

function Component() {
  const t = useTranslations("items");       // Scoped to "items.*" keys
  const tCommon = useTranslations("common"); // Common strings
  return <h1>{t("title")}</h1>;
}
```

**Adding new translation keys:**
1. Add key to `messages/en.json` first (authoritative source)
2. Add translations to other locale files (missing keys fall back to English)
3. Use parameterized strings for dynamic values: `t("count", { count: 10 })`

### Commit Message Convention
Use [Conventional Commits](https://www.conventionalcommits.org/) format:
- `feat:` - New features
- `fix:` - Bug fixes
- `chore:` - Maintenance tasks (dependencies, configs)
- `refactor:` - Code improvements without behavior change
- `docs:` - Documentation updates
- `test:` - Test additions or fixes

Examples:
```
feat(items): add bulk delete functionality
fix(gridfinity): correct collision detection for overlapping bins
chore: update dependencies
```

### High-Churn Files
These files change frequently and may need regeneration or special attention:

| File | Why It Changes | Action |
|------|---------------|--------|
| `frontend/messages/en.json` | New UI strings | Add translations to all locale files |
| `frontend/src/lib/api/api-client.ts` | Backend API changes | Run `mise run api:generate` after backend changes |
| `frontend/e2e/mocks/api-handlers.ts` | API changes | Update mocks when API responses change |

### Known Complexity Areas
These features have historically been sources of bugs and require extra care:

**Gridfinity Storage System:**
- State updates for bin positioning and resizing
- Collision detection between bins
- Drag-and-drop interactions
- Test with multiple bins and edge cases

**Collaboration/Sharing:**
- Viewer vs owner permissions
- Shared inventory image access
- RLS policy interactions for shared items
- Test with both owner and viewer accounts

**E2E Tests:**
- Use stable selectors (prefer `data-testid`)
- Add proper wait strategies for async operations
- Mock API responses consistently
- See "Playwright E2E Testing" section for best practices

### Keeping mise.toml in Sync
When adding or modifying npm scripts in `frontend/package.json` or new commands in the backend:
1. Update `mise.toml` with corresponding tasks
2. Update the "Common Tasks (mise)" section in this file
3. Ensure task names follow existing conventions (e.g., `category:subcategory`)
4. Run `mise tasks` to verify the new tasks are listed correctly

## Pre-Push Checklist

**IMPORTANT:** Before pushing any changes, run these commands to match what CI checks:

### Quickest Method (Recommended)
```bash
# Run all CI checks at once
mise run check

# Or run checks for just one part
mise run check:backend   # Backend only
mise run check:frontend  # Frontend only
```

### Backend (from `backend/` directory)
```bash
# Lint check (catches code issues)
uv run ruff check .

# Format check (catches formatting issues) - CI runs this too!
uv run ruff format --check .

# If format check fails, fix with:
uv run ruff format .

# Run tests
uv run pytest
```

### Frontend (from `frontend/` directory)
```bash
# ESLint check
pnpm lint

# Prettier format check - CI runs this too!
pnpm format:check

# If format check fails, fix with:
pnpm format

# Build check
pnpm build
```

### Quick All-in-One Commands
```bash
# Backend: lint + format check + tests
cd backend && uv run ruff check . && uv run ruff format --check . && uv run pytest

# Frontend: lint + format check + build
cd frontend && pnpm lint && pnpm format:check && pnpm build
```

### Common CI Failures and Fixes
| CI Check | Command to Verify | Fix Command |
|----------|------------------|-------------|
| Backend Lint | `uv run ruff check .` | `uv run ruff check --fix .` |
| Backend Format | `uv run ruff format --check .` | `uv run ruff format .` |
| Backend Tests | `uv run pytest` | Fix failing tests |
| Frontend Lint | `pnpm lint` | `pnpm lint:fix` |
| Frontend Format | `pnpm format:check` | `pnpm format` |
| Frontend Build | `pnpm build` | Fix build errors |

## Testing Conventions

### HTTP Status Codes for Authentication Tests
When testing authentication requirements, use the correct HTTP status codes:
- **401 Unauthorized**: Request lacks valid authentication credentials (no token, invalid token)
- **403 Forbidden**: Request is authenticated but user lacks permission for the resource

```python
# Correct - unauthenticated requests return 401
async def test_endpoint_requires_auth(self, unauthenticated_client: AsyncClient):
    response = await unauthenticated_client.get("/api/v1/some-endpoint")
    assert response.status_code == 401  # NOT 403

# 403 is for authenticated users who lack permission
async def test_non_admin_cannot_access_admin_endpoint(self, client: AsyncClient):
    response = await client.get("/api/v1/admin/users")
    assert response.status_code == 403  # User is authenticated but not admin
```

### Follow Existing Patterns
Before writing new tests, check existing tests for patterns:
```bash
# Find how other tests handle unauthenticated requests
grep -r "unauthenticated_client" backend/tests/ | grep "status_code"

# Find test patterns for a specific module
ls backend/tests/items/  # See what test files exist
```

## Timezone Handling

All datetime values must be timezone-aware (UTC) throughout the application:

### Backend
- **Models:** Always use `DateTime(timezone=True)` for datetime columns
- **Python code:** Use `datetime.now(UTC)` instead of deprecated `datetime.utcnow()`
- **Database:** All datetime columns are `TIMESTAMP WITH TIME ZONE`
- **Never** use `.replace(tzinfo=None)` to strip timezone info

```python
# Correct
from datetime import UTC, datetime
now = datetime.now(UTC)

# Wrong - deprecated and returns naive datetime
now = datetime.utcnow()
```

### Frontend
- Use shared utilities from `@/lib/utils` for date formatting:
  - `formatDate()` - Standard format (Dec 12, 2024)
  - `formatDateShort()` - Short format (Dec 12)
  - `formatDateTime()` - With time
  - `formatDateTimeWithSeconds()` - Full timestamp
  - `formatRelativeTime()` - Relative (5m ago)
- JavaScript's `new Date()` automatically converts UTC to local timezone

## Agent Usage

Use specialized agents for efficient task completion:

### Explore Agent
Use for codebase exploration and research:
- Finding files by pattern (e.g., "src/components/**/*.tsx")
- Searching code for keywords (e.g., "API endpoints")
- Understanding codebase structure and patterns
- Answering questions about the codebase

```
Task tool with subagent_type="Explore"
```

### Plan Agent
Use for designing implementation strategies:
- Planning multi-step feature implementations
- Identifying critical files and dependencies
- Considering architectural trade-offs
- Creating step-by-step implementation plans

```
Task tool with subagent_type="Plan"
```

### Playwright E2E Architect Agent
Use for all Playwright end-to-end testing work:
- Writing new e2e test files
- Refactoring existing tests for stability/speed
- Adding `data-testid` attributes to React components
- Investigating flaky tests
- Optimizing test execution time

**IMPORTANT:** Use this agent proactively after implementing new UI features that need e2e coverage.

```
Task tool with subagent_type="playwright-e2e-architect"
```

### Claude Code Guide Agent
Use for questions about:
- Claude Code CLI features, hooks, slash commands, MCP servers
- Claude Agent SDK for building custom agents
- Claude API usage and Anthropic SDK

```
Task tool with subagent_type="claude-code-guide"
```

### General Purpose Agent
Use for complex, multi-step research tasks when you're not confident about finding the right match quickly.

```
Task tool with subagent_type="general-purpose"
```

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