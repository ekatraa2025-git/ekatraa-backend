-- Vendors Table Schema Update for Aadhaar Verification
-- This migration adds Aadhaar verification related columns to the vendors table
-- Run this migration in your Supabase SQL editor to enable Aadhaar verification workflow

-- Add aadhaar_verified column (boolean flag to track Aadhaar verification status)
ALTER TABLE vendors 
ADD COLUMN IF NOT EXISTS aadhaar_verified BOOLEAN DEFAULT FALSE;

-- Add aadhaar_number column (stores the 12-digit Aadhaar number)
ALTER TABLE vendors 
ADD COLUMN IF NOT EXISTS aadhaar_number VARCHAR(12);

-- Add aadhaar_front_url column (stores URL/path to front side Aadhaar image)
ALTER TABLE vendors 
ADD COLUMN IF NOT EXISTS aadhaar_front_url TEXT;

-- Add aadhaar_back_url column (stores URL/path to back side Aadhaar image)
ALTER TABLE vendors 
ADD COLUMN IF NOT EXISTS aadhaar_back_url TEXT;

-- Add aadhaar_verification_data column (stores JSON data from Sandbox API verification response)
ALTER TABLE vendors 
ADD COLUMN IF NOT EXISTS aadhaar_verification_data JSONB;

-- Add comments to columns for documentation
COMMENT ON COLUMN vendors.aadhaar_verified IS 'Boolean flag indicating if Aadhaar verification is complete';
COMMENT ON COLUMN vendors.aadhaar_number IS '12-digit Aadhaar number (stored for verification purposes)';
COMMENT ON COLUMN vendors.aadhaar_front_url IS 'URL or file path to front side of Aadhaar card image';
COMMENT ON COLUMN vendors.aadhaar_back_url IS 'URL or file path to back side of Aadhaar card image';
COMMENT ON COLUMN vendors.aadhaar_verification_data IS 'JSON data from Sandbox API containing verification details (name, address, DOB, etc.)';

-- Create index on aadhaar_verified for faster queries
CREATE INDEX IF NOT EXISTS idx_vendors_aadhaar_verified ON vendors(aadhaar_verified);

-- Create index on is_verified for faster queries (if not already exists)
CREATE INDEX IF NOT EXISTS idx_vendors_is_verified ON vendors(is_verified);

-- Update existing records: Set aadhaar_verified to false if not already set
UPDATE vendors 
SET aadhaar_verified = FALSE 
WHERE aadhaar_verified IS NULL;

-- Note: The is_verified column should already exist and is the primary verification flag
-- Both is_verified and aadhaar_verified should be true for a vendor to be fully verified
-- is_verified = true (general verification status)
-- aadhaar_verified = true (specific Aadhaar KYC verification status)
