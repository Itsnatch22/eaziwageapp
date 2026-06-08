-- Add notification_preferences column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{"emailAlerts": true, "pushNotifications": true}'::jsonb;

-- Update existing profiles to have default preferences if they are null
UPDATE public.profiles 
SET notification_preferences = '{"emailAlerts": true, "pushNotifications": true}'::jsonb
WHERE notification_preferences IS NULL;
