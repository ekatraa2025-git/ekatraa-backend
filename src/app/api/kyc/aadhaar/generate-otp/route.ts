import { NextResponse } from 'next/server'

const SANDBOX_API_KEY = process.env.SANDBOX_API_KEY
const SANDBOX_API_SECRET = process.env.SANDBOX_API_SECRET
const SANDBOX_HOST = process.env.SANDBOX_HOST || 'https://api.sandbox.co.in'

export async function POST(req: Request) {
  // Handle CORS
  const origin = req.headers.get('origin')
  const corsHeaders = {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  }

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return new NextResponse(null, { status: 200, headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const { aadhaar_number } = body

    if (!aadhaar_number || aadhaar_number.length !== 12) {
      return NextResponse.json(
        { error: 'Valid 12-digit Aadhaar number is required' },
        { status: 400, headers: corsHeaders }
      )
    }

    if (!SANDBOX_API_KEY || !SANDBOX_API_SECRET) {
      return NextResponse.json(
        { error: 'Sandbox API credentials not configured' },
        { status: 500, headers: corsHeaders }
      )
    }

    // Sandbox API authentication - using API key in header
    // Note: If Authorization token is required, it should be obtained separately
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-api-key': SANDBOX_API_KEY,
      'x-api-version': '1.0.0',
    };

    // Add Authorization header if access token is available (set via env var)
    const accessToken = process.env.SANDBOX_ACCESS_TOKEN;
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    const response = await fetch(`${SANDBOX_HOST}/kyc/aadhaar/okyc/otp`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        '@entity': 'in.co.sandbox.kyc.aadhaar.okyc.otp.request',
        aadhaar_number: aadhaar_number,
        consent: 'Y',
        reason: 'KYC Verification for Vendor Registration',
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      return NextResponse.json(
        { error: data.message || 'Failed to generate OTP' },
        { status: response.status, headers: corsHeaders }
      )
    }

    return NextResponse.json(data, { status: 200, headers: corsHeaders })
  } catch (error: any) {
    console.error('[Aadhaar OTP Generation Error]:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate OTP' },
      { status: 500, headers: corsHeaders }
    )
  }
}
