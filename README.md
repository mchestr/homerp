# HomERP

**Home inventory system with AI-powered item classification for hobbyists.**

[![Backend CI](https://github.com/mchestr/homerp/actions/workflows/backend.yml/badge.svg)](https://github.com/mchestr/homerp/actions/workflows/backend.yml)
[![Frontend CI](https://github.com/mchestr/homerp/actions/workflows/frontend.yml/badge.svg)](https://github.com/mchestr/homerp/actions/workflows/frontend.yml)

---

## Features

### Core Inventory Management
- **AI-Powered Classification** — Snap a photo and let GPT-4 Vision automatically identify, categorize, and tag your items
- **Flexible Item Tracking** — Track anything from M3 screws to HDMI cables with custom attributes and JSONB metadata
- **Hierarchical Categories** — Organize items in a tree structure (Electronics > Cables > HDMI)
- **Smart Locations** — Multi-level storage hierarchy (Room → Shelf → Bin → Drawer)

### Storage Visualization
- **Gridfinity Integration** — Visual bin layout with drag-and-drop positioning
- **Collision Detection** — Prevents overlapping bin placements
- **QR Code Labels** — Generate and print labels for physical storage locations

### Collaboration & Sharing
- **Inventory Sharing** — Share your inventory with other users (view-only or full access)
- **Multi-Tenant Architecture** — Complete data isolation via PostgreSQL Row-Level Security

### Billing & Credits
- **Credit-Based AI Usage** — Pay-as-you-go model for AI classification
- **Free Tier** — 5 free AI credits per month
- **Stripe Integration** — Secure payment processing for credit packs
- **Low Stock Alerts** — Email notifications when items run low

### Internationalization
- **Multi-Language Support** — English, German, Spanish, French, Portuguese (BR), Japanese

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Backend** | Python 3.12, FastAPI, SQLAlchemy (async), PostgreSQL 16 |
| **Frontend** | Next.js 15, React, Tailwind CSS, shadcn/ui |
| **AI** | OpenAI GPT-4 Vision |
| **Auth** | Google OAuth + JWT |
| **Payments** | Stripe |
| **Task Runner** | [mise](https://mise.jdx.dev/) |

---

## Quick Start

### Prerequisites

- [mise](https://mise.jdx.dev/) — Tool version manager & task runner
- [Docker](https://www.docker.com/) & Docker Compose
- Google OAuth credentials ([setup guide](https://developers.google.com/identity/protocols/oauth2))
- OpenAI API key ([get one](https://platform.openai.com/api-keys))
- Stripe API keys (optional, for billing)

### Installation

```bash
# Clone the repository
git clone https://github.com/mchestr/homerp.git
cd homerp

# Install tools (Node.js, Python, uv) and all dependencies
mise install
mise run install
```

### Configuration

1. Copy environment files:
```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

2. Edit `backend/.env` with your credentials:
```env
# Database
DATABASE_URL=postgresql+asyncpg://homerp:homerp@localhost:5432/homerp

# Authentication (required)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
JWT_SECRET=your-secure-random-secret

# OpenAI (required for AI classification)
OPENAI_API_KEY=your-openai-api-key

# Frontend URL (for CORS and Stripe redirects)
FRONTEND_URL=http://localhost:3000

# Storage
UPLOAD_DIR=./uploads

# Stripe (optional, for billing)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Credits
FREE_MONTHLY_CREDITS=5

# Admin (email that automatically becomes admin on login)
ADMIN_EMAIL=admin@example.com

# Debug mode
DEBUG=false
```

3. Edit `frontend/.env`:
```env
NEXT_PUBLIC_API_URL=http://localhost:8000

# E2E testing (optional)
PLAYWRIGHT_BASE_URL=http://localhost:3000
```

### Running the Application

```bash
# Start all services (PostgreSQL, backend, frontend)
mise run dev
```

Access the application:
- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:8000
- **API Documentation:** http://localhost:8000/docs

---

## Development

### Task Runner Commands

All common operations are available through mise:

```bash
mise tasks              # List all available tasks
```

#### Development
```bash
mise run dev            # Start all services with Docker
mise run dev:backend    # Start backend only
mise run dev:frontend   # Start frontend only
```

#### Code Quality
```bash
mise run lint           # Lint all code
mise run format         # Format all code
mise run check          # Run ALL CI checks (recommended before pushing)
```

#### Testing
```bash
mise run test           # Run all tests
mise run test:backend   # Backend tests (pytest)
mise run test:frontend  # Frontend unit tests (vitest)
mise run test:e2e       # E2E tests (Playwright)
mise run test:e2e:ui    # E2E tests with Playwright UI
```

#### Database
```bash
mise run db:migrate                  # Run migrations
mise run db:migration "description"  # Create new migration
mise run db:reset                    # Reset database
```

#### API Client
```bash
mise run api:generate   # Regenerate frontend TypeScript client from OpenAPI
```

### Manual Commands

<details>
<summary>Backend (without mise)</summary>

```bash
cd backend
uv sync                          # Install dependencies
uv run pytest                    # Run tests
uv run ruff check .              # Lint
uv run ruff format .             # Format
uv run alembic upgrade head      # Apply migrations
```
</details>

<details>
<summary>Frontend (without mise)</summary>

```bash
cd frontend
pnpm install                     # Install dependencies
pnpm dev                         # Start dev server
pnpm build                       # Production build
pnpm lint                        # Lint
pnpm test                        # Unit tests
pnpm test:e2e                    # E2E tests
pnpm generate-api                # Regenerate API client
```
</details>

---

## Project Structure

```
homerp/
├── mise.toml              # Task runner configuration
├── docker-compose.yml     # Development environment
│
├── backend/               # FastAPI backend
│   ├── src/
│   │   ├── auth/          # OAuth + JWT authentication
│   │   ├── users/         # User management
│   │   ├── items/         # Inventory items (core)
│   │   ├── categories/    # Item categories (tree structure)
│   │   ├── locations/     # Storage locations
│   │   ├── images/        # Image upload + storage
│   │   ├── ai/            # OpenAI GPT-4 Vision integration
│   │   ├── billing/       # Stripe billing + credits
│   │   └── common/        # Shared utilities
│   ├── alembic/           # Database migrations
│   └── tests/             # pytest test suite
│
└── frontend/              # Next.js frontend
    ├── src/
    │   ├── app/           # App Router pages
    │   ├── components/    # React components
    │   │   └── ui/        # shadcn/ui components
    │   ├── context/       # React Context providers
    │   ├── hooks/         # Custom React hooks
    │   └── lib/
    │       └── api/       # Generated OpenAPI TypeScript client
    ├── e2e/               # Playwright E2E tests
    └── messages/          # i18n translation files
```

---

## Architecture Highlights

### Multi-Tenancy with Row-Level Security
All user data is isolated at the database level using PostgreSQL RLS policies. Each request sets `app.current_user_id` as a session variable, and RLS policies automatically filter all queries.

### Async Everything
The entire backend is async-first using:
- Async SQLAlchemy with `asyncpg` driver
- Async FastAPI endpoints
- Non-blocking I/O throughout

### Type-Safe API Communication
The frontend uses an auto-generated TypeScript client from the backend's OpenAPI specification, ensuring compile-time type safety across the stack.

### Credit-Based AI Billing
- **Free tier:** 5 AI credits per month (resets on signup anniversary)
- **Credit packs:** One-time purchases that never expire
- **Stripe webhooks:** Automatic credit provisioning on payment

---

## API Overview

| Endpoint | Description |
|----------|-------------|
| `POST /api/v1/auth/google` | Initiate Google OAuth |
| `GET /api/v1/items` | List items (paginated, filterable) |
| `POST /api/v1/items` | Create new item |
| `POST /api/v1/images/upload` | Upload item image |
| `POST /api/v1/images/classify` | AI classification (uses credits) |
| `GET /api/v1/billing/balance` | Get credit balance |
| `POST /api/v1/billing/checkout` | Create Stripe checkout session |

Full API documentation available at `/docs` when running the backend.

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run checks before committing:
   ```bash
   mise run check
   ```
5. Commit using [Conventional Commits](https://www.conventionalcommits.org/):
   ```bash
   git commit -m "feat(items): add bulk delete functionality"
   ```
6. Push and open a Pull Request

### Commit Message Format
- `feat:` — New features
- `fix:` — Bug fixes
- `chore:` — Maintenance tasks
- `refactor:` — Code improvements
- `docs:` — Documentation updates
- `test:` — Test additions/fixes

---

## License

MIT
