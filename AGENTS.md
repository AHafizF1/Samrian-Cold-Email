# AI Agent Guide for Cold Email Campaign Platform

This guide helps AI agents understand the codebase architecture, patterns, and best practices when working on this project.

## Project Overview

**Type**: Cold email outreach platform  
**Stack**: Next.js 16 + Convex + Better Auth + TypeScript  
**Architecture**: Serverless backend with React frontend

## Critical Files to Read First

When starting any task, read these files in order:

1. `README.md` - Project setup and overview
2. `convex/schema.ts` - Database schema and relationships
3. `CONTRIBUTING.md` - Code standards and patterns
4. `docs/DEVELOPMENT.md` - Common development tasks

## Architecture Overview

### Backend (Convex)

```
convex/
├── queries/           # Read operations (no side effects)
├── mutations/         # Write operations (database changes)
├── actions/           # External API calls, non-deterministic operations
├── lib/               # Shared utilities
│   ├── auth.ts       # Authentication & authorization helpers
│   ├── validators.ts # Validation functions & constants
│   ├── types.ts      # Shared TypeScript types
│   ├── errors.ts     # Error classes
│   ├── env.ts        # Environment variables
│   └── spintax.ts    # Email template parser
├── test/              # Integration tests
└── schema.ts          # Database schema definition
```

### Frontend (Next.js)

```
src/
├── app/               # Next.js App Router pages
└── components/        # React components
```

## Database Schema

### Core Tables

**campaigns**

- Stores email campaigns
- Fields: `name`, `status`, `schedule`, `orgId`
- Indexes: `by_org`, `by_org_status`

**contacts**

- Stores contact information
- Fields: `email`, `customVars`, `timezone`, `bounceStatus`, `orgId`
- Indexes: `by_org`, `by_org_email`

**campaignContacts**

- Many-to-many relationship between campaigns and contacts
- Fields: `campaignId`, `contactId`, `status`, `currentStep`, `lastEmailSentAt`, `orgId`
- Indexes: `by_campaign`, `by_contact`, `by_org`

**mailboxes**

- Email sending accounts
- Fields: `email`, `provider`, `credentials`, `orgId`

### Relationships

- Campaign → CampaignContacts (one-to-many)
- Contact → CampaignContacts (one-to-many)
- Organization → All resources (one-to-many)

## Code Patterns & Standards

### 1. Authentication Pattern

**ALWAYS** use in mutations and queries:

```typescript
import { requireOrgAccess, verifyOrgOwnership } from "../lib/auth";

export const update = mutation({
  handler: async (ctx, args) => {
    // Step 1: Authenticate and get orgId
    const { orgId } = await requireOrgAccess(ctx, { resource: ["update"] });

    // Step 2: Fetch resource
    const resource = await ctx.db.get(args.id);

    // Step 3: Verify ownership
    await verifyOrgOwnership(resource, orgId, "Resource");

    // Step 4: Perform operation
    await ctx.db.patch(args.id, updates);
  },
});
```

### 2. Validation Pattern

**ALWAYS** use shared validators:

```typescript
import { isValidEmail, isValidCampaignStatus, CAMPAIGN_STATUSES } from "../lib/validators";

// Validate input
if (!isValidEmail(args.email)) {
  throw new Error(`Invalid email format: ${args.email}`);
}

if (!isValidCampaignStatus(args.status)) {
  throw new Error(`Invalid status. Must be one of: ${CAMPAIGN_STATUSES.join(", ")}`);
}
```

### 3. Cascade Deletion Pattern

**ALWAYS** use helper for cascade deletes:

```typescript
import { cascadeDeleteAssignments } from "../lib/auth";

export const remove = mutation({
  handler: async (ctx, args) => {
    const { orgId } = await requireOrgAccess(ctx, { campaign: ["delete"] });

    const campaign = await ctx.db.get(args.id);
    await verifyOrgOwnership(campaign, orgId, "Campaign");

    // Cascade delete assignments
    await cascadeDeleteAssignments(ctx, "campaign", args.id);

    // Delete the resource
    await ctx.db.delete(args.id);
    return null;
  },
});
```

### 4. Bulk Operations Pattern

**ALWAYS** return success and errors separately:

```typescript
export const bulkCreate = mutation({
  handler: async (ctx, args) => {
    const success: Id<"contacts">[] = [];
    const errors: { index: number; error: string }[] = [];

    for (let i = 0; i < args.items.length; i++) {
      try {
        // Validate and create
        const id = await ctx.db.insert("contacts", item);
        success.push(id);
      } catch (error) {
        errors.push({
          index: i,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return { success, errors };
  },
});
```

### 5. Query Pattern

```typescript
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

## DRY Principle (CRITICAL)

### Rule of Three

**NEVER** extract code until you see it 3+ times. Premature abstraction is worse than duplication.

### Existing Shared Utilities

**Auth Helpers** (`convex/lib/auth.ts`):

- `requireAuth()` - Verify user is authenticated
- `requireOrgAccess()` - Verify user has org access + permissions
- `verifyOrgOwnership()` - Verify resource belongs to org
- `cascadeDeleteAssignments()` - Delete related assignments

**Validators** (`convex/lib/validators.ts`):

- Constants: `CAMPAIGN_STATUSES`, `CONTACT_STATUSES`, `BOUNCE_STATUSES`, `VALID_DAYS`
- Email: `isValidEmail()`
- Timezone: `isValidTimezone()`
- Time: `isValidTimeFormat()`, `isStartBeforeEnd()`
- Status: `isValidCampaignStatus()`, `isValidContactStatus()`, `isValidBounceStatus()`
- Custom vars: `isValidCustomVars()`

**Types** (`convex/lib/types.ts`):

- All shared TypeScript types
- Import from here instead of duplicating

### When to Extract

✅ **DO extract when:**

- Same logic appears 3+ times
- Constants used in multiple files
- Validation logic repeated
- Error messages duplicated

❌ **DON'T extract when:**

- Only 2 instances exist
- Code is coincidentally similar but serves different purposes
- Abstraction would obscure meaning

## Error Handling

### Use Descriptive Errors

```typescript
// ✅ Good
throw new Error("Campaign not found");
throw new Error(`Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`);
throw new Error(`Contact with email ${email} already exists in organization`);

// ❌ Bad
throw new Error("Not found");
throw new Error("Invalid input");
throw new Error("Error");
```

### Error Classes (Optional)

For HTTP actions, use error classes from `convex/lib/errors.ts`:

```typescript
import { NotFoundError, ValidationError } from "../lib/errors";

throw new NotFoundError("Campaign");
throw new ValidationError("Invalid email format");
```

## Testing

### Running Tests

```bash
# All integration tests
bunx convex run test/integrationTest:runTests

# Spintax tests
bunx convex run test/spintaxTest:runTests
```

### Test Pattern

Tests use internal mutations/queries that bypass auth:

```typescript
export const testHelper = internalMutation({
  args: {
    orgId: v.string(),
    // ... other args
  },
  handler: async (ctx, args) => {
    // Test logic without auth checks
  },
});
```

**ALWAYS** run tests after making changes to mutations/queries.

## Common Tasks

### Adding a New Resource

1. **Update Schema** (`convex/schema.ts`)

   ```typescript
   resources: defineTable({
     name: v.string(),
     orgId: v.string(),
   }).index("by_org", ["orgId"]),
   ```

2. **Create Queries** (`convex/queries/resources.ts`)
   - `list` - List all for org
   - `get` - Get single by ID
   - Add specific queries as needed

3. **Create Mutations** (`convex/mutations/resources.ts`)
   - `create` - Create new resource
   - `update` - Update existing
   - `remove` - Delete (with cascade if needed)

4. **Add Validators** (`convex/lib/validators.ts`)
   - Constants for enums
   - Validation functions
   - Type guards

5. **Add Types** (`convex/lib/types.ts`)
   - Export Doc type
   - Export Id type
   - Add related types

6. **Write Tests** (`convex/test/`)
   - Create internal helpers
   - Test CRUD operations
   - Test validation
   - Test cascade deletion

### Modifying Existing Code

1. **Read the existing pattern** - Don't introduce new patterns
2. **Check for shared utilities** - Use existing helpers
3. **Follow DRY principle** - Extract only after 3+ instances
4. **Run tests** - Ensure nothing breaks
5. **Update types** - Keep TypeScript types in sync

## Security Checklist

Before submitting any mutation:

- [ ] Uses `requireOrgAccess()` for authentication
- [ ] Uses `verifyOrgOwnership()` for resource access
- [ ] Validates all input with shared validators
- [ ] Returns appropriate error messages
- [ ] Doesn't leak sensitive information in errors
- [ ] Handles cascade deletion if needed

## Performance Guidelines

### Query Optimization

- Use indexes for filtering (defined in schema)
- Limit results with `.take(n)` for large datasets
- Use `.first()` instead of `.collect()[0]`

### Mutation Optimization

- Batch operations when possible (use bulk mutations)
- Avoid N+1 queries (fetch related data in single query)
- Use transactions for related updates

## Debugging

### Convex Logs

```typescript
// In any Convex function
console.log("Debug:", value);
console.error("Error:", error);
```

View logs in:

- Terminal running `bunx convex dev`
- Convex Dashboard: https://dashboard.convex.dev

### Type Errors

If types are out of sync:

```bash
bunx convex dev  # Regenerates types in convex/_generated/
```

## File Naming Conventions

- **Queries**: `convex/queries/resourceName.ts`
- **Mutations**: `convex/mutations/resourceName.ts`
- **Actions**: `convex/actions/actionName.ts`
- **Utilities**: `convex/lib/utilityName.ts`
- **Tests**: `convex/test/featureNameTest.ts`

## Import Conventions

```typescript
// Convex framework
import { query, mutation, action } from "../_generated/server";
import { v } from "convex/values";
import { Id, Doc } from "../_generated/dataModel";

// Local utilities (alphabetical)
import { requireOrgAccess, verifyOrgOwnership } from "../lib/auth";
import { isValidEmail, CAMPAIGN_STATUSES } from "../lib/validators";
import { Campaign, CampaignId } from "../lib/types";
```

## Git Workflow

### Branch Naming

- `feature/description` - New features
- `fix/description` - Bug fixes
- `refactor/description` - Code refactoring
- `docs/description` - Documentation updates

### Commit Messages (IMPORTANT)

Use [Conventional Commits](https://www.conventionalcommits.org/) format:

```
<type>: <short summary>

[optional body]
```

**Types:**

- `feat:` - New feature
- `fix:` - Bug fix
- `refactor:` - Code restructuring (no behavior change)
- `docs:` - Documentation only
- `test:` - Adding or updating tests
- `chore:` - Maintenance (dependencies, config)

**Rules for Agents:**

1. Keep subject under 50 characters
2. Use imperative mood: "add" not "added" or "adds"
3. No period at end of subject
4. Separate subject from body with blank line
5. Body wraps at 72 characters
6. Body explains WHAT and WHY, not HOW

**Good Examples:**

```bash
# Simple feature
feat: add bulk contact import

# Bug fix with context
fix: resolve cascade deletion bug

When deleting campaigns, assignments were not removed.
Now uses cascadeDeleteAssignments helper.

# Refactoring with details
refactor: extract auth helpers

- Add verifyOrgOwnership function
- Add cascadeDeleteAssignments function
- Update mutations to use new helpers
- Eliminates 15+ duplicate code blocks
```

**Bad Examples (Avoid These):**

```bash
# ❌ Too vague
update code

# ❌ Wrong tense
feat: added bulk import

# ❌ Too long subject (>50 chars)
feat: add new feature that allows users to import contacts

# ❌ Multiple unrelated changes
feat: add feature and fix bug and update docs

# ❌ No type prefix
add bulk import
```

**When Making Multiple Changes:**

If changes are related, use one commit with bullet points:

```bash
feat: implement campaign management

- Add campaign CRUD operations
- Add validation for campaign status
- Add tests for campaign mutations
```

If changes are unrelated, make separate commits:

```bash
feat: add bulk contact import
fix: resolve timezone validation bug
docs: update API documentation
```

## When Stuck

1. **Check existing code** - Look for similar patterns
2. **Read documentation** - README, CONTRIBUTING, DEVELOPMENT
3. **Check schema** - Understand data relationships
4. **Run tests** - See what's expected
5. **Check Convex docs** - https://docs.convex.dev

## Quick Reference

### Most Used Files

- `convex/lib/auth.ts` - Auth helpers
- `convex/lib/validators.ts` - Validation
- `convex/lib/types.ts` - TypeScript types
- `convex/schema.ts` - Database schema

### Most Used Patterns

- Authentication: `requireOrgAccess()`
- Ownership verification: `verifyOrgOwnership()`
- Cascade deletion: `cascadeDeleteAssignments()`
- Validation: Use functions from `validators.ts`

### Most Common Mistakes to Avoid

- ❌ Skipping auth checks in mutations
- ❌ Not verifying resource ownership
- ❌ Hardcoding validation logic instead of using validators
- ❌ Extracting code before 3+ instances (Rule of Three)
- ❌ Not running tests after changes
- ❌ Using `any` type instead of proper typing

## Success Criteria

Code is ready when:

- ✅ All tests pass
- ✅ TypeScript compiles with no errors
- ✅ Follows existing patterns
- ✅ Uses shared utilities
- ✅ Has proper auth checks
- ✅ Validates all input
- ✅ Has descriptive error messages
- ✅ Doesn't introduce new patterns unnecessarily

## Pre-Commit Checklist (MANDATORY)

Before committing, **ALWAYS** run these checks in order:

### 1. Format Code

```bash
bun run format
```

Auto-fixes formatting issues using Prettier.

### 2. Type Check

```bash
bun run type-check
```

Ensures TypeScript compiles without errors.

### 3. Lint Code

```bash
bun run lint
```

Checks for code quality issues.

### 4. Run Tests

```bash
bun test
```

Verifies all integration tests pass.

### 5. Run All Checks (Shortcut)

```bash
bun run validate
```

Runs type-check + lint + format:check in one command.

### Complete Pre-Commit Workflow

```bash
# Step 1: Format code
bun run format

# Step 2: Run all validation checks
bun run validate

# Step 3: Run tests
bun test

# Step 4: Stage changes
git add .

# Step 5: Commit with proper message
git commit -m "feat: add feature description"
```

### If Any Check Fails

**Type errors:**

- Check `convex/_generated/` files exist
- Run `bunx convex dev` to regenerate types
- Fix TypeScript errors in your code

**Lint errors:**

- Run `bun run lint --fix` to auto-fix
- Manually fix remaining issues

**Test failures:**

- Read error messages carefully
- Fix the failing code
- Re-run tests until they pass

**Format issues:**

- Run `bun run format` to auto-fix
- Should never fail after formatting

### Never Commit If:

- ❌ Type check fails
- ❌ Tests fail
- ❌ Lint has errors (warnings are okay)
- ❌ Code isn't formatted

### Cross-Platform Note

**PowerShell 5.1 users (Windows):**

- Scripts use `;` instead of `&&` for compatibility
- Consider upgrading to PowerShell 7+ for better experience
- Install: `winget install Microsoft.PowerShell`

**PowerShell 7+ / Bash users:**

- All scripts work natively
- `&&` operator supported

---

**Remember**: Consistency is more important than perfection. Follow existing patterns even if you think there's a "better" way. Refactoring can come later with proper discussion.
