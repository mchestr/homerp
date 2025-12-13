# Feedback Command

Process user feedback and create a well-researched GitHub issue.

## Instructions

The user has provided the following feedback or feature idea:

$ARGUMENTS

## Your Task

1. **Research the codebase** to understand how this feedback relates to existing code:
   - Search for relevant files, components, and patterns
   - Identify what currently exists related to this feedback
   - Note any technical constraints or dependencies

2. **Check existing GitHub issues** for duplicates or related issues:
   - Use `gh issue list` to search for similar issues
   - If a duplicate exists, inform the user and optionally add a comment to the existing issue
   - If a closely related issue exists, consider updating it instead of creating a new one
   - Proceed with creating a new issue only if no duplicates or close matches are found

3. **Flesh out the idea** based on your research:
   - Clarify the problem or opportunity
   - Consider edge cases and implications
   - Identify affected areas of the codebase

4. **Create a GitHub issue** with:
   - A clear, descriptive title
   - A detailed description explaining the context and rationale
   - High-level implementation steps (5-10 steps)
   - Any technical notes discovered during research
   - Acceptance criteria

Use `gh issue create` to create the issue and share the link with the user.
