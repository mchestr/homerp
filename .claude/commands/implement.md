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

## Requirements
- Always use the todo list to track progress
- Use specialized agents (Explore, Plan, playwright-e2e-architect) where appropriate
- Ensure all tests pass before creating the MR
- Include "Closes #$ARGUMENTS" in the MR description
