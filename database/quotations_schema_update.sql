-- Quotations Table Schema Update
-- This migration adds the total_amount column to the quotations table
-- Run this migration in your Supabase SQL editor if you need the total_amount column

-- Add total_amount column to quotations table
-- This column stores the total amount for the quotation (same as amount by default)
ALTER TABLE quotations 
ADD COLUMN IF NOT EXISTS total_amount DECIMAL(10, 2);

-- Set default value for existing records (use amount if total_amount is null)
UPDATE quotations 
SET total_amount = amount 
WHERE total_amount IS NULL;

-- Add comment to column
COMMENT ON COLUMN quotations.total_amount IS 'Total amount for the quotation (defaults to amount if not specified)';

-- Optional: Add index if you frequently query by total_amount
-- CREATE INDEX IF NOT EXISTS idx_quotations_total_amount ON quotations(total_amount);
