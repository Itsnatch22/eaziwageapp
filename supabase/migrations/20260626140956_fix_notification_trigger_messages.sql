-- Fix notify_on_kyc_status_change:
--   1. Employee message: format document_type as human-readable (national_id → National ID, utility_bill → Utility Bill)
--   2. Admin message: remove raw UUIDs, show status change cleanly
CREATE OR REPLACE FUNCTION public.notify_on_kyc_status_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_doc_label text;
BEGIN
  IF TG_OP = 'UPDATE' AND COALESCE(OLD.status, '') <> COALESCE(NEW.status, '') THEN
    -- Human-readable document type: replace underscores with spaces, then title-case
    -- Special-case known acronyms
    v_doc_label := CASE NEW.document_type
      WHEN 'national_id'        THEN 'National ID'
      WHEN 'passport'           THEN 'Passport'
      WHEN 'utility_bill'       THEN 'Utility Bill'
      WHEN 'bank_statement'     THEN 'Bank Statement'
      WHEN 'payslip'            THEN 'Payslip'
      WHEN 'driving_license'    THEN 'Driving Licence'
      WHEN 'tax_certificate'    THEN 'Tax Certificate'
      ELSE initcap(replace(NEW.document_type, '_', ' '))
    END;

    -- Employee notification: clear, no raw IDs
    INSERT INTO public.notifications (user_id, type, title, message, urgency, metadata, created_at)
    VALUES (
      NEW.user_id,
      'kyc_status',
      'KYC Document Update',
      CASE NEW.status
        WHEN 'approved' THEN format('Your %s has been approved.', v_doc_label)
        WHEN 'rejected' THEN format('Your %s was not approved. Please re-upload a clear copy.', v_doc_label)
        ELSE format('Your %s status has been updated to %s.', v_doc_label, NEW.status)
      END,
      CASE WHEN NEW.status = 'rejected' THEN 'high' ELSE 'normal' END,
      jsonb_build_object('document_id', NEW.id, 'old_status', OLD.status, 'new_status', NEW.status),
      now()
    );

    -- Admin notification: no raw UUIDs in the visible message
    INSERT INTO public.admin_notifications (type, title, message, read, metadata, created_at)
    VALUES (
      'employer_kyc'::admin_notification_type,
      'KYC Document ' || initcap(NEW.status),
      format('A %s document was marked as %s.', v_doc_label, NEW.status),
      false,
      jsonb_build_object('document_id', NEW.id, 'user_id', NEW.user_id),
      now()
    );
  END IF;

  RETURN NEW;
END;
$function$;

-- Fix notify_on_wallet_topup:
--   1. Employee message: remove raw reference (DEP-uuid-timestamp) — show amount only
--   2. Admin message: remove raw transaction UUID from visible text
CREATE OR REPLACE FUNCTION public.notify_on_wallet_topup()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_owner_id uuid;
BEGIN
  IF NEW.type <> 'deposit' OR NEW.status <> 'pending' THEN
    RETURN NEW;
  END IF;

  SELECT e.user_id INTO v_owner_id
  FROM public.employer_wallets ew
  JOIN public.employers e ON e.id = ew.employer_id
  WHERE ew.id = NEW.wallet_id;

  IF v_owner_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, message, urgency, metadata, created_at)
    VALUES (
      v_owner_id,
      'wallet_topup',
      'Top-Up Request Submitted',
      format('Your wallet top-up request for %s is pending admin approval.', NEW.amount::text),
      'normal',
      jsonb_build_object('wallet_transaction_id', NEW.id, 'amount', NEW.amount),
      now()
    );
  END IF;

  INSERT INTO public.admin_notifications (type, title, message, read, metadata, created_at)
  VALUES (
    'review_request'::admin_notification_type,
    'New Wallet Top-Up Request',
    format('An employer has requested a wallet top-up of %s.', NEW.amount::text),
    false,
    jsonb_build_object('wallet_transaction_id', NEW.id),
    now()
  );

  RETURN NEW;
END;
$function$;

