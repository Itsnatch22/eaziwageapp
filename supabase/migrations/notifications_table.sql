-- Create the notifications table for employee and employer notifications
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    read BOOLEAN DEFAULT FALSE NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create index on user_id for faster queries
CREATE INDEX IF NOT EXISTS notifications_user_id_idx ON notifications(user_id);

-- Create index on created_at for ordering
CREATE INDEX IF NOT EXISTS notifications_created_at_idx ON notifications(created_at DESC);

-- Create index on user_id and read for fetching unread notifications
CREATE INDEX IF NOT EXISTS notifications_user_read_idx ON notifications(user_id, read);

-- Enable Row Level Security
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own notifications
CREATE POLICY "Users can view own notifications"
    ON notifications FOR SELECT
    USING (auth.uid() = user_id);

-- Policy: Users can insert their own notifications (application-level control)
CREATE POLICY "Users can insert own notifications"
    ON notifications FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own notifications
CREATE POLICY "Users can update own notifications"
    ON notifications FOR UPDATE
    USING (auth.uid() = user_id);

-- Policy: Users can delete their own notifications
CREATE POLICY "Users can delete own notifications"
    ON notifications FOR DELETE
    USING (auth.uid() = user_id);

-- Create a trigger to set created_at timestamp
CREATE OR REPLACE FUNCTION set_created_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.created_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_notifications_created_at ON notifications;
CREATE TRIGGER set_notifications_created_at
    BEFORE INSERT ON notifications
    FOR EACH ROW
    EXECUTE FUNCTION set_created_at();

-- Comment for documentation
COMMENT ON TABLE notifications IS 'User notifications for employees and employers';
COMMENT ON COLUMN notifications.user_id IS 'The user who owns this notification';
COMMENT ON COLUMN notifications.type IS 'Type of notification: advance, system, employee, repayment, kyc_update, advance_approval, kyc_update, system_alert, repayment_reminder';
COMMENT ON COLUMN notifications.read IS 'Whether the notification has been read';
COMMENT ON COLUMN notifications.metadata IS 'Additional JSON metadata for the notification';

