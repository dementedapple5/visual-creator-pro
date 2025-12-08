# Stripe Product Sync Script

This script syncs Stripe products and prices from Live mode to Test mode, so you don't have to manually recreate them.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables. You can either:

   **Option A: Use a `.env` file** (recommended)
   ```bash
   STRIPE_LIVE_SECRET_KEY=sk_live_...
   STRIPE_TEST_SECRET_KEY=sk_test_...
   ```

   **Option B: Pass them as environment variables**
   ```bash
   STRIPE_LIVE_SECRET_KEY=sk_live_... STRIPE_TEST_SECRET_KEY=sk_test_... npm run sync-stripe
   ```

## Usage

Run the sync script:
```bash
npm run sync-stripe
```

The script will:
1. Fetch all active products and their prices from Live mode
2. Create them in Test mode (or update if they already exist)
3. Display a summary with all the new Test Price IDs

## What it does

- ✅ Fetches all active products from Live Stripe
- ✅ Fetches all prices for each product
- ✅ Creates products in Test mode with the same name, description, images, and metadata
- ✅ Creates prices in Test mode with the same amounts and billing intervals
- ✅ Skips products that already exist (but will add missing prices)
- ✅ Provides a summary of all created Price IDs for easy copying

## After Running

1. Copy the Price IDs from the summary output
2. Update `src/pages/Profile.tsx` with the new test Price IDs:
   - Replace `priceId` (monthly) values
   - Replace `yearlyPriceId` values
   - Update `productId` values if needed

## Notes

- The script only syncs **active** products and prices
- Products are matched by name (case-sensitive)
- Prices are matched by amount, currency, and interval
- If a product already exists, only missing prices will be created
- All metadata and product details are preserved

