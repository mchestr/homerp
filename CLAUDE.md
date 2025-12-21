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
- Frontend uses auto-generated TypeScript client from OpenAPI spec (@hey-api/openapi-ts)
- Generated SDK in `lib/api/sdk.gen.ts` and types in `lib/api/types.gen.ts`
- Ergonomic wrapper functions in `lib/api/api.ts` (e.g., `itemsApi.list()`, `categoriesApi.tree()`)
- Run `mise run api:generate` after backend API changes
- Always use wrapper functions from `api.ts`, never call SDK functions directly
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

# Redis (REQUIRED in production for distributed rate limiting)
# Development/staging/test: Optional - uses in-memory storage if not set
# Production: REQUIRED - app will fail to start without this
REDIS_URL=redis://localhost:6379
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
- `POST /api/v1/ai/sessions` - Create AI chat session
- `GET /api/v1/ai/sessions` - List AI chat sessions
- `GET /api/v1/ai/sessions/{id}` - Get session with messages
- `PATCH /api/v1/ai/sessions/{id}` - Update session title
- `DELETE /api/v1/ai/sessions/{id}` - Archive/delete session
- `POST /api/v1/ai/chat` - Tool-enabled AI chat (requires credits)

## API Client & Data Fetching

### Generated SDK with Wrapper Functions
- Auto-generated SDK from OpenAPI spec using @hey-api/openapi-ts (`pnpm generate-api`)
- Generated files: `lib/api/sdk.gen.ts` (functions) and `lib/api/types.gen.ts` (types)
- Wrapper module: `lib/api/api.ts` provides ergonomic API (e.g., `itemsApi.list()`)
- **Always use wrapper functions from `api.ts`** - never import from `sdk.gen.ts` directly
- Client configuration in `lib/api/client-setup.ts` (base URL, auth headers, inventory context)

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
- **Signup credits:** One-time bonus credits for new users (configurable via Admin > Billing Settings, default: 5)
- **Credit packs:** One-time purchases (25 for $3, 100 for $10, 500 for $40)
- **Credits never expire** - all credits (signup bonus + purchased) are permanent
- **Refunds:** Available if purchased credits are unused

### Admin Billing Settings
Admins can configure billing settings at `/admin/billing-settings`:
- `signup_credits` - Number of credits granted to new users on signup (default: 5)

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

## Mobile-First UX Design

HomERP follows a **mobile-first design approach**. All UI components and pages must be optimized for mobile devices before scaling up to larger screens.

### Core Principles

1. **Design for mobile first, enhance for desktop** - Start with mobile constraints, add complexity for larger screens
2. **Touch-friendly targets** - All interactive elements must meet Apple's 44px minimum touch target (use `min-h-[40px]` or `min-h-[44px]`)
3. **Thumb-zone optimization** - Place primary actions within easy thumb reach on mobile
4. **Graceful degradation** - Hide non-essential labels/text on mobile, show on larger screens

### Responsive Design Patterns

#### Typography & Spacing
```tsx
// Headings - scale up on larger screens
<h1 className="text-xl font-bold md:text-2xl lg:text-3xl">

// Body text - smaller on mobile
<p className="text-sm md:text-base">

// Spacing - tighter on mobile, looser on larger screens
<div className="space-y-4 pb-4 sm:space-y-6 md:space-y-8">
<div className="gap-3 sm:gap-4 lg:gap-6">
```

#### Container Padding
```tsx
// Reduce padding on mobile
<div className="p-4 sm:p-5 md:p-6">
<div className="px-4 py-3 sm:px-5 sm:py-4">
```

#### Button Text & Icons
```tsx
// Hide labels on mobile, show on larger screens
<Button>
  <Plus className="mr-2 h-4 w-4" />
  <span className="hidden sm:inline">Add Item</span>
  <span className="sm:hidden">Add</span>
</Button>

// Or icon-only on mobile
<Button>
  <Search className="h-4 w-4 sm:hidden" />
  <span className="hidden sm:inline">Search</span>
</Button>
```

#### Grid Layouts
```tsx
// Stack on mobile, grid on larger screens
<div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">

// Single column mobile, 2+ columns desktop
<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">

// Flex column on mobile, grid on desktop
<div className="flex flex-col gap-4 lg:grid lg:grid-cols-2 lg:gap-6">
```

#### Flex Layouts
```tsx
// Stack buttons vertically on mobile
<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">

// Full-width buttons on mobile, auto width on desktop
<Button className="w-full sm:w-auto">
<Button className="flex-1 sm:flex-none">
```

### Tables & Mobile Scrolling

**CRITICAL ISSUE:** `overflow-x-auto` creates a scroll container that captures touch events on mobile, preventing vertical page scrolling. This is a common bug that breaks mobile UX.

**THE PROBLEM:**
- Most tables hide columns on mobile (using `hidden sm:table-cell`, etc.)
- On mobile, the remaining columns fit without horizontal scrolling
- But `overflow-x-auto` creates a scroll container anyway
- This scroll container blocks vertical page scrolling when touching the table area
- **User cannot scroll the page when touching the table!**

**THE SOLUTION:**
Only enable `overflow-x-auto` at the breakpoint where columns actually appear and might cause overflow.

#### Standard Table Pattern
```tsx
// ✅ CORRECT - No scroll container on mobile, enables at sm: when needed
<div className="rounded-lg border sm:overflow-x-auto">
  <table className="w-full">
    <thead className="bg-muted/50 border-b">
      <tr>
        <th className="px-4 py-3 text-left">Name</th>
        <th className="hidden px-4 py-3 text-left sm:table-cell">Category</th>
        <th className="hidden px-4 py-3 text-left md:table-cell">Location</th>
        <th className="px-4 py-3 text-center">Quantity</th>
      </tr>
    </thead>
    {/* tbody */}
  </table>
</div>
```

#### Nested Table (inside cards)
```tsx
<div className="bg-card overflow-hidden rounded-xl border p-4 sm:p-6">
  <h2>Title</h2>
  <div className="sm:overflow-x-auto">
    <div className="inline-block min-w-full align-middle">
      <Table>
        {/* table content */}
      </Table>
    </div>
  </div>
</div>
```

#### Desktop-Only Tables
```tsx
// When table is hidden on mobile (has separate mobile card view)
<div className="bg-card hidden rounded-xl border md:block">
  <div className="overflow-x-auto">
    <table className="w-full">
      {/* table content */}
    </table>
  </div>
</div>
```

**No overflow prefix needed** since the entire table is `hidden` on mobile.

#### Anti-Patterns (DO NOT USE)

**❌ WRONG - Creates scroll container on mobile:**
```tsx
<div className="overflow-x-auto rounded-lg border">
  <table className="w-full">
```

**❌ WRONG - Custom touch handling:**
```tsx
<div
  className="overflow-x-auto"
  style={{ touchAction: "pan-x", WebkitOverflowScrolling: "touch" }}
>
```

**❌ WRONG - Negative margins with overflow toggles:**
```tsx
<div className="-mx-4 overflow-x-auto md:mx-0 md:overflow-x-visible">
```

**❌ WRONG - Fixed minimum width on mobile:**
```tsx
<table className="w-full min-w-[640px]">
```

#### Key Principles

1. **Match overflow to column visibility** - Add `overflow-x-auto` at the same breakpoint where you add columns (typically `sm:`)
2. **No custom touch handlers** - Browser handles scrolling naturally, don't use `touchAction` or `WebkitOverflowScrolling`
3. **No negative margins** - Keep it simple, don't try to extend tables to screen edges
4. **No fixed min-widths** - Let tables fit naturally on mobile
5. **Desktop-only exceptions** - Tables with `hidden md:block` can use `overflow-x-auto` directly since they never render on mobile

#### When Horizontal Scrolling IS Appropriate

- **Image galleries** - Intentional horizontal scrolling for photo thumbnails
- **Tag/chip lists** - Horizontal scrolling for overflow tags
- **Code blocks** - Preserve formatting with horizontal scroll

These use cases are fine with `overflow-x-auto` on mobile because:
- They're meant to scroll horizontally
- They don't span the full viewport height
- Users can still scroll the page vertically around them

### Mobile Navigation & Headers

#### Page Headers
```tsx
<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
  <div className="min-w-0">
    <h1 className="text-xl font-bold tracking-tight md:text-2xl lg:text-3xl">
      {t("title")}
    </h1>
    <p className="text-muted-foreground mt-0.5 text-sm md:mt-1">
      {t("subtitle")}
    </p>
  </div>
  <div className="flex gap-2">
    {/* Action buttons */}
  </div>
</div>
```

**Key patterns:**
- `min-w-0` prevents text overflow on mobile
- Stack header and actions vertically on mobile (flex-col)
- Smaller text sizes on mobile (text-xl → md:text-2xl → lg:text-3xl)
- Tighter spacing on mobile (mt-0.5 → md:mt-1)

#### Search & Filter Sections
```tsx
<div className="flex flex-col gap-2 sm:flex-row sm:items-center">
  <form onSubmit={handleSearch} className="flex flex-1 gap-2">
    <div className="relative flex-1">
      <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
      <input
        type="text"
        className="w-full rounded-lg border pr-4 pl-10"
      />
    </div>
    <Button type="submit" className="shrink-0 px-3 sm:px-4">
      <Search className="h-4 w-4 sm:hidden" />
      <span className="hidden sm:inline">Search</span>
    </Button>
  </form>
  <div className="flex gap-2">
    <Button className="flex-1 sm:flex-none">Filters</Button>
    <ViewModeToggle />
  </div>
</div>
```

### Pagination Controls

```tsx
{totalPages > 1 && (
  <div className="flex items-center justify-center gap-3 pt-4 md:gap-4">
    <Button
      variant="outline"
      size="sm"
      disabled={page <= 1}
      onClick={() => setPage(page - 1)}
      className="min-h-[44px] gap-1 px-3 md:px-4"
    >
      <ChevronLeft className="h-4 w-4" />
      <span className="hidden sm:inline">Previous</span>
    </Button>
    <span className="text-muted-foreground text-sm">
      <span className="hidden sm:inline">Page </span>
      <span className="font-medium">{page}</span>
      <span className="hidden sm:inline"> of </span>
      <span className="sm:hidden">/</span>
      <span className="font-medium">{totalPages}</span>
    </span>
    <Button
      variant="outline"
      size="sm"
      disabled={page >= totalPages}
      onClick={() => setPage(page + 1)}
      className="min-h-[44px] gap-1 px-3 md:px-4"
    >
      <span className="hidden sm:inline">Next</span>
      <ChevronRight className="h-4 w-4" />
    </Button>
  </div>
)}
```

**Key features:**
- Larger touch targets (min-h-[44px])
- Compact text on mobile ("1/5" vs "Page 1 of 5")
- Icon-only or short labels on mobile

### Cards & Content Containers

```tsx
// Admin stats, quick actions, etc.
<div className="bg-card rounded-xl border p-4 sm:p-6">
  <div className="flex items-start gap-3">
    <div className="bg-primary/10 rounded-lg p-2">
      <Icon className="text-primary h-5 w-5" />
    </div>
    <div>
      <p className="text-muted-foreground text-sm">{title}</p>
      <p className="text-xl font-bold sm:text-2xl">{value}</p>
    </div>
  </div>
</div>

// Prevent card overflow
<div className="bg-card overflow-hidden rounded-xl border">
```

### Mobile-Specific Components

#### Mobile Card Views (Alternative to Tables)
For complex data, provide a mobile card view alongside desktop table view:

```tsx
{/* Desktop Table View */}
<div className="hidden md:block">
  <table className="w-full">
    {/* table content */}
  </table>
</div>

{/* Mobile Card View */}
<div className="space-y-3 md:hidden">
  {items.map((item) => (
    <div key={item.id} className="bg-card rounded-xl border p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{item.name}</p>
          <p className="text-muted-foreground truncate text-xs">{item.detail}</p>
        </div>
        <Badge className="shrink-0">{item.status}</Badge>
      </div>
      <div className="mt-3 flex gap-2">
        <Button size="sm" className="min-h-[40px] flex-1">Edit</Button>
        <Button size="sm" className="min-h-[40px] flex-1">View</Button>
      </div>
    </div>
  ))}
</div>
```

### Common Mobile Layout Issues & Solutions

| Issue | Solution |
|-------|----------|
| Horizontal scrolling on whole page | Check grid layouts - use responsive classes (`grid-cols-1 sm:grid-cols-2`) |
| Text overflow | Add `min-w-0` to flex parent, `truncate` to text elements |
| Small touch targets | Add `min-h-[40px]` or `min-h-[44px]` to buttons |
| **Page won't scroll vertically in table area** | **Remove `overflow-x-auto` on mobile, use `sm:overflow-x-auto` instead** |
| Cards overflow container | Add `overflow-hidden` to card container |
| Buttons too wide on mobile | Use `flex-1 sm:flex-none` or `w-full sm:w-auto` |
| Spacing too large on mobile | Use responsive spacing (`gap-3 sm:gap-4 lg:gap-6`, `p-4 sm:p-6`) |

### Mobile Testing Checklist

Before pushing changes that affect UI, test on mobile:

**Manual Testing:**
1. Resize browser to mobile width (375px, 414px)
2. Test on actual mobile device or browser dev tools
3. Check for horizontal scrolling on the whole page (should not happen)
4. Verify touch targets are large enough (min 40px)
5. **CRITICAL: Test vertical page scrolling by touching INSIDE table areas** - page must scroll normally
6. Test horizontal table scrolling on larger screens (swipe left/right when columns appear)
7. Test all interactive elements (buttons, forms, modals)

**Key breakpoints to test:**
- Mobile: 375px (iPhone SE)
- Mobile Large: 414px (iPhone Pro Max)
- Tablet: 768px (iPad)
- Desktop: 1024px+

**Common test cases:**
```bash
# Test items/locations/categories list pages (mobile < 640px)
- Grid view: Cards stack properly, no horizontal scroll
- List view: Touch inside table area → page scrolls vertically ✓
- List view: Touch outside table → page scrolls vertically ✓
- List view: Columns hidden properly (only Name + Quantity visible)
- Search/filter: Buttons fit properly
- Pagination: Touch targets large enough (44px)

# Test items/locations/categories list pages (tablet ≥ 640px)
- List view: Additional columns appear (Category, Location, etc.)
- List view: Table might scroll horizontally if wide enough
- List view: Page still scrolls vertically everywhere

# Test admin pages
- Quick actions grid: No horizontal scroll on page
- Charts: Fit within viewport
- Tables (desktop-only): Hidden on mobile, overflow works on desktop

# Test forms
- Inputs: Proper width on mobile
- Buttons: Stack vertically or sized appropriately
- Modals: Scroll properly on mobile
```

### Mobile-First Development Workflow

1. **Start with mobile design** - Write mobile classes first
2. **Add responsive variants** - Use `sm:`, `md:`, `lg:` prefixes to enhance for larger screens
3. **Test on mobile first** - Don't assume it works on mobile if it works on desktop
4. **Use Chrome DevTools** - Test responsive design in browser before deploying

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

**Common namespace guidelines:**

Use the `common.*` namespace for UI strings shared across multiple features:
- **Status indicators:** `active`, `inactive`, `pending`, `status`
- **Actions:** `save`, `cancel`, `delete`, `edit`, `create`, `update`, `print`, `download`, `qrCode`
- **Collaboration roles:** `viewer`, `editor`
- **Form labels:** `displayName`, `quantity`, `description`, `notes`, `location`, `category`
- **UI controls:** `success`, `error`, `saveChanges`, `updateFailed`

Use feature namespaces (`items.*`, `locations.*`, etc.) for:
- Domain-specific terminology unique to that feature
- Feature-specific workflows and messages
- Context-dependent meanings

**Example:**
```tsx
const t = useTranslations("items");        // Feature-specific
const tCommon = useTranslations("common"); // Common UI

return (
  <form>
    <Label>{tCommon("quantity")}</Label>     {/* Common label */}
    <Button>{tCommon("save")}</Button>       {/* Common action */}
    <p>{t("itemSaved")}</p>                  {/* Feature message */}
  </form>
);
```

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
| `frontend/src/lib/api/sdk.gen.ts`, `types.gen.ts` | Backend API changes | Run `mise run api:generate` after backend changes |
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