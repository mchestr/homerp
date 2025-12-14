# Windmill Workflows

This directory contains Windmill workflows for HomERP automation.

## Workflows

### GitHub Issue Triage (`f/issue_triage`)

Automatically categorizes user issues using OpenAI and creates GitHub issues.

**Flow:**
1. Parses and validates input
2. Fetches existing labels from the GitHub repository
3. Calls OpenAI GPT-4o to categorize as bug/feature/question
4. Processes labels (identifies which need to be created)
5. Creates any missing labels in the repository
6. Creates a formatted GitHub issue with appropriate labels
7. Optionally sends a Pushover notification

## Setup

### Prerequisites

- [Windmill](https://windmill.dev) instance (self-hosted or cloud)
- [wmill CLI](https://www.windmill.dev/docs/advanced/cli)

### Installation

1. Install the Windmill CLI:
   ```bash
   npm install -g windmill-cli
   # or
   deno install -A https://deno.land/x/wmill/main.ts
   ```

2. Configure your Windmill workspace:
   ```bash
   wmill workspace add <workspace_name> <workspace_url> <token>
   ```

3. Push the workflows to Windmill:
   ```bash
   cd windmill
   wmill sync push
   ```

### Required Variables

Configure these in your Windmill workspace under **Settings > Variables & Secrets**:

| Variable Path | Description |
|--------------|-------------|
| `u/windmill/github_token` | GitHub Personal Access Token with `repo` scope |
| `u/windmill/openai_api_key` | OpenAI API key |
| `u/windmill/pushover_user_key` | Pushover user key (optional, for notifications) |
| `u/windmill/pushover_api_token` | Pushover API token (optional, for notifications) |

#### Creating the GitHub Token

1. Go to [GitHub Settings > Developer settings > Personal access tokens](https://github.com/settings/tokens)
2. Create a new token (classic) with `repo` scope
3. In Windmill, create a variable at path `u/windmill/github_token`

## Usage

### Webhook Trigger

After deploying, get the webhook URL from Windmill and send POST requests:

```bash
curl -X POST https://your-windmill.com/api/w/<workspace>/jobs/run/f/issue_triage \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "issue_text": "The inventory search is slow when I have more than 1000 items. It takes over 10 seconds to return results.",
    "user_email": "user@example.com",
    "additional_context": "Using Chrome on macOS",
    "notify": true
  }'
```

### Input Schema

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `issue_text` | string | Yes | The user's issue description (min 10 chars) |
| `user_email` | string | No | Email of the submitter |
| `additional_context` | string | No | Any additional context |
| `owner` | string | No | GitHub repository owner (default: mchestr) |
| `repo` | string | No | GitHub repository name (default: homerp) |
| `notify` | boolean | No | Send Pushover notification (default: false) |

### Output

The workflow returns the created GitHub issue:

```json
{
  "issue_number": 42,
  "issue_url": "https://github.com/mchestr/homerp/issues/42",
  "title": "[Feature] Improve inventory search performance for large collections"
}
```

## Flow Steps

1. **parse_input** - Validates and normalizes input
2. **fetch_repo_metadata** (parallel branch)
   - **get_labels** - Fetches existing labels from GitHub
3. **ai_categorize** - Calls OpenAI GPT-4o to analyze and categorize
4. **process_labels** - Determines which labels exist vs need creation
5. **handle_labels** (conditional branch)
   - **create_labels_loop** - Creates missing labels in parallel
6. **create_github_issue** - Creates the formatted issue
7. **send_notification** (conditional branch)
   - **send_pushover** - Sends notification if enabled

## Customization

### Changing Categories

Edit the `ai_categorize` module's system prompt to modify:
- Category definitions
- Title format guidelines
- Priority guidelines

### Adding Label Types

Edit the `process_labels` module to add more automatic labels based on category or priority.

## Development

### Syncing Changes

Push to Windmill:
```bash
wmill sync push
```

Pull from Windmill:
```bash
wmill sync pull
```
