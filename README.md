# HomERP

Home inventory system with AI-powered item classification for hobbyists.

## Features

- **AI Classification**: Take a photo of any item and let GPT-4 Vision identify and categorize it
- **Multi-tenant**: Each user has their own isolated inventory
- **Flexible Tracking**: Track anything from M3 screws to HDMI cables with custom attributes
- **Organized Storage**: Hierarchical locations (Room > Shelf > Bin > Drawer)

## Tech Stack

- **Backend**: Python 3.12, FastAPI, SQLAlchemy (async), PostgreSQL
- **Frontend**: Next.js 14, React, Tailwind CSS, shadcn/ui
- **AI**: OpenAI GPT-4 Vision
- **Auth**: Google OAuth

## Quick Start

### Prerequisites

- Docker & Docker Compose
- Google OAuth credentials (for authentication)
- OpenAI API key (for AI classification)

### Setup

1. Clone the repository:
```bash
git clone https://github.com/yourusername/homerp.git
cd homerp
```

2. Copy environment files:
```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

3. Edit `backend/.env` with your credentials:
```env
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
JWT_SECRET=your-secure-secret
OPENAI_API_KEY=your-openai-key
```

4. Start the development environment:
```bash
docker compose up
```

5. Access the application:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000
   - API Docs: http://localhost:8000/docs

## Development

### Backend

```bash
cd backend
uv sync                    # Install dependencies
uv run pytest              # Run tests
uv run ruff check .        # Lint
uv run ruff format .       # Format
```

### Frontend

```bash
cd frontend
pnpm install               # Install dependencies
pnpm dev                   # Start dev server
pnpm lint                  # Lint
pnpm generate-api          # Regenerate API client
```

### Database Migrations

```bash
cd backend
uv run alembic upgrade head                    # Apply migrations
uv run alembic revision --autogenerate -m "description"  # Create migration
```

## Project Structure

```
homerp/
├── backend/               # FastAPI backend
│   ├── src/
│   │   ├── auth/          # Authentication
│   │   ├── items/         # Inventory items
│   │   ├── categories/    # Categories
│   │   ├── locations/     # Storage locations
│   │   ├── images/        # Image handling
│   │   └── ai/            # OpenAI integration
│   ├── alembic/           # Database migrations
│   └── tests/
├── frontend/              # Next.js frontend
│   └── src/
│       ├── app/           # Pages
│       ├── components/    # React components
│       └── lib/api/       # Generated API client
└── docker-compose.yml
```

## License

MIT
