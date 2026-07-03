
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS link text,
  ADD COLUMN IF NOT EXISTS urgency text NOT NULL DEFAULT 'normal'
    CHECK (urgency = ANY (ARRAY['low'::text, 'normal'::text, 'high'::text, 'critical'::text]));

CREATE INDEX IF NOT EXISTS idx_notifications_user_urgency
  ON public.notifications (user_id, urgency, created_at DESC)
  WHERE read = false;

