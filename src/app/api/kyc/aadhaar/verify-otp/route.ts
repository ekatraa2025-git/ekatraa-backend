import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/server'

const SANDBOX_API_KEY = process.env.SANDBOX_API_KEY
const SANDBOX_API_SECRET = process.env.SANDBOX_API_SECRET
const SANDBOX_HOST = process.env.SANDBOX_HOST || 'https://api.sandbox.co.in'

export async function POST(req: Request) {
  // Handle CORS
  const origin = req.headers.get('origin')
  const corsHeaders: Record<string, string> = {
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
    const { reference_id, otp, vendor_id, aadhaar_number, aadhaar_front_url, aadhaar_back_url } = body

    if (!reference_id || !otp) {
      return NextResponse.json(
        { error: 'reference_id and otp are required' },
        { status: 400, headers: corsHeaders }
      )
    }

    if (!vendor_id) {
      return NextResponse.json(
        { error: 'vendor_id is required' },
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

    // Verify OTP with Sandbox API
    const response = await fetch(`${SANDBOX_HOST}/kyc/aadhaar/okyc/otp/verify`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        '@entity': 'in.co.sandbox.kyc.aadhaar.okyc.request',
        reference_id: reference_id,
        otp: otp,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      return NextResponse.json(
        { error: data.message || 'OTP verification failed' },
        { status: response.status, headers: corsHeaders }
      )
    }

    // If verification successful, update vendor record
    if (data.data && data.data.status === 'VALID') {
      const updateData: any = {
        is_verified: true,
        aadhaar_verified: true,
        aadhaar_verification_data: data.data,
      }

      // Add Aadhaar number if provided
      if (aadhaar_number) {
        updateData.aadhaar_number = aadhaar_number
      }

      // Add image URLs if provided
      if (aadhaar_front_url) {
        updateData.aadhaar_front_url = aadhaar_front_url
      }
      if (aadhaar_back_url) {
        updateData.aadhaar_back_url = aadhaar_back_url
      }

      const { error: updateError } = await supabase
        .from('vendors')
        .update(updateData)
        .eq('id', vendor_id)

      if (updateError) {
        console.error('[Vendor Update Error]:', updateError)
        return NextResponse.json(
          { error: 'Verification successful but failed to update vendor record' },
          { status: 500, headers: corsHeaders }
        )
      }

      return NextResponse.json({
        success: true,
        message: 'Aadhaar verified successfully',
        data: data.data,
      }, { headers: corsHeaders })
    } else {
      return NextResponse.json(
        { error: data.data?.message || 'Aadhaar verification failed' },
        { status: 400, headers: corsHeaders }
      )
    }
  } catch (error: any) {
    console.error('[Aadhaar OTP Verification Error]:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to verify OTP' },
      { status: 500, headers: corsHeaders }
    )
  }
}
