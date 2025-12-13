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
Run lint, format, and build before committing:
```bash
# Backend - run BOTH check and format
cd backend
uv run ruff check .
uv run ruff format .

# Frontend - run BOTH lint and format
cd frontend
pnpm lint
pnpm format

# Build (or pnpm tsc --noEmit if Docker unavailable)
mise run build
```

**IMPORTANT:** Always run format commands, not just check. The CI runs `--check` mode which will fail if files need formatting.

### 6. Create Merge Request
- Create a feature branch: `feat/<short-description>`
- Commit with a descriptive message referencing the issue
- Push and create an MR that closes the issue

### 7. Monitor & Fix Pipeline
After pushing, monitor the pipeline and fix any failures:

```bash
# Check pipeline status
glab ci status

# Get job IDs from the current pipeline
glab api "/projects/mchestr%2Fhomerp/pipelines/<PIPELINE_ID>/jobs" | jq '.[] | {name, id, status}'

# View logs for a failed job (use API for fresh results)
glab api "/projects/mchestr%2Fhomerp/jobs/<JOB_ID>/trace" | tail -100
```

**Note:** The `glab ci trace` command can sometimes show cached/stale results. Always use the API directly for accurate job traces. Verify the SHA in the trace matches your expected commit.

## Troubleshooting Pipeline Failures

### Prettier Formatting Issues
**Symptom:** `frontend:lint` job fails with "Code style issues found"

**Cause:** The pipeline runs `pnpm format:check` which fails if files aren't formatted with Prettier.

**Fix:**
```bash
cd frontend
pnpm format  # Uses the project's prettier config
```

Then amend your commit (if fixing immediately after push) or create a new commit:
```bash
git add -u
git commit --amend --no-edit  # If fixing your own recent commit
git push --force-with-lease
```

### ESLint Errors
**Symptom:** `frontend:lint` job fails with ESLint errors

**Fix:** Run lint locally and fix reported issues:
```bash
cd frontend
pnpm lint
```

### Backend Lint Errors (Ruff)
**Symptom:** `backend:lint` job fails with ruff check or format errors

**Cause:** The pipeline runs both `uv run ruff check .` and `uv run ruff format --check .`

**Fix:** Run both ruff check (with auto-fix) and format:
```bash
cd backend
uv run ruff check . --fix  # Fix linting issues
uv run ruff format .       # Format code (required - CI runs --check mode)
```

Then amend your commit and push:
```bash
git add -u
git commit --amend --no-edit
git push --force-with-lease
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

### Merged Results Pipeline Issues
**Symptom:** Pipeline shows job as failed but trace shows "Job succeeded", or pipeline is testing old code

**Cause:** GitLab runs "merged results" pipelines that merge your MR into the target branch before testing. If `main` was updated by another MR, your pipeline may be testing stale merged code.

**Fix:** Rebase your branch onto the latest main:
```bash
git fetch origin
git rebase origin/main
git push --force-with-lease
```

This triggers a new pipeline with the correct merged result.

## Requirements
- Always use the todo list to track progress
- Use specialized agents (Explore, Plan, playwright-e2e-architect) where appropriate
- Ensure all tests pass before creating the MR
- Include "Closes #$ARGUMENTS" in the MR description
- Monitor the pipeline after pushing and fix any failures promptly
