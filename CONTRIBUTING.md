# Contributing Guide

Thank you for contributing to the Cold Email Campaign Platform!

## Development Setup

1. Fork and clone the repository
2. Install dependencies: `bun install`
3. Copy `.env.example` to `.env.local` and configure
4. Start Convex: `bunx convex dev`
5. Start Next.js: `bun dev`

## Code Standards

### TypeScript

- Use strict TypeScript
- Avoid `any` types - use proper typing
- Export types for reusable interfaces

### Naming Conventions

- **Files**: camelCase for utilities, PascalCase for components
- **Functions**: camelCase (e.g., `getUserData`)
- **Components**: PascalCase (e.g., `CampaignCard`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `MAX_RETRIES`)
- **Types/Interfaces**: PascalCase (e.g., `CampaignStatus`)

### Code Organization

#### Convex Functions

```typescript
// queries/campaigns.ts
export const list = query({
  args: {
    /* ... */
  },
  returns: v.array(/* ... */),
  handler: async (ctx, args) => {
    // 1. Authentication
    const { orgId } = await requireOrgAccess(ctx, { campaign: ["read"] });

    // 2. Validation (if needed)

    // 3. Database query
    return await ctx.db
      .query("campaigns")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();
  },
});
```

#### Mutations Pattern

```typescript
export const update = mutation({
  args: {
    /* ... */
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // 1. Authentication & authorization
    const { orgId } = await requireOrgAccess(ctx, { resource: ["update"] });

    // 2. Fetch and verify ownership
    const resource = await ctx.db.get(args.id);
    await verifyOrgOwnership(resource, orgId, "Resource");

    // 3. Validate input
    if (!isValidStatus(args.status)) {
      throw new Error("Invalid status");
    }

    // 4. Perform update
    await ctx.db.patch(args.id, { status: args.status });
    return null;
  },
});
```

### DRY Principle

Follow the Rule of Three:

- **Wait for 3+ instances** before extracting shared code
- **Single source of truth** for constants and config
- **Don't couple unrelated code** just because it looks similar
- **Prefer readability** over premature abstraction

### Error Handling

```typescript
// Good: Descriptive error messages
throw new Error("Campaign not found");
throw new Error(`Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`);

// Bad: Generic errors
throw new Error("Error");
throw new Error("Invalid input");
```

### Validation

Use shared validators from `convex/lib/validators.ts`:

```typescript
import { isValidEmail, CAMPAIGN_STATUSES } from "../lib/validators";

// Use validators
if (!isValidEmail(email)) {
  throw new Error(`Invalid email format: ${email}`);
}

// Use constants
if (!CAMPAIGN_STATUSES.includes(status)) {
  throw new Error(`Invalid status. Must be one of: ${CAMPAIGN_STATUSES.join(", ")}`);
}
```

## Testing

### Running Tests

```bash
# Integration tests
bunx convex run test/integrationTest:runTests

# Spintax tests
bunx convex run test/spintaxTest:runTests
```

### Writing Tests

Create internal test helpers that bypass auth:

```typescript
export const testHelper = internalMutation({
  args: {
    orgId: v.string(),
    // ... other args
  },
  handler: async (ctx, args) => {
    // Test logic without auth
  },
});
```

## Git Workflow

### Branch Naming

- `feature/description` - New features
- `fix/description` - Bug fixes
- `refactor/description` - Code refactoring
- `docs/description` - Documentation updates

### Commit Messages

Use [Conventional Commits](https://www.conventionalcommits.org/) format:

```
<type>: <short summary>

[optional body]
```

**Types:**

- `feat:` - New feature
- `fix:` - Bug fix
- `refactor:` - Code change that neither fixes a bug nor adds a feature
- `docs:` - Documentation only
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks

**Rules:**

- Keep subject line under 50 characters
- Use imperative mood ("add" not "added")
- Don't end subject with a period
- Separate subject from body with blank line
- Wrap body at 72 characters

### Pull Request Process

1. Create a feature branch
2. Make your changes
3. Run linting: `bun run lint`
4. Run tests: `bunx convex run test/integrationTest:runTests`
5. Update documentation if needed
6. Submit PR with clear description
7. Address review feedback

## Code Review Checklist

- [ ] Code follows project conventions
- [ ] TypeScript types are properly defined
- [ ] Error messages are descriptive
- [ ] Validation uses shared validators
- [ ] Auth checks are present in mutations
- [ ] Tests pass
- [ ] No console.logs left in code
- [ ] Documentation updated if needed

## Common Patterns

### Organization Verification

```typescript
const resource = await ctx.db.get(args.id);
await verifyOrgOwnership(resource, orgId, "Resource");
```

### Cascade Deletion

```typescript
await cascadeDeleteAssignments(ctx, "campaign", campaignId);
```

### Bulk Operations

```typescript
const success: Id<"table">[] = [];
const errors: { index: number; error: string }[] = [];

for (let i = 0; i < items.length; i++) {
  try {
    // Process item
    success.push(id);
  } catch (error) {
    errors.push({ index: i, error: error.message });
  }
}

return { success, errors };
```

## Questions?

Open an issue or reach out!
