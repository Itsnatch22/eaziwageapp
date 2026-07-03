UPDATE global_settings
SET notification_settings = '{
  "email_new_employer": true,
  "email_large_advance": true,
  "email_fraud_alert": true,
  "email_daily_summary": true,
  "email_weekly_report": true,
  "sms_fraud_alert": true,
  "sms_system_alert": true,
  "sms_large_transaction": false,
  "large_advance_threshold": 50000,
  "daily_volume_threshold": 1000000,
  "fraud_alert_emails": "support@eaziwage.com",
  "admin_sms_numbers": "+254723154900"
}'::jsonb
WHERE id = 'default';
