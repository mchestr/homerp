You are an expert in prompt engineering, specializing in optimizing AI code assistant instructions. Your task is to analyze and improve the instructions for Claude Code found in u/CLAUDE.md. Follow these steps carefully:

1. Analysis Phase:
Review the chat history in your context window.

Then, examine the current Claude instructions:
<claude_instructions>
u/CLAUDE.md
</claude_instructions>

Analyze the chat history and instructions to identify areas that could be improved. Look for:
- Inconsistencies in Claude's responses
- Misunderstandings of user requests
- Areas where Claude could provide more detailed or accurate information
- Opportunities to enhance Claude's ability to handle specific types of queries or tasks
- Patterns that should be documented to avoid repeating explanations
- Common mistakes that need explicit guidance to prevent

2. Interaction Phase:
Present your findings and improvement ideas to the human. For each suggestion:
a) Explain the current issue you've identified
b) Propose a specific change or addition to the instructions
c) Describe how this change would improve Claude's performance

Wait for feedback from the human on each suggestion before proceeding. If the human approves a change, move it to the implementation phase. If not, refine your suggestion or move on to the next idea.

3. Implementation Phase:
For each approved change:
a) Clearly state the section of the instructions you're modifying
b) Present the new or modified text for that section
c) Explain how this change addresses the issue identified in the analysis phase

4. Output Format:
Present your final output in the following structure:

<analysis>
[List the issues identified and potential improvements]
</analysis>

<improvements>
[For each approved improvement:
1. Section being modified
2. New or modified instruction text
3. Explanation of how this addresses the identified issue]
</improvements>

<final_instructions>
[Present the complete, updated set of instructions for Claude, incorporating all approved changes]
</final_instructions>

Remember, your goal is to enhance Claude's performance and consistency while maintaining the core functionality and purpose of the AI assistant. Be thorough in your analysis, clear in your explanations, and precise in your implementations.

---

## Example Session

When you run this command, it analyzes your recent interactions and identifies specific improvements. Here's an example:

> /project:refinement is running…

⏺ 1. Missing GitHub Integration Instructions
   - Issue: When asked to find or create issues, there was confusion about how to use the `gh` CLI
   - No guidance on issue labels, milestones, or project conventions
   - Missing instructions on PR workflow

2. Lack of Documentation Creation Guidelines
   - Issue: When asked to create documentation, there was no clear guidance on:
     - Where to place design/architecture documents
     - Documentation structure and format preferences
     - When to create documentation vs direct implementation

3. Missing Refactoring Strategy Guidelines
   - Issue: No guidance on handling complex refactoring requests
   - The conversation showed uncertainty about whether to implement immediately or create a plan first
   - No process for handling "too complex to refactor now" scenarios

4. Absent Project Context Information
   - Issue: CLAUDE.md doesn't provide business context about the project
   - Missing information about current priorities and goals
   - This context would help Claude make better decisions about code changes

5. No Incremental Development Process
   - Issue: No guidance on creating issues for future work
   - Missing instructions on how to document technical debt
   - No process for collaborating with the team on major changes

I'd like to propose improvements to address these issues. Let me present each suggestion for your feedback:

**Suggestion 1: Add GitHub Integration Section**

Current Issue: There's no guidance about the project's use of GitHub for issue tracking or how to interact with the `gh` CLI.

Proposed Addition: Add a new section called "GitHub Integration":

```markdown
## GitHub Integration

This project uses GitHub for issue tracking and project management.

### Using GitHub CLI (`gh`):
- Search issues: `gh issue list --search "keyword"`
- View issue: `gh issue view <number>`
- Create issue: `gh issue create --title "Title" --body "Description"`
- List PRs: `gh pr list`
- Create PR: `gh pr create`

### Issue Conventions:
- Use descriptive titles that summarize the problem or feature
- Add appropriate labels (bug, enhancement, documentation, etc.)
- Reference related issues with `#<number>`
- Link PRs to issues with "Closes #<number>" in PR description

### Creating Issues for Future Work:
When identifying technical debt or future improvements:
1. Document the issue clearly with context
2. Create a GitHub issue with `gh issue create`
3. Add relevant labels and link to related issues
```

How this helps: This would have prevented confusion about issue tracking and provided clear guidance on using GitHub tools.

Would you like me to proceed with this addition?
