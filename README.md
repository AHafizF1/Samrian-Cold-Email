# Cold Email Campaign Platform

A modern cold email outreach platform built with Next.js, Convex, and Better Auth.

## Tech Stack

- **Frontend**: Next.js 16 (App Router), React 19, Tailwind CSS
- **Backend**: Convex (serverless backend)
- **Auth**: Better Auth with organization support
- **Language**: TypeScript

## Prerequisites

- Node.js 20+ or Bun
- Convex account ([convex.dev](https://convex.dev))

## Getting Started

### 1. Install Dependencies

```bash
bun install
# or
npm install
```

### 2. Set Up Environment Variables

Copy the example environment file:

```bash
cp .env.example .env.local
```

Fill in your environment variables:

- `CONVEX_DEPLOYMENT` - Your Convex deployment URL
- `NEXT_PUBLIC_CONVEX_URL` - Your public Convex URL
- Better Auth configuration variables

### 3. Run Convex Backend

In a separate terminal, start the Convex development server:

```bash
bunx convex dev
```

This will:

- Start the local Convex backend
- Watch for schema changes
- Generate TypeScript types

### 4. Run Next.js Development Server

```bash
bun dev
# or
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see your app.

## Project Structure

```
├── convex/                 # Convex backend
│   ├── actions/           # External API calls
│   ├── mutations/         # Database writes
│   ├── queries/           # Database reads
│   ├── lib/               # Shared utilities
│   │   ├── auth.ts       # Auth helpers
│   │   ├── validators.ts # Validation functions
│   │   └── spintax.ts    # Email template parser
│   ├── test/              # Integration tests
│   └── schema.ts          # Database schema
├── src/
│   ├── app/               # Next.js app router
│   └── components/        # React components
└── lib/                   # Frontend utilities
```

## Core Features

### Campaign Management

- Create and manage email campaigns
- Schedule sending windows
- Track campaign status (draft, active, paused, completed)

### Contact Management

- Import contacts (single or bulk)
- Custom variables for personalization
- Bounce status tracking
- Timezone support

### Email Personalization

- Spintax support for variations: `{Hi|Hello|Hey}`
- Variable replacement: `{{firstName}}`
- Template preview

## Development

### Running Tests

```bash
# Run integration tests
bunx convex run test/integrationTest:runTests

# Run spintax tests
bunx convex run test/spintaxTest:runTests
```

### Code Quality

```bash
# Lint code
bun run lint

# Type check
bunx tsc --noEmit

# Format code (when prettier is set up)
bun run format
```

### Database Schema

The schema is defined in `convex/schema.ts`. Key tables:

- `campaigns` - Email campaigns
- `contacts` - Contact database
- `campaignContacts` - Campaign-contact assignments
- `mailboxes` - Email sending accounts

### Authentication

Uses Better Auth with:

- Email/password authentication
- Organization support
- Role-based permissions
- Session management

## API Documentation

### Queries (Read Operations)

**Campaigns**

- `campaigns:list` - List all campaigns for org
- `campaigns:get` - Get single campaign
- `campaigns:getByStatus` - Filter by status

**Contacts**

- `contacts:list` - List all contacts
- `contacts:get` - Get single contact
- `contacts:search` - Search by email

**Assignments**

- `campaignContacts:listByCampaign` - Get campaign contacts
- `campaignContacts:getCampaignStats` - Get campaign statistics

### Mutations (Write Operations)

**Campaigns**

- `campaigns:create` - Create new campaign
- `campaigns:update` - Update campaign details
- `campaigns:updateStatus` - Change campaign status
- `campaigns:remove` - Delete campaign (cascades)

**Contacts**

- `contacts:create` - Create single contact
- `contacts:bulkCreate` - Import multiple contacts
- `contacts:update` - Update contact
- `contacts:remove` - Delete contact (cascades)

**Assignments**

- `campaignContacts:assign` - Assign contact to campaign
- `campaignContacts:bulkAssign` - Assign multiple contacts
- `campaignContacts:updateStatus` - Update assignment status
- `campaignContacts:unassign` - Remove assignment

## Environment Variables

Required variables:

```env
# Convex
CONVEX_DEPLOYMENT=your-deployment
NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud

# Better Auth
BETTER_AUTH_SECRET=your-secret-key
BETTER_AUTH_URL=http://localhost:3000
```

## Contributing

1. Create a feature branch from `main`
2. Make your changes
3. Run tests and linting
4. Submit a pull request

## Deployment

### Convex

```bash
bunx convex deploy
```

### Next.js (Vercel)

```bash
vercel deploy
```

Or connect your GitHub repo to Vercel for automatic deployments.

## Troubleshooting

### Convex connection issues

- Ensure `bunx convex dev` is running
- Check your `.env.local` has correct URLs
- Verify you're logged in: `bunx convex login`

### Type errors

- Regenerate types: `bunx convex dev` (it auto-generates)
- Check `convex/_generated/` files are present

### Auth issues

- Verify Better Auth environment variables
- Check organization is set in session
- Ensure user has required permissions

## License

Private - All rights reserved
