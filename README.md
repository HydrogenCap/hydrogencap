# TenureIQ — Property Intelligence Platform

> **Package manager:** `bun` is the canonical package manager (see `bun.lock`). `npm install` requires `--legacy-peer-deps` because several UI deps (vaul, react-day-picker, cmdk, react-leaflet, etc.) still declare React 18 peer ranges while the app runs on React 19.


Property intelligence platform for UK HMO landlords and investors. Track compliance, rent collection, lending, and portfolio performance in one place.

🌐 **[tenureiq.com](https://tenureiq.com)**

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Shadcn/ui
- **Backend**: Supabase (Postgres, Auth, Edge Functions, Storage)
- **Payments**: Stripe
- **Maps**: Google Maps, Leaflet / OpenStreetMap
- **AI**: Lovable AI Gateway (Gemini, GPT)
- **Monitoring**: Sentry

## Local Development

```sh
# 1. Clone the repo
git clone <YOUR_GIT_URL>
cd <YOUR_PROJECT_NAME>

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env
# Fill in your Supabase URL, anon key, and project ID

# 4. Start dev server
npm run dev
```

## Edge Functions

Edge functions live in `supabase/functions/`. They are deployed automatically via Lovable Cloud. Shared utilities are in `supabase/functions/_shared/`.

## Project Structure

```
src/
├── components/     # UI components (Shadcn + custom)
├── contexts/       # React contexts (Auth, Theme, Subscription)
├── hooks/          # Data-fetching hooks (React Query + Supabase)
├── lib/            # Utilities, schemas, wizard configs
├── pages/          # Route-level page components
└── integrations/   # Auto-generated Supabase client & types
```

## License

Proprietary — © Oxygen Management Ltd
