
UPDATE global_settings
SET risk_settings = '{}'::jsonb,
    updated_at = now()
WHERE id = 'default';

