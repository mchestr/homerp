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
# Check pipeline status for current branch
glab ci status

# Get pipeline directly for a specific MR (most reliable method)
glab api "projects/:id/merge_requests/4/pipelines"
# Returns: [{"id":2212521051,"status":"failed",...}]

# Alternative: List recent pipelines and grep
glab ci list --per-page 10
glab ci list --per-page 20 | grep "merge-requests/8"

# Get job details from a pipeline (use pipeline ID from ci list output)
glab api "projects/:id/pipelines/<PIPELINE_ID>/jobs" | jq '.[] | {name, id, status, stage}'

# Find failed jobs specifically
glab api "projects/:id/pipelines/<PIPELINE_ID>/jobs" | jq '.[] | select(.status == "failed") | {name, id}'

# View logs for a failed job (use job ID from above)
glab api "projects/:id/jobs/<JOB_ID>/trace" | tail -100
```

**Note:** The `glab ci trace` command can sometimes show cached/stale results. Always use the API directly for accurate job traces. The `:id` shorthand in API paths is automatically resolved by glab to your project ID.

## Troubleshooting Pipeline Failures

### Diagnostic Workflow Example
Here's a complete example of diagnosing and fixing a failed pipeline for MR 4:

```bash
# 1. Get pipeline status directly from MR number (most reliable)
glab api "projects/:id/merge_requests/4/pipelines"
# Output: [{"id":2212521051,"status":"failed",...}]

# Alternative: Search through pipeline list
glab ci list --per-page 20 | grep "merge-requests/4"
# Output: (failed) • #2212521051  (#31)  refs/merge-requests/4/head

# 2. Get all jobs for that pipeline
glab api "projects/:id/pipelines/2212521051/jobs" | jq '.[] | {name, status, stage}'
# Output shows which jobs failed (e.g., frontend:lint status:"failed")

# 3. Get the job IDs for failed jobs only
glab api "projects/:id/pipelines/2212521051/jobs" | jq '.[] | select(.status == "failed") | {name, id}'
# Output: { "name": "frontend:lint", "id": 12425029382 }

# 4. View the trace for the failed job (last 100 lines usually enough)
glab api "projects/:id/jobs/12425029382/trace" | tail -100
# Shows: "Code style issues found in 2 files" with file paths
# e.g., src/components/layout/header.tsx, src/components/ui/tooltip.tsx

# 5. Fix the specific files mentioned in the trace
cd frontend
pnpm exec prettier --write src/components/layout/header.tsx src/components/ui/tooltip.tsx
# Or fix all: pnpm format

# 6. Commit and push
git add -u && git commit -m "style: fix prettier formatting"
git push
```

### Prettier Formatting Issues
**Symptom:** `frontend:lint` job fails with "Code style issues found in X files"

**Cause:** The pipeline runs `pnpm format:check` which fails if files aren't formatted with Prettier.

**Fix (all files):**
```bash
cd frontend
pnpm format  # Format all files using project's prettier config
```

**Fix (specific files - faster when CI tells you which files):**
```bash
cd frontend
pnpm exec prettier --write src/components/layout/header.tsx src/components/ui/tooltip.tsx
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

### Flaky E2E Playwright Tests
**Symptom:** `e2e:playwright` job fails with navigation or element interaction errors like:
- `expect(page).toHaveURL(expected) failed` - page stays on wrong URL after click
- `Element not found` or `Element not visible` errors
- Tests pass locally but fail in CI

**Cause:** CI environments are slower than local machines. Elements may not be fully interactive when clicked, or navigation may take longer than the default timeout.

**Diagnosis:**
```bash
# Get the e2e job trace
glab api "projects/:id/pipelines/<PIPELINE_ID>/jobs" | jq '.[] | select(.name == "e2e:playwright") | .id'
glab api "projects/:id/jobs/<JOB_ID>/trace" | tail -200
```

Look for patterns like:
- `Timeout: 5000ms` - default assertion timeout may be too short
- `unexpected value "http://localhost:3000/dashboard"` - navigation didn't happen
- Element clicks that don't trigger expected behavior

**Fix:** Improve test stability with these patterns:

1. **Add `data-testid` attributes** to elements for reliable selection:
```tsx
// Component
<Link href="/items" data-testid="sidebar-link-items">Items</Link>
<Button data-testid="add-item-button">Add Item</Button>
```

2. **Wait for page to fully load** before interacting:
```typescript
// Wait for a key element that indicates the page is ready
await expect(page.getByRole("heading", { name: /dashboard/i })).toBeVisible();
```

3. **Wait for elements to be visible** before clicking:
```typescript
const button = page.getByTestId("add-item-button");
await button.waitFor({ state: "visible" });
await button.click();
```

4. **Increase navigation timeout** for CI:
```typescript
// Default is 5000ms which may be too short in CI
await expect(page).toHaveURL(/.*\/items/, { timeout: 10000 });
```

5. **Complete example** of a stable navigation test:
```typescript
test("sidebar navigation works", async ({ page, isMobile }) => {
  await authenticateUser(page);
  await setupApiMocks(page);
  await page.goto("/dashboard");

  // Wait for page to fully load
  await expect(page.getByRole("heading", { name: /dashboard/i })).toBeVisible();

  // On mobile, open sidebar first
  if (isMobile) {
    const menuButton = page.getByRole("button").filter({ has: page.locator("svg.lucide-menu") });
    await menuButton.waitFor({ state: "visible" });
    await menuButton.click();
  }

  // Use data-testid for reliable selection
  const itemsLink = page.getByTestId("sidebar-link-items");
  await itemsLink.waitFor({ state: "visible" });
  await itemsLink.click();

  // Longer timeout for CI
  await expect(page).toHaveURL(/.*\/items/, { timeout: 10000 });
});
```

**Key principles:**
- Always add `data-testid` to interactive elements when creating new UI
- Never assume an element is ready immediately after page load
- Use explicit waits (`waitFor`) instead of relying on implicit timeouts
- Increase assertion timeouts for navigation checks in CI

### CI Quota Exceeded
**Symptom:** All jobs in pipeline show `failed` status almost immediately

**Diagnosis:**
```bash
# Check job failure reason
glab api "projects/:id/jobs/<JOB_ID>" | jq '{status, failure_reason}'
# Output: { "status": "failed", "failure_reason": "ci_quota_exceeded" }
```

**Cause:** GitLab CI minutes have run out for the month/billing period.

**Fix:** This is not a code issue. Options:
- Wait for CI quota to reset (monthly)
- Purchase additional CI minutes
- Use a self-hosted runner

## Requirements
- Always use the todo list to track progress
- Use specialized agents (Explore, Plan, playwright-e2e-architect) where appropriate
- Ensure all tests pass before creating the MR
- Include "Closes #$ARGUMENTS" in the MR description
- Monitor the pipeline after pushing and fix any failures promptly
