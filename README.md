# StillPoor

StillPoor is a Bitcoin-powered collaborative pixel board where people can claim a Block, create pixel art, and optionally preserve versions as Ordinals.

## Current status

StillPoor is in development.

- Bitcoin payments run on **Signet**
- Mainnet payments are intentionally disabled
- Signet claims use a low test price
- Ordinal inscription flows are still simulated
- Production can display the Coming Soon page

## Board

- Board size: `1024 × 1024` pixels
- Grid: `64 × 64` Blocks
- Total: `4096` Blocks
- Each Block contains `16 × 16` editable pixels

## Stack

- Next.js
- React
- TypeScript
- Tailwind CSS
- Supabase
- Xverse through Sats Connect
- Vercel

## Local development

### Requirements

- Node.js
- npm
- Supabase CLI
- Docker Desktop for local Supabase workflows
- Xverse for wallet and payment testing

### Install

```bash
npm install
```

### Environment

Keep the project environment values in `.env.local`.

The Supabase clients define the required variables in:

```text
app/lib/supabase/browserClient.ts
app/lib/supabase/serverClient.ts
```

The site display mode uses:

```text
SITE_MODE
```

Use `coming_soon` for the public landing page. Any other configured development value displays the application.

Never commit `.env.local` or Supabase secret keys.

### Apply database migrations

```bash
npx supabase db push
```

### Start development

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

## Commands

```bash
npm run dev
npm run build
npm run start
npm run lint
```

## Bitcoin payments

The active payment network, receiver address, explorer and mempool API are centralised in the payment configuration.

The active development network is currently:

```text
Signet
```

Mainnet must remain disabled until the receiver address has been verified and the complete payment and security review has been completed.

## Mainnet pricing

The official Block pricing model is:

- Starting price: `100,000 sats`
- Increase: `10,000 sats` every `100` Blocks sold
- Maximum price: `500,000 sats` per Block

Signet uses a separate low test amount and does not modify the official Mainnet pricing positions.

## Safety

Before enabling Mainnet, review:

- wallet authentication
- payment verification
- receiving addresses
- Supabase permissions and RLS
- API route authentication
- reservation and concurrent purchase handling
- user data protection
- production environment variables

## Deployment

The project is deployed with Vercel.

Production domain:

```text
stillpoor.place
```
