import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/server'
import { getSandboxAccessToken } from '@/lib/sandbox-auth'

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
    const { aadhaar_number, vendor_id, aadhaar_front_url, aadhaar_back_url } = body

    if (!aadhaar_number || aadhaar_number.length !== 12) {
      return NextResponse.json(
        { error: 'Valid 12-digit Aadhaar number is required' },
        { status: 400, headers: corsHeaders }
      )
    }

    if (!vendor_id) {
      return NextResponse.json(
        { error: 'vendor_id is required' },
        { status: 400, headers: corsHeaders }
      )
    }

    // Update vendor record with Aadhaar info (using service role key, bypasses RLS)
    if (vendor_id && (aadhaar_front_url || aadhaar_back_url)) {
      const updateData: any = {
        aadhaar_number: aadhaar_number,
      }

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
        console.error('[Vendor Update Error in Generate OTP]:', updateError)
        // Don't fail the OTP generation if update fails, just log it
      }
    }

    // Get Sandbox access token
    const accessToken = await getSandboxAccessToken()

    // Note: According to Sandbox docs, the token is NOT a bearer token
    // Pass it in Authorization header without "Bearer" keyword
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': accessToken, // Token without "Bearer" prefix as per Sandbox docs
      'x-api-version': '1.0.0',
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
