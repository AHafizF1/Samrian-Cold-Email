# Development Guide

Quick reference for common development tasks.

## Daily Development

### Starting Development

```bash
# Terminal 1: Start Convex backend
bunx convex dev

# Terminal 2: Start Next.js
bun dev
```

### Code Quality

```bash
# Format all files
bun run format

# Check formatting without changes
bun run format:check

# Lint code
bun run lint

# Type check
bun run type-check

# Run all checks
bun run validate
```

## Testing

### Run All Tests

```bash
bun test
```

### Run Specific Tests

```bash
# Integration tests
bunx convex run test/integrationTest:runTests

# Spintax tests
bunx convex run test/spintaxTest:runTests
```

## Database

### View Data

Use Convex Dashboard: https://dashboard.convex.dev

### Schema Changes

1. Edit `convex/schema.ts`
2. Convex dev server auto-detects changes
3. Types regenerate automatically in `convex/_generated/`

### Migrations

For breaking schema changes, see `docs/MIGRATIONS.md` (when needed)

## Common Tasks

### Add New Query

```typescript
// convex/queries/resource.ts
import { query } from "../_generated/server";
import { v } from "convex/values";
import { requireOrgAccess } from "../lib/auth";

export const list = query({
  args: {},
  returns: v.array(
    v.object({
      /* ... */
    })
  ),
  handler: async (ctx) => {
    const { orgId } = await requireOrgAccess(ctx, { resource: ["read"] });

    return await ctx.db
      .query("resources")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();
  },
});
```

### Add New Mutation

```typescript
// convex/mutations/resource.ts
import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { requireOrgAccess, verifyOrgOwnership } from "../lib/auth";

export const update = mutation({
  args: {
    id: v.id("resources"),
    name: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { orgId } = await requireOrgAccess(ctx, { resource: ["update"] });

    const resource = await ctx.db.get(args.id);
    await verifyOrgOwnership(resource, orgId, "Resource");

    await ctx.db.patch(args.id, { name: args.name });
    return null;
  },
});
```

### Add Validation

```typescript
// convex/lib/validators.ts
export const RESOURCE_STATUSES = ["active", "inactive"] as const;
export type ResourceStatus = (typeof RESOURCE_STATUSES)[number];

export function isValidResourceStatus(status: string): status is ResourceStatus {
  return RESOURCE_STATUSES.includes(status as ResourceStatus);
}
```

## Debugging

### Convex Logs

```bash
# View logs in terminal
bunx convex dev

# Or in dashboard
https://dashboard.convex.dev
```

### Console Logging

```typescript
// In Convex functions
console.log("Debug:", value);
console.error("Error:", error);
```

### TypeScript Errors

```bash
# Check types
bun run type-check

# Regenerate Convex types
bunx convex dev
```

## Deployment

### Deploy Convex

```bash
bunx convex deploy --prod
```

### Deploy Next.js

```bash
# Vercel
vercel deploy --prod

# Or push to main branch (if auto-deploy configured)
git push origin main
```

## Troubleshooting

### "Module not found" errors

```bash
bun install
bunx convex dev  # Regenerate types
```

### Auth not working

- Check `.env.local` has all required variables
- Verify Better Auth configuration
- Check user has active organization

### Database query issues

- Check indexes in `convex/schema.ts`
- Verify orgId filtering
- Use Convex dashboard to inspect data

### Type errors after schema change

```bash
bunx convex dev  # Regenerates types
```

## Performance Tips

### Query Optimization

- Use indexes for filtering
- Limit results with `.take(n)`
- Paginate large datasets

### Mutation Optimization

- Batch operations when possible
- Use `bulkCreate` / `bulkAssign` for multiple items
- Avoid N+1 queries

## Security Checklist

- [ ] All mutations check `requireOrgAccess()`
- [ ] Resources verified with `verifyOrgOwnership()`
- [ ] Input validated before database operations
- [ ] Sensitive data not logged
- [ ] Permissions checked for each operation

## Resources

- [Convex Docs](https://docs.convex.dev)
- [Next.js Docs](https://nextjs.org/docs)
- [Better Auth Docs](https://better-auth.com)
- [Project README](../README.md)
- [Contributing Guide](../CONTRIBUTING.md)
