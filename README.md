# Vizion - AI-Powered Thumbnail Generator

Create stunning YouTube thumbnails and social media covers with AI. Professional thumbnail generator powered by Google's Gemini 3 Pro Image model.

## Technologies

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS
- Supabase (Auth, Database, Storage, Edge Functions)
- Google Gemini API (Image Generation)
- Stripe (Subscriptions)

## Getting Started

### Prerequisites

- Node.js & npm - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)
- A Supabase project
- A Google Cloud account with Gemini API access
- A Stripe account (for subscriptions)

### Installation

1. Clone the repository:

```sh
git clone <YOUR_GIT_URL>
cd visual-creator-pro
```

2. Install dependencies:

```sh
npm install
```

3. Set up environment variables:

```sh
cp .env.example .env
```

Edit `.env` with your configuration values.

4. Set up Supabase:

```sh
# Link to your Supabase project
npx supabase link --project-ref YOUR_PROJECT_ID

# Push database migrations
npx supabase db push

# Deploy edge functions
npx supabase functions deploy
```

5. Start the development server:

```sh
npm run dev
```

## Environment Variables

See `.env.example` for all required environment variables.

### Frontend (Vite)

- `VITE_SUPABASE_URL` - Your Supabase project URL
- `VITE_SUPABASE_PUBLISHABLE_KEY` - Your Supabase anon/public key

### Supabase Edge Functions

Set these in your Supabase dashboard under Settings > Edge Functions:

- `GEMINI_API_KEY` - Google Gemini API key
- `STRIPE_SECRET_KEY` - Stripe secret key (production/live mode)
- `STRIPE_TEST_SECRET_KEY` - Stripe test secret key (for localhost testing, optional but recommended)

**Note:** When running on localhost, the app automatically uses test mode:
- Frontend uses test Price IDs when `import.meta.env.DEV` is true or hostname is localhost
- Edge Functions use `STRIPE_TEST_SECRET_KEY` when the request origin is localhost
- If `STRIPE_TEST_SECRET_KEY` is not set, functions fall back to `STRIPE_SECRET_KEY`

### Testing Stripe Sandbox

1. Set `STRIPE_TEST_SECRET_KEY` in Supabase Dashboard > Edge Functions > Secrets
2. Update test Price IDs in `src/pages/Profile.tsx` (testPlans array) or set environment variables:
   - `VITE_STRIPE_TEST_STARTER_MONTHLY`
   - `VITE_STRIPE_TEST_STARTER_YEARLY`
   - `VITE_STRIPE_TEST_PRO_MONTHLY`
   - `VITE_STRIPE_TEST_PRO_YEARLY`
   - `VITE_STRIPE_TEST_ENTERPRISE_MONTHLY`
   - `VITE_STRIPE_TEST_ENTERPRISE_YEARLY`
3. Run `npm run dev` - the app will automatically use test mode on localhost
4. Use Stripe test card `4242 4242 4242 4242` for testing checkout

## Deployment

You can deploy this project to any static hosting service that supports Vite:

- Vercel
- Netlify
- Cloudflare Pages
- GitHub Pages

Make sure to set the environment variables in your hosting provider's dashboard.

## License

MIT
