# Razorpay Payment Setup

The eKatRaa backend creates Razorpay orders for advance payments. **Razorpay credentials must be configured in the backend**, not in the mobile app.

## Quick Fix: Use Local Backend for Testing

If payment fails with "Endpoint not found" or "Payment setup failed":

1. **Run the backend locally:** In `ekatraa_backend`, run `npm run dev`
2. **Point the app to local backend:** In `ekatraa/.env`, set:
   - iOS/Web: `EXPO_PUBLIC_API_URL=http://localhost:3000`
   - Android emulator: `EXPO_PUBLIC_API_URL=http://10.0.2.2:3000`
3. **Restart the Expo app** so it picks up the new API URL
4. Payment will use Razorpay credentials from `ekatraa_backend/.env.local`

## Where to Add Credentials

### 1. Local Development (`.env.local`)

Add to `ekatraa_backend/.env.local`:

```
RAZORPAY_KEY_ID=rzp_test_xxxxx    # or rzp_live_xxxxx for production
RAZORPAY_KEY_SECRET=your_secret
```

### 2. Vercel Deployment (Required for Production)

If your backend is deployed at `https://ekatraa-backend.vercel.app`, you **must** add these environment variables in Vercel:

1. Go to [Vercel Dashboard](https://vercel.com) → Your Project (ekatraa_backend)
2. **Settings** → **Environment Variables**
3. Add:
   - `RAZORPAY_KEY_ID` = your Razorpay Key ID (e.g. `rzp_live_xxx` or `rzp_test_xxx`)
   - `RAZORPAY_KEY_SECRET` = your Razorpay Key Secret
4. Select **Production** (and Preview if needed)
5. **Redeploy** the project (Deployments → ⋮ → Redeploy) for changes to take effect

> ⚠️ **Important:** `.env.local` is not deployed to Vercel. Environment variables must be set in the Vercel project settings. After adding env vars, you must redeploy.

## Flow

1. **App** → calls `POST /api/public/payment/create-order` with `{ cart_id, user_id }`
2. **Backend** → uses `RAZORPAY_KEY_ID` + `RAZORPAY_KEY_SECRET` to create a Razorpay order
3. **Backend** → returns `{ razorpay_order_id, amount, key }` to the app
4. **App** → opens Razorpay checkout UI with the order details
5. **User** → completes payment
6. **App** → calls `POST /api/public/payment/verify` with payment details
7. **Backend** → verifies signature and creates the order in the database

## Troubleshooting

- **"Payment setup failed" / "Razorpay not configured"** → Add `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` to Vercel environment variables and redeploy
- **"Cart not found"** → Ensure the cart exists and has items
- **"Payment verification failed"** → Signature mismatch; ensure the same `RAZORPAY_KEY_SECRET` is used for create-order and verify
