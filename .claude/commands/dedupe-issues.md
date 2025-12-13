# Deduplicate GitHub Issues

Find and handle duplicate GitHub issues by comparing new issues (labeled `needs-triage`) against existing triaged issues.

## Context

New issues are created via a Windmill workflow that automatically applies the `needs-triage` label. This command checks those new issues for duplicates against the existing issue backlog.

## Your Task

### 1. Fetch Issues

```bash
# Get new issues that need deduplication (from Windmill workflow)
gh issue list --label "needs-triage" --state open --json number,title,body,labels,createdAt --limit 100

# Get existing triaged issues (no needs-triage label) to compare against
gh issue list --state open --json number,title,body,labels,createdAt --limit 500
```

Filter the second list to exclude issues that have the `needs-triage` label - these are your comparison baseline.

### 2. Analyze for Duplicates

For each issue with the `needs-triage` label, compare against all triaged issues:

1. **Title similarity** - Look for issues with similar titles (shared keywords, same feature area)
2. **Body content** - Look for issues describing the same problem or feature
3. **Semantic similarity** - Issues may use different words but describe the same thing

Flag as potential duplicate when:
- Titles share significant keywords (component names, action verbs, error types)
- Body describes the same problem, feature, or bug behavior
- Issues reference the same files, components, or error messages

### 3. Report Findings

For each `needs-triage` issue, provide:

**Issue #X: [Title]**
- **Status**: Unique / Potential Duplicate / Definite Duplicate
- **Similar issues**: List any related issues with similarity reasoning
- **Recommendation**:
  - **Unique**: Remove `needs-triage` label (ready for backlog)
  - **Potential Duplicate**: Keep for manual review, list similar issues
  - **Definite Duplicate**: Close as duplicate of #Y

### 4. Take Action (if requested)

If the user includes "fix" or "resolve" in arguments ($ARGUMENTS):

**For definite duplicates:**
```bash
# Add duplicate label and close
gh issue edit <number> --add-label "duplicate" --remove-label "needs-triage"
gh issue close <number> --reason "not planned" --comment "Closing as duplicate of #X. See the original issue for tracking."
```

**For unique issues:**
```bash
# Remove triage label - issue is ready for backlog
gh issue edit <number> --remove-label "needs-triage"
```

**For potential duplicates:**
- Add a comment noting the similar issues for manual review
- Keep `needs-triage` label until manually resolved

### 5. Summary

After processing, provide a summary:
- Total issues with `needs-triage` label
- Unique issues (cleared for backlog)
- Potential duplicates (need manual review)
- Definite duplicates (closed)

## Arguments

$ARGUMENTS

## Usage Examples

- `/dedupe-issues` - Analyze and report duplicates (no changes made)
- `/dedupe-issues fix` - Analyze and automatically handle duplicates
