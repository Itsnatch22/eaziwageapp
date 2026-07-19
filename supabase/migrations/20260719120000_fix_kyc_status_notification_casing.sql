-- notify_on_kyc_status_change() already builds a human-readable document
-- label (v_doc_label) but interpolated the raw NEW.status literal directly
-- into both notification titles/messages — fine for 'approved'/'rejected'
-- (already single lowercase words matching the intended tone) but leaked
-- as literal "under_review" for any multi-word status, e.g. the admin
-- notification title read "KYC Document Under_review" and the employee
-- message read "...status has been updated to under_review." instead of
-- "Under Review". Adds the same style of label mapping already used for
-- document_type, applied to status on both the employee- and
-- admin-facing inserts.
CREATE OR REPLACE FUNCTION public.notify_on_kyc_status_change()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  v_doc_label text;
  v_status_label text;
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

    -- Human-readable status label — same treatment as v_doc_label above.
    v_status_label := CASE NEW.status
      WHEN 'approved'     THEN 'Approved'
      WHEN 'rejected'     THEN 'Rejected'
      WHEN 'pending'      THEN 'Pending'
      WHEN 'under_review' THEN 'Under Review'
      ELSE initcap(replace(NEW.status, '_', ' '))
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
        ELSE format('Your %s status has been updated to %s.', v_doc_label, v_status_label)
      END,
      CASE WHEN NEW.status = 'rejected' THEN 'high' ELSE 'normal' END,
      jsonb_build_object('document_id', NEW.id, 'old_status', OLD.status, 'new_status', NEW.status),
      now()
    );

    -- Admin notification: no raw UUIDs in the visible message
    INSERT INTO public.admin_notifications (type, title, message, read, metadata, created_at)
    VALUES (
      'employer_kyc'::admin_notification_type,
      'KYC Document ' || v_status_label,
      format('A %s document was marked as %s.', v_doc_label, lower(v_status_label)),
      false,
      jsonb_build_object('document_id', NEW.id, 'user_id', NEW.user_id),
      now()
    );
  END IF;

  RETURN NEW;
END;
$function$;
