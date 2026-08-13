# Samrian MCP

Agent-safe stdio access to Samrian through the stable `/api/v1` contract.

## Configuration

Required environment:

```text
SAMRIAN_URL=https://your-samrian.example
SAMRIAN_TOKEN=organization-owned-api-key
MCP_MODE=read-only
```

`MCP_MODE` defaults to `read-only`. Set it to `operator` to add contact import/update, group
create/update, campaign draft create/update, mailbox checks, and domain checks. API-key scopes are
still enforced by Samrian. Operator mode does not grant permissions.

Use a separate API key for each MCP client. Keep host tool-call approval enabled. Never pass the
token in command arguments or commit it to config templates.

## Run

From source:

```text
bun packages/mcp/src/stdio.ts
```

After package publication:

```text
npx -y @samrian/mcp
```

## Claude Desktop And Cursor

Windows configuration uses an absolute Windows path:

```json
{
  "mcpServers": {
    "samrian": {
      "command": "bun",
      "args": ["C:\\path\\to\\Samrian-Cold-Email\\packages\\mcp\\src\\stdio.ts"],
      "env": {
        "SAMRIAN_URL": "https://your-samrian.example",
        "SAMRIAN_TOKEN": "your-scoped-key",
        "MCP_MODE": "read-only"
      }
    }
  }
}
```

On macOS or Linux, use `/absolute/path/to/Samrian-Cold-Email/packages/mcp/src/stdio.ts`. Claude
Desktop and Cursor use the same stdio server object, though each host stores it in its own config
file.

## Codex

Add to Codex config:

```toml
[mcp_servers.samrian]
command = "bun"
args = ["/absolute/path/to/Samrian-Cold-Email/packages/mcp/src/stdio.ts"]
env = { SAMRIAN_URL = "https://your-samrian.example", SAMRIAN_TOKEN = "your-scoped-key", MCP_MODE = "read-only" }
```

Use the escaped Windows path form when running Codex on Windows.

## Safety

Campaign launch, direct send, inbox reply, blocklist mutation, mailbox credentials, deletion, and
API-key management are absent. Contact and inbox values are returned as untrusted external content,
never instructions. Lists are bounded to 100 records and never auto-follow cursors.

Streamable HTTP is not enabled. Remote OAuth belongs with a future remote transport security
milestone. Better Auth must use its OAuth Provider rather than the deprecated MCP plugin. WorkOS
remote mode must use AuthKit resource indicators and exact audience validation. MCP access tokens
must never be passed through as Samrian API tokens.

## Verification

```text
bun run mcp:build
bun run mcp:smoke
npx @modelcontextprotocol/inspector bun packages/mcp/src/stdio.ts
```
