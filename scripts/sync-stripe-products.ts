#!/usr/bin/env node
/**
 * Script to sync Stripe products and prices from Live mode to Test mode
 * 
 * Usage:
 *   STRIPE_LIVE_SECRET_KEY=sk_live_... STRIPE_TEST_SECRET_KEY=sk_test_... npm run sync-stripe
 * 
 * Or set them in your .env file and the script will read them automatically
 */

import Stripe from 'stripe';
import dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables from .env file if it exists
const envPath = path.join(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const LIVE_KEY = process.env.STRIPE_LIVE_SECRET_KEY || process.env.STRIPE_SECRET_KEY;
const TEST_KEY = process.env.STRIPE_TEST_SECRET_KEY;

if (!LIVE_KEY) {
  console.error('❌ Error: STRIPE_LIVE_SECRET_KEY or STRIPE_SECRET_KEY environment variable is required');
  console.error('   Please set it in your .env file or as an environment variable');
  process.exit(1);
}

if (!TEST_KEY) {
  console.error('❌ Error: STRIPE_TEST_SECRET_KEY environment variable is required');
  console.error('   Please set it in your .env file or as an environment variable');
  process.exit(1);
}

// Validate keys
if (!LIVE_KEY.startsWith('sk_live_') && !LIVE_KEY.startsWith('sk_test_')) {
  console.warn('⚠️  Warning: LIVE_KEY does not start with sk_live_ or sk_test_');
  console.warn('   Make sure you are using the correct live mode key');
}

if (!TEST_KEY.startsWith('sk_test_')) {
  console.error('❌ Error: TEST_KEY must start with sk_test_');
  console.error('   Make sure you are using a test mode key');
  process.exit(1);
}

const liveStripe = new Stripe(LIVE_KEY, {
  apiVersion: '2025-08-27.basil',
});

const testStripe = new Stripe(TEST_KEY, {
  apiVersion: '2025-08-27.basil',
});

interface ProductWithPrices {
  product: Stripe.Product;
  prices: Stripe.Price[];
}

async function fetchLiveProducts(): Promise<ProductWithPrices[]> {
  console.log('📦 Fetching products from Live mode...\n');
  
  const products: ProductWithPrices[] = [];
  let hasMore = true;
  let startingAfter: string | undefined;

  while (hasMore) {
    const response = await liveStripe.products.list({
      limit: 100,
      starting_after: startingAfter,
      active: true, // Only fetch active products
    });

    for (const product of response.data) {
      // Fetch prices for this product
      const prices = await liveStripe.prices.list({
        product: product.id,
        active: true,
      });

      if (prices.data.length > 0) {
        products.push({
          product,
          prices: prices.data,
        });
      }
    }

    hasMore = response.has_more;
    if (hasMore && response.data.length > 0) {
      startingAfter = response.data[response.data.length - 1].id;
    }
  }

  console.log(`✅ Found ${products.length} products with prices\n`);
  return products;
}

interface CreatedPrice {
  productName: string;
  productId: string;
  priceId: string;
  interval: string;
  amount: number;
  currency: string;
}

const createdPrices: CreatedPrice[] = [];

async function createTestProduct(productWithPrices: ProductWithPrices): Promise<CreatedPrice[]> {
  const { product, prices } = productWithPrices;
  const newPrices: CreatedPrice[] = [];

  console.log(`\n🔄 Processing: ${product.name} (${product.id})`);

  // Check if product already exists in test mode
  try {
    const existingProducts = await testStripe.products.search({
      query: `name:'${product.name}' AND active:'true'`,
      limit: 1,
    });

    if (existingProducts.data.length > 0) {
      const existingProduct = existingProducts.data[0];
      console.log(`   ⚠️  Product "${product.name}" already exists in test mode (${existingProduct.id})`);
      console.log(`   📋 Checking prices...`);

      // Check if all prices exist
      const existingPrices = await testStripe.prices.list({
        product: existingProduct.id,
        active: true,
      });

      const missingPrices = prices.filter(price => {
        return !existingPrices.data.some(ep => 
          ep.unit_amount === price.unit_amount &&
          ep.currency === price.currency &&
          ep.recurring?.interval === price.recurring?.interval
        );
      });

      if (missingPrices.length > 0) {
        console.log(`   ➕ Creating ${missingPrices.length} missing price(s)...`);
        for (const price of missingPrices) {
          const created = await createTestPrice(existingProduct.id, price, product.name);
          if (created) newPrices.push(created);
        }
      } else {
        console.log(`   ✅ All prices already exist`);
        // Collect existing prices for summary
        for (const price of existingPrices.data) {
          newPrices.push({
            productName: product.name,
            productId: existingProduct.id,
            priceId: price.id,
            interval: price.recurring?.interval || 'one-time',
            amount: price.unit_amount || 0,
            currency: price.currency,
          });
        }
      }
      return newPrices;
    }
  } catch (error) {
    // Search might fail, continue with creation
    console.log(`   ℹ️  Could not check for existing product, proceeding with creation...`);
  }

  // Create product in test mode
  console.log(`   ➕ Creating product...`);
  const testProduct = await testStripe.products.create({
    name: product.name,
    description: product.description || undefined,
    images: product.images.length > 0 ? product.images : undefined,
    metadata: product.metadata,
    active: product.active,
  });

  console.log(`   ✅ Created product: ${testProduct.id}`);

  // Create prices in test mode
  console.log(`   ➕ Creating ${prices.length} price(s)...`);
  for (const price of prices) {
    const created = await createTestPrice(testProduct.id, price, product.name);
    if (created) newPrices.push(created);
  }

  console.log(`   ✅ Completed: ${product.name}`);
  return newPrices;
}

async function createTestPrice(productId: string, price: Stripe.Price, productName: string): Promise<CreatedPrice | null> {
  try {
    const priceData: Stripe.PriceCreateParams = {
      product: productId,
      unit_amount: price.unit_amount,
      currency: price.currency,
      active: price.active,
      metadata: price.metadata,
    };

    if (price.recurring) {
      priceData.recurring = {
        interval: price.recurring.interval,
        interval_count: price.recurring.interval_count,
        usage_type: price.recurring.usage_type,
      };
    } else {
      priceData.currency = price.currency;
    }

    const testPrice = await testStripe.prices.create(priceData);
    
    const interval = price.recurring?.interval || 'one-time';
    const amount = price.unit_amount ? `$${(price.unit_amount / 100).toFixed(2)}` : 'N/A';
    console.log(`      ✅ Created ${interval} price: ${testPrice.id} (${amount} ${price.currency})`);
    
    return {
      productName,
      productId,
      priceId: testPrice.id,
      interval,
      amount: price.unit_amount || 0,
      currency: price.currency,
    };
  } catch (error: any) {
    console.error(`      ❌ Failed to create price: ${error.message}`);
    throw error;
  }
}

async function main() {
  try {
    console.log('🚀 Starting Stripe product sync from Live to Test mode\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Fetch products from live mode
    const products = await fetchLiveProducts();

    if (products.length === 0) {
      console.log('⚠️  No products found in live mode. Nothing to sync.');
      return;
    }

    // Display summary
    console.log('📊 Products to sync:');
    products.forEach(({ product, prices }) => {
      const monthlyPrices = prices.filter(p => p.recurring?.interval === 'month');
      const yearlyPrices = prices.filter(p => p.recurring?.interval === 'year');
      console.log(`   • ${product.name}: ${monthlyPrices.length} monthly, ${yearlyPrices.length} yearly price(s)`);
    });
    console.log('');

    // Create products in test mode
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('🔄 Creating products in Test mode...\n');

    for (const productWithPrices of products) {
      const newPrices = await createTestProduct(productWithPrices);
      createdPrices.push(...newPrices);
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Sync completed successfully!');
    
    // Display summary of created prices
    if (createdPrices.length > 0) {
      console.log('\n📋 Summary of Test Mode Price IDs:\n');
      
      // Group by product
      const byProduct = createdPrices.reduce((acc, price) => {
        if (!acc[price.productName]) {
          acc[price.productName] = [];
        }
        acc[price.productName].push(price);
        return acc;
      }, {} as Record<string, CreatedPrice[]>);

      for (const [productName, prices] of Object.entries(byProduct)) {
        console.log(`   ${productName}:`);
        const monthly = prices.find(p => p.interval === 'month');
        const yearly = prices.find(p => p.interval === 'year');
        
        if (monthly) {
          console.log(`      Monthly: ${monthly.priceId} ($${(monthly.amount / 100).toFixed(2)})`);
        }
        if (yearly) {
          console.log(`      Yearly:  ${yearly.priceId} ($${(yearly.amount / 100).toFixed(2)})`);
        }
        console.log('');
      }
    }

    console.log('💡 Next steps:');
    console.log('   1. Copy the Price IDs above and update your Profile.tsx');
    console.log('   2. Or find them in your Stripe Dashboard (Test mode → Products)');
    console.log('   3. Make sure to update both monthly and yearly Price IDs\n');

  } catch (error: any) {
    console.error('\n❌ Error during sync:', error.message);
    if (error.type) {
      console.error(`   Stripe Error Type: ${error.type}`);
    }
    process.exit(1);
  }
}

main();

