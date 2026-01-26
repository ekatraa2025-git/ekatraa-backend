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

    console.log('[OTP Verify] Sandbox API parsed response:', JSON.stringify(data, null, 2))

    if (!response.ok) {
      console.error('[OTP Verify] Sandbox API error:', {
        status: response.status,
        statusText: response.statusText,
        data: data,
      })
      const errorMessage = data.message || data.error || data.data?.message || `OTP verification failed (${response.status})`
      return NextResponse.json(
        { error: errorMessage },
        { status: response.status, headers: corsHeaders }
      )
    }

    // Check if verification was successful
    // Sandbox API returns data in different structures, check both
    const verificationStatus = data.data?.status || data.status
    const isValid = verificationStatus === 'VALID' || (data.code === 200 && data.data)
    
    console.log('[OTP Verify] Verification status check:', {
      verificationStatus,
      isValid,
      hasData: !!data.data,
      responseStructure: Object.keys(data)
    })

    // If verification successful, update vendor record
    if (isValid && (data.data?.status === 'VALID' || verificationStatus === 'VALID')) {
      // Always set is_verified to true on successful Aadhaar verification
      // This is the primary flag that determines vendor verification status
      // NOTE: Based on error logs, aadhaar_verified and aadhaar_verification_data columns don't exist
      // So we only update is_verified and other basic fields that should exist
      
      // Try to update vendor record, but don't fail verification if update fails
      try {
        const updateData: any = {
          is_verified: true, // CRITICAL: Always set to true on successful verification - this column must exist
        }

        // Add Aadhaar number if provided (if this column exists)
        if (aadhaar_number) {
          updateData.aadhaar_number = aadhaar_number
        }

        // Add image URLs if provided (if these columns exist)
        if (aadhaar_front_url) {
          updateData.aadhaar_front_url = aadhaar_front_url
        }
        if (aadhaar_back_url) {
          updateData.aadhaar_back_url = aadhaar_back_url
        }
        
        // Do NOT include aadhaar_verified or aadhaar_verification_data - these columns don't exist in the schema

        console.log('[OTP Verify] Updating vendor record with verification status:', {
          vendor_id,
          is_verified: updateData.is_verified,
          has_aadhaar_number: !!updateData.aadhaar_number,
          has_images: !!(updateData.aadhaar_front_url || updateData.aadhaar_back_url)
        })

      // First, verify the vendor exists (using service role key, bypasses RLS)
      console.log('[OTP Verify] Checking vendor existence:', { vendor_id })
      
      const { data: existingVendor, error: checkError } = await supabase
        .from('vendors')
        .select('id, is_verified')
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
        // Use minimal data - only is_verified which must exist
        console.log('[OTP Verify] Vendor not found, attempting upsert with minimal fields...')
        const upsertData: any = {
          id: vendor_id,
          is_verified: true, // CRITICAL: Primary verification flag
        }
        
        // Only add optional fields if they're provided
        if (aadhaar_number) {
          upsertData.aadhaar_number = aadhaar_number
        }
        if (aadhaar_front_url) {
          upsertData.aadhaar_front_url = aadhaar_front_url
        }
        if (aadhaar_back_url) {
          upsertData.aadhaar_back_url = aadhaar_back_url
        }
        
        const upsertResult = await supabase
          .from('vendors')
          .upsert(upsertData, { onConflict: 'id' })
          .select('id, is_verified')
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
        // First try with all fields, if it fails, try with just is_verified
        const updateResult = await supabase
          .from('vendors')
          .update(updateData)
          .eq('id', vendor_id)
          .select('id, is_verified')
          .single()
        
        updatedVendor = updateResult.data
        updateError = updateResult.error
        
        // If update failed due to missing columns, try with just is_verified
        if (updateError && (updateError.message?.includes('column') || updateError.message?.includes('schema cache'))) {
          console.log('[OTP Verify] Update failed due to missing columns, retrying with only is_verified...')
          const minimalUpdate = await supabase
            .from('vendors')
            .update({ is_verified: true })
            .eq('id', vendor_id)
            .select('id, is_verified')
            .single()
          
          if (!minimalUpdate.error) {
            updatedVendor = minimalUpdate.data
            updateError = null
            console.log('[OTP Verify] Minimal update successful with is_verified only')
          } else {
            updateError = minimalUpdate.error
          }
        }
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
        // Try one more time with ONLY is_verified - this column must exist
        console.log('[OTP Verify] Retrying update with ONLY is_verified field (most critical)...')
        const { data: retryUpdate, error: retryError } = await supabase
          .from('vendors')
          .update({
            is_verified: true, // CRITICAL: Must be true for vendor to show as verified - this is the only required field
          })
          .eq('id', vendor_id)
          .select('id, is_verified')
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

      // Verify that is_verified was actually set to true
      if (updatedVendor.is_verified !== true) {
        console.error('[OTP Verify] WARNING: is_verified is not true after update!', {
          id: updatedVendor.id,
          is_verified: updatedVendor.is_verified
        })
        
        // Force update is_verified to true one more time
        const { data: forceUpdate, error: forceError } = await supabase
          .from('vendors')
          .update({ is_verified: true })
          .eq('id', vendor_id)
          .select('id, is_verified')
          .single()
        
        if (forceError) {
          console.error('[OTP Verify] Force update failed:', forceError)
        } else {
          console.log('[OTP Verify] Force update successful:', forceUpdate)
          updatedVendor.is_verified = true
        }
      }

      console.log('[OTP Verify] Vendor record updated successfully:', {
        id: updatedVendor.id,
        is_verified: updatedVendor.is_verified,
        verification_complete: updatedVendor.is_verified === true
      })

        return NextResponse.json({
          success: true,
          message: 'Aadhaar verified successfully',
          data: data.data,
          vendor_updated: {
            is_verified: updatedVendor.is_verified
          }
        }, { headers: corsHeaders })
      } catch (updateException: any) {
        // If vendor update fails, still return success for verification
        // The verification itself was successful, update is secondary
        console.error('[OTP Verify] Exception during vendor update:', updateException)
        return NextResponse.json({
          success: true,
          message: 'Aadhaar verified successfully',
          data: data.data,
          warning: 'Verification successful but vendor record update encountered an error. Please refresh your profile.',
        }, { headers: corsHeaders })
      }
    } else {
      // Verification was not successful
      const errorMessage = data.data?.message || data.message || 'Aadhaar verification failed'
      console.error('[OTP Verify] Verification failed:', {
        status: verificationStatus,
        message: errorMessage,
        fullResponse: data
      })
      return NextResponse.json(
        { error: errorMessage },
        { status: 400, headers: corsHeaders }
      )
    }
  } catch (error: any) {
    console.error('[Aadhaar OTP Verification Error]:', error)
    // More specific error message
    const errorMessage = error.message || 'Failed to verify OTP'
    console.error('[OTP Verify] Full error details:', {
      message: errorMessage,
      stack: error.stack,
      name: error.name
    })
    return NextResponse.json(
      { error: errorMessage },
      { status: 500, headers: corsHeaders }
    )
  }
}
