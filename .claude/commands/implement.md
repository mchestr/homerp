# Implement GitLab Issue

Implement GitLab issue #$ARGUMENTS

## Workflow

### 1. Read the Issue
First, fetch and understand the issue details:
```
glab issue view $ARGUMENTS
```

### 2. Explore & Plan
- Use the **Explore agent** to understand the relevant parts of the codebase
- Use the **Plan agent** if the implementation is complex and requires architectural decisions
- Create a todo list to track implementation steps

### 3. Implement
- Make the necessary code changes
- Follow all guidelines in CLAUDE.md:
  - Use idiomatic solutions, no hacks
  - Use modal components instead of browser alerts
  - Translate all frontend strings with i18n
  - Add `data-testid` attributes to new UI components

### 4. Add Tests
- **Backend changes**: Add unit tests in `backend/tests/`
- **Frontend UI changes**: Use the **playwright-e2e-architect agent** to create e2e tests
  - Add `data-testid` attributes to components
  - Create mock API handlers if needed
  - Test both desktop and mobile viewports

### 5. Verify
Run lint and build before committing:
```
mise run lint
mise run build  # or pnpm tsc --noEmit if Docker unavailable
```

### 6. Create Merge Request
- Create a feature branch: `feat/<short-description>`
- Commit with a descriptive message referencing the issue
- Push and create an MR that closes the issue

### 7. Monitor & Fix Pipeline
After pushing, monitor the pipeline and fix any failures:

```bash
# Check pipeline status
glab ci status

# View logs for a failed job
glab api projects/mchestr%2Fhomerp/jobs/<JOB_ID>/trace | tail -100
```

## Troubleshooting Pipeline Failures

### Prettier Formatting Issues
**Symptom:** `frontend:lint` job fails with "Code style issues found"

**Cause:** The pipeline runs `pnpm format:check` which fails if files aren't formatted with Prettier.

**Fix:**
```bash
cd frontend
pnpm exec prettier --write <affected-files>
# Or format all files:
pnpm exec prettier --write .
```

Then commit and push the fix:
```bash
git add <affected-files>
git commit -m "style: fix prettier formatting issues"
git push
```

### ESLint Errors
**Symptom:** `frontend:lint` job fails with ESLint errors

**Fix:** Run lint locally and fix reported issues:
```bash
cd frontend
pnpm lint
```

### Backend Lint Errors
**Symptom:** `backend:lint` job fails with ruff errors

**Fix:** Run ruff with auto-fix:
```bash
cd backend
uv run ruff check . --fix
uv run ruff format .
```

### Backend Test Failures
**Symptom:** `backend:test` job fails

**Debug:** Check the test output for specific failures:
```bash
# Run tests locally (requires Docker for testcontainers)
mise run test:backend

# Run specific test file
mise run test:backend -- -v tests/path/to/test.py
```

### Build Failures
**Symptom:** `frontend:build` or `backend:build:docker` fails

**Fix:** Test builds locally:
```bash
# Frontend build (without Docker)
cd frontend && pnpm build

# With Docker
mise run build:frontend
mise run build:backend
```

## Requirements
- Always use the todo list to track progress
- Use specialized agents (Explore, Plan, playwright-e2e-architect) where appropriate
- Ensure all tests pass before creating the MR
- Include "Closes #$ARGUMENTS" in the MR description
- Monitor the pipeline after pushing and fix any failures promptly
