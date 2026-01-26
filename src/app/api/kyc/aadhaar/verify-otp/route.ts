import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/server'
import { getSandboxAccessToken } from '@/lib/sandbox-auth'

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
    let body
    try {
      body = await req.json()
    } catch (parseError: any) {
      console.error('[OTP Verify] JSON parse error:', parseError)
      return NextResponse.json(
        { error: 'Invalid request body. Please ensure all required fields are provided.' },
        { status: 400, headers: corsHeaders }
      )
    }

    const { reference_id, otp, vendor_id, aadhaar_number, aadhaar_front_url, aadhaar_back_url } = body

    console.log('[OTP Verify] Received request body:', {
      has_reference_id: !!reference_id,
      has_otp: !!otp,
      has_vendor_id: !!vendor_id,
      otp_length: otp?.length,
    })

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

    // Get Sandbox access token
    const accessToken = await getSandboxAccessToken()
    const SANDBOX_API_KEY = process.env.SANDBOX_API_KEY

    if (!SANDBOX_API_KEY) {
      return NextResponse.json(
        { error: 'Sandbox API key not configured' },
        { status: 500, headers: corsHeaders }
      )
    }

    // Note: According to Sandbox docs, both Authorization and x-api-key headers are required
    // Pass token in Authorization header without "Bearer" keyword
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': accessToken, // Token without "Bearer" prefix as per Sandbox docs
      'x-api-key': SANDBOX_API_KEY, // Required header for authenticated requests
      'x-api-version': '1.0.0',
    }

    console.log('[OTP Verify] Calling Sandbox API with token:', accessToken.substring(0, 20) + '...')

    // Verify OTP with Sandbox API
    const requestPayload = {
      '@entity': 'in.co.sandbox.kyc.aadhaar.okyc.request',
      reference_id: reference_id.trim(),
      otp: otp.trim(),
    }

    console.log('[OTP Verify] Sandbox API request payload:', {
      entity: requestPayload['@entity'],
      has_reference_id: !!requestPayload.reference_id,
      has_otp: !!requestPayload.otp,
      otp_length: requestPayload.otp?.length,
    })

    const response = await fetch(`${SANDBOX_HOST}/kyc/aadhaar/okyc/otp/verify`, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestPayload),
    })

    console.log('[OTP Verify] Sandbox API response status:', response.status)

    let data
    try {
      const responseText = await response.text()
      console.log('[OTP Verify] Sandbox API raw response:', responseText)
      data = responseText ? JSON.parse(responseText) : {}
    } catch (parseError: any) {
      console.error('[OTP Verify] Failed to parse Sandbox response:', parseError)
      return NextResponse.json(
        { error: 'Invalid response from verification service' },
        { status: 500, headers: corsHeaders }
      )
    }

    console.log('[OTP Verify] Sandbox API parsed response:', data)

    if (!response.ok) {
      console.error('[OTP Verify] Sandbox API error:', {
        status: response.status,
        statusText: response.statusText,
        data: data,
      })
      return NextResponse.json(
        { error: data.message || data.error || data.data?.message || 'OTP verification failed' },
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
