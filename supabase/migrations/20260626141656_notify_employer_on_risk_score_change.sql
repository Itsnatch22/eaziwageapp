-- Notify the employer whenever their risk score or rating changes on the employers table.
-- The fn_sync_employer_risk_score trigger already writes the new values to employers,
-- so we listen here rather than inside the risk_factors sync to avoid double-firing.

CREATE OR REPLACE FUNCTION public.notify_on_employer_risk_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_rating_label text;
  v_old_rating   text;
BEGIN
  -- Only fire when score or rating actually changed
  IF COALESCE(OLD.risk_score::text, '') = COALESCE(NEW.risk_score::text, '')
     AND COALESCE(OLD.risk_rating, '') = COALESCE(NEW.risk_rating, '') THEN
    RETURN NEW;
  END IF;

  -- Skip if no user to notify
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_rating_label := CASE NEW.risk_rating
    WHEN 'A' THEN 'Low Risk'
    WHEN 'B' THEN 'Moderate Risk'
    WHEN 'C' THEN 'High Risk'
    WHEN 'D' THEN 'Very High Risk'
    ELSE 'Unknown'
  END;

  v_old_rating := CASE OLD.risk_rating
    WHEN 'A' THEN 'Low Risk'
    WHEN 'B' THEN 'Moderate Risk'
    WHEN 'C' THEN 'High Risk'
    WHEN 'D' THEN 'Very High Risk'
    ELSE 'Unknown'
  END;

  -- In-app notification to employer
  INSERT INTO public.notifications (user_id, type, title, message, urgency, metadata, created_at)
  VALUES (
    NEW.user_id,
    'risk_update',
    'Risk Profile Updated',
    format(
      'Your risk profile has been updated. Rating: %s%s.',
      v_rating_label,
      CASE
        WHEN NEW.risk_rating IS DISTINCT FROM OLD.risk_rating
          THEN format(' (previously %s)', v_old_rating)
        ELSE ''
      END
    ),
    CASE WHEN NEW.risk_rating IN ('C', 'D') THEN 'high' ELSE 'normal' END,
    jsonb_build_object(
      'previous_score',  OLD.risk_score,
      'new_score',       NEW.risk_score,
      'previous_rating', OLD.risk_rating,
      'new_rating',      NEW.risk_rating
    ),
    now()
  );

  -- Admin notification
  INSERT INTO public.admin_notifications (type, title, message, read, metadata, created_at)
  VALUES (
    'system_alert'::admin_notification_type,
    'Employer Risk Profile Changed',
    format('%s risk rating changed from %s to %s.',
      COALESCE(NEW.company_name, 'An employer'),
      v_old_rating,
      v_rating_label
    ),
    false,
    jsonb_build_object(
      'employer_id',     NEW.id,
      'previous_rating', OLD.risk_rating,
      'new_rating',      NEW.risk_rating,
      'previous_score',  OLD.risk_score,
      'new_score',       NEW.risk_score
    ),
    now()
  );

  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_notify_on_risk_change
  AFTER UPDATE OF risk_score, risk_rating ON public.employers
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_employer_risk_change();

