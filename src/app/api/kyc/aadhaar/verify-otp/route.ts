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

      console.log('[OTP Verify] Updating vendor record:', {
        vendor_id,
        updateData: { ...updateData, aadhaar_verification_data: '...' }
      })

      // First, verify the vendor exists (using service role key, bypasses RLS)
      console.log('[OTP Verify] Checking vendor existence:', { vendor_id })
      
      const { data: existingVendor, error: checkError } = await supabase
        .from('vendors')
        .select('id, is_verified, aadhaar_verified')
        .eq('id', vendor_id)
        .maybeSingle()

      if (checkError) {
        console.error('[Vendor Check Error]:', {
          error: checkError,
          message: checkError.message,
          details: checkError.details,
          hint: checkError.hint,
          code: checkError.code,
          vendor_id
        })
        // Don't fail if check has an error - try to update anyway
        console.warn('[OTP Verify] Vendor check failed, but proceeding with update attempt')
      }

      if (!existingVendor) {
        console.error('[OTP Verify] Vendor not found in database:', { vendor_id })
        // Don't fail the verification - try to create or update anyway
        console.warn('[OTP Verify] Vendor not found, but proceeding with update attempt (may create record)')
      } else {
        console.log('[OTP Verify] Existing vendor data:', existingVendor)
      }

      // Update vendor record using service role key (bypasses RLS)
      // If vendor doesn't exist, try to upsert instead
      let updatedVendor: any = null
      let updateError: any = null
      
      if (!existingVendor) {
        // Vendor doesn't exist, try to upsert (insert or update)
        console.log('[OTP Verify] Vendor not found, attempting upsert...')
        const upsertData = {
          id: vendor_id,
          ...updateData,
        }
        
        const upsertResult = await supabase
          .from('vendors')
          .upsert(upsertData, { onConflict: 'id' })
          .select()
          .single()
        
        updatedVendor = upsertResult.data
        updateError = upsertResult.error
        
        if (updateError) {
          console.error('[OTP Verify] Upsert failed:', updateError)
        } else {
          console.log('[OTP Verify] Upsert successful:', updatedVendor?.id)
        }
      } else {
        // Vendor exists, perform normal update
        const updateResult = await supabase
          .from('vendors')
          .update(updateData)
          .eq('id', vendor_id)
          .select()
          .single()
        
        updatedVendor = updateResult.data
        updateError = updateResult.error
      }

      if (updateError) {
        console.error('[Vendor Update Error]:', {
          error: updateError,
          message: updateError.message,
          details: updateError.details,
          hint: updateError.hint,
          code: updateError.code,
          vendor_id,
          updateData
        })
        
        // Try to get more details about the error
        const { data: testUpdate, error: testError } = await supabase
          .from('vendors')
          .select('id')
          .eq('id', vendor_id)
          .single()
        
        console.log('[OTP Verify] Vendor exists check:', { testUpdate, testError })
        
        // Even if update fails, verification was successful
        // Try one more time with a simpler update
        console.log('[OTP Verify] Retrying update with minimal fields...')
        const { data: retryUpdate, error: retryError } = await supabase
          .from('vendors')
          .update({
            is_verified: true,
            aadhaar_verified: true,
          })
          .eq('id', vendor_id)
          .select()
          .single()
        
        if (retryError) {
          console.error('[Vendor Update Retry Error]:', retryError)
          // Return success but with detailed error info for debugging
          return NextResponse.json({
            success: true,
            message: 'Aadhaar verified successfully',
            data: data.data,
            warning: 'Verification successful but vendor record update failed. Please contact support.',
            error_details: {
              original_error: updateError.message,
              retry_error: retryError.message,
            }
          }, { headers: corsHeaders })
        }
        
        console.log('[OTP Verify] Retry update successful:', retryUpdate)
        updatedVendor = retryUpdate
      }

      if (!updatedVendor) {
        console.error('[OTP Verify] Update returned no data')
        return NextResponse.json({
          success: true,
          message: 'Aadhaar verified successfully',
          data: data.data,
          warning: 'Verification successful but vendor record update returned no data. Please refresh your profile.',
        }, { headers: corsHeaders })
      }

      console.log('[OTP Verify] Vendor record updated successfully:', {
        id: updatedVendor.id,
        is_verified: updatedVendor.is_verified,
        aadhaar_verified: updatedVendor.aadhaar_verified
      })

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
