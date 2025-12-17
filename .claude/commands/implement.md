# Implement GitHub Issue

Implement GitHub issue #$ARGUMENTS

## Workflow

### 1. Read the Issue
First, fetch and understand the issue details:
```
gh issue view $ARGUMENTS
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

### 6. Create Pull Request
- Create a feature branch: `feat/<short-description>`
- Commit with a descriptive message referencing the issue
- Push and create a PR that closes the issue

### 7. Monitor & Fix Workflow
After pushing, monitor the GitHub Actions workflow and fix any failures:

```bash
# Check workflow runs for current branch
gh run list --branch $(git branch --show-current)

# View details of a specific run
gh run view <RUN_ID>

# View logs for a failed run
gh run view <RUN_ID> --log-failed

# Watch a run in progress
gh run watch <RUN_ID>

# Re-run failed jobs
gh run rerun <RUN_ID> --failed
```

**Note:** Use `gh run view --log-failed` to quickly see what went wrong in failed jobs.

## Troubleshooting Workflow Failures

### Diagnostic Workflow Example
Here's a complete example of diagnosing and fixing a failed workflow:

```bash
# 1. List recent workflow runs for your branch
gh run list --branch feat/my-feature
# Output: ID  STATUS  CONCLUSION  WORKFLOW  BRANCH  ...

# 2. View the failed run details
gh run view 12345678
# Shows job breakdown with pass/fail status

# 3. Get logs for failed jobs only
gh run view 12345678 --log-failed
# Shows: specific error messages from failed jobs

# 4. Fix the specific issues mentioned in the logs
cd frontend
pnpm exec prettier --write src/components/layout/header.tsx

# 5. Commit and push
git add -u && git commit -m "style: fix prettier formatting"
git push

# 6. Optional: re-run failed jobs if it was a flaky failure
gh run rerun 12345678 --failed
```

### Prettier Formatting Issues
**Symptom:** Lint job fails with "Code style issues found in X files"

**Cause:** The workflow runs `pnpm format:check` which fails if files aren't formatted with Prettier.

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
**Symptom:** Lint job fails with ESLint errors

**Fix:** Run lint locally and fix reported issues:
```bash
cd frontend
pnpm lint
```

### Backend Lint Errors (Ruff)
**Symptom:** Backend lint job fails with ruff check or format errors

**Cause:** The workflow runs both `uv run ruff check .` and `uv run ruff format --check .`

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
**Symptom:** Backend test job fails

**Debug:** Check the test output for specific failures:
```bash
# Run tests locally (requires Docker for testcontainers)
mise run test:backend

# Run specific test file
mise run test:backend -- -v tests/path/to/test.py
```

### Build Failures
**Symptom:** Frontend build or backend build job fails

**Fix:** Test builds locally:
```bash
# Frontend build (without Docker)
cd frontend && pnpm build

# With Docker
mise run build:frontend
mise run build:backend
```

### Flaky E2E Playwright Tests
**Symptom:** Playwright job fails with navigation or element interaction errors like:
- `expect(page).toHaveURL(expected) failed` - page stays on wrong URL after click
- `Element not found` or `Element not visible` errors
- Tests pass locally but fail in CI

**Cause:** CI environments are slower than local machines. Elements may not be fully interactive when clicked, or navigation may take longer than the default timeout.

**Diagnosis:**
```bash
# Get logs for the e2e job
gh run view <RUN_ID> --log-failed
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

## Requirements
- Always use the todo list to track progress
- Use specialized agents (Explore, Plan, playwright-e2e-architect) where appropriate
- Ensure all tests pass before creating the PR
- Include "Closes #$ARGUMENTS" in the PR description
- Monitor the workflow after pushing and fix any failures promptly
