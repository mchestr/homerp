# Fix Pull Request

Address review comments, fix failing status checks, and rebase PR #$ARGUMENTS on latest main.

## Workflow

### 1. Checkout the PR

```bash
gh pr checkout $ARGUMENTS
```

### 2. Fetch and Rebase on Latest Main

```bash
git fetch origin main
git rebase origin/main
```

If conflicts occur:
- Resolve conflicts in each file
- `git add <file>` after resolving each
- `git rebase --continue`
- Repeat until complete

### 3. Get PR Review Comments

```bash
# View PR with comments
gh pr view $ARGUMENTS --comments

# Get inline code review comments
gh api repos/{owner}/{repo}/pulls/$ARGUMENTS/comments --jq '.[] | {path: .path, line: .line, body: .body, user: .user.login}'
```

For each comment:
1. Understand the feedback
2. Make the requested changes
3. Track in todo list

### 4. Check and Fix Failing Status Checks

```bash
# View current check status
gh pr checks $ARGUMENTS

# If checks are failing, get the logs
gh run list --branch $(git branch --show-current) --limit 3
gh run view <RUN_ID> --log-failed
```

#### Common Fixes

**Frontend formatting/lint:**
```bash
cd frontend
pnpm format
pnpm lint:fix
```

**Backend formatting/lint:**
```bash
cd backend
uv run ruff check . --fix
uv run ruff format .
```

**Test failures:**
```bash
# Backend
cd backend && uv run pytest -v

# Frontend unit tests
cd frontend && pnpm test

# E2E tests - use playwright-e2e-architect agent for complex failures
cd frontend && pnpm test:e2e
```

### 5. Verify Locally Before Pushing

```bash
mise run check
```

### 6. Push and Monitor

```bash
# Force push after rebase
git push --force-with-lease

# Watch the workflow
gh run watch
```

## Requirements

- Use todo list to track each review comment being addressed
- Ensure ALL status checks pass locally before pushing
- Use `--force-with-lease` (not `--force`) for safety
- If a comment needs clarification, note it rather than guessing
