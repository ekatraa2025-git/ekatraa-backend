-- Create vendor_notifications table for Supabase
-- Run this SQL in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS vendor_notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    vendor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('booking_update', 'system_update', 'quotation', 'general')),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    data JSONB DEFAULT '{}',
    read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_vendor_notifications_vendor_id ON vendor_notifications(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_notifications_read ON vendor_notifications(vendor_id, read);
CREATE INDEX IF NOT EXISTS idx_vendor_notifications_created_at ON vendor_notifications(created_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE vendor_notifications ENABLE ROW LEVEL SECURITY;

-- Policy: Vendors can only see their own notifications
CREATE POLICY "Vendors can view their own notifications"
    ON vendor_notifications
    FOR SELECT
    USING (auth.uid() = vendor_id);

-- Policy: Vendors can update their own notifications (mark as read)
CREATE POLICY "Vendors can update their own notifications"
    ON vendor_notifications
    FOR UPDATE
    USING (auth.uid() = vendor_id);

-- Policy: System can insert notifications (using service role key)
-- Note: This requires service role key, which should only be used server-side
-- For client-side, you may need to create a function that can be called with elevated privileges

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_vendor_notifications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER update_vendor_notifications_updated_at
    BEFORE UPDATE ON vendor_notifications
    FOR EACH ROW
    EXECUTE FUNCTION update_vendor_notifications_updated_at();

-- Grant necessary permissions
GRANT SELECT, UPDATE ON vendor_notifications TO authenticated;
