# Proposed Human Resource Dashboard

> **Status:** Discussion proposal. This document describes a possible product direction, not an approved implementation.
> **Revision (2026-10-12):** Reviewed against the live Supabase schema. Added "Decisions so far", "Verified current state", "Reviewer recommendations (not decided)" and Appendix A (re-verification queries), and annotated statements that were inaccurate or incomplete, each marked **[Corrected 2026-10-12]**. The original proposal text is otherwise unchanged. Verified facts are dated, so re-check them with Appendix A before relying on them.

## Decisions so far

- HR is a separate person under the same company, not the employer (confirmed by Mark, 2026-10-12).
- Everything else in this document is still a proposal. Nothing under "Reviewer recommendations" has been accepted.
- Implementation checklists (for example a Phase 0 task list) have not been started and wait for Mark's go-ahead.

## Verified current state (2026-10-12)

**How this was verified:** read-only metadata queries against the live Supabase project (columns, constraints, indexes, RLS policies, grants, triggers, function definitions). No table rows were read, nothing was changed, and no exploit was attempted. Re-run Appendix A before relying on any of this.

### Records and identifiers

- `employee_onboarding`: one row per user (unique `user_id`). Holds a review workflow (`status`, `submitted_at`, `reviewed_at`, `reviewed_by`, `review_notes`, `rejection_reason`, risk fields), employee-submitted employment fields (`job_title`, `department`, `employment_type`, `start_date`, `monthly_salary`, `net_monthly_salary`, `payroll_number`, `employee_code`), encrypted personal and payout fields (`national_id`, `bank_account`, `mobile_money_number`, `tax_id`, `date_of_birth`) and `face_id`.
- `employees` (live record): one row per user (unique `user_id`). Holds `kyc_status`, `advance_limit`, `earned_wages`, `risk_score`, document flags and storage paths, `monthly_salary`, `payroll_number` and `termination_date`. `employee_code` is unique across the whole platform, and `(organization_id, email)` is unique.
- Three company identifiers exist:
  - `employee_onboarding.employer_id` references `employer_onboarding.id`.
  - `employee_onboarding.live_employer_id` and `employees.employer_id` reference `employers.id` (`employers.onboarding_id` links back to onboarding).
  - `organizations.id` is referenced by `employees.organization_id`, `employers.organization_id` and `profiles.organization_id`.
  The sync trigger resolves the live employer from `live_employer_id`, then `employers.onboarding_id`, then through the onboarding owner's user, and raises an error if none matches. So `live_employer_id` is in use.
- `profiles.role` is an enum of `employee`, `employer`, `admin`. The admin check in RLS policies reads the role from the JWT `app_metadata`, not from `profiles`.

### Ownership and permissions

- Employer ownership is a single user: `employers.user_id` (live) and `employer_onboarding.user_id` (onboarding). One login per employer.
- No table named for membership, roles or permissions exists in the public schema (checked by table name only). There is no delegated employee-management access today.

### Invitations and imports

- `employee_invites`: `token` (primary key), `company_id`, `expires_at`, `used`. RLS is enabled with a "Service role only" policy, so clients cannot read or write it. There is no invitee identity, inviter, status or audit column. How the application uses it was not checked.
- `payroll_uploads` and `payroll_upload_rows`: a monthly payroll file import (gross, net, deductions) with row status, row errors and warnings, and source row numbers. It is a payroll import, not an employee roster import, but its row-level error-report pattern may be reusable. It contains salary data.

### Documents

- `employee_kyc_documents`: one row per user and document type, with `status`, `reviewer_notes`, `reviewed_by`, `reviewed_at` and `expiry_date`.
- The sync trigger reads a fixed set of document types: `id_front`, `id_back`, `address_proof`, `bank_statement`, `employment_contract`, `payslip_1`, `payslip_2` (`employees` also has a `selfie` flag). Requirements are a fixed checklist today, not configuration-driven.

### Triggers (all row-level)

- `sync_employee_from_onboarding` (after insert or update on `employee_onboarding`): when `status = 'approved'`, upserts the live `employees` row with `status = 'Active'` and `kyc_status = 'approved'`, copying salary, job title, department, payroll number and document paths. `ON CONFLICT (user_id)` overwrites `employer_id` and the employment fields. It performs no other eligibility checks inside the trigger (eligibility may be enforced elsewhere, for example `employee_ewa_settings`; not verified).
- `fn_sync_employee_kyc_to_live` (after update): maps onboarding status changes to `employees.kyc_status` (`approved`, `rejected`, `under_review` becomes `submitted`, otherwise `pending`; `suspended` is skipped).
- `trg_recompute_access_volume` (after insert, update, delete on `employee_onboarding`): fires once per row, which matters for bulk imports.
- `trg_guard_deleted_employer_onboarding` (before insert): blocks new onboarding rows for a soft-deleted employer.
- `employees`: `generate_employee_code` before insert and `updated_at` before update. No guard triggers protect sensitive columns on either table.

### RLS policies and grants

- RLS is enabled on `employees`, `employee_onboarding`, `employee_invites`, `payroll_uploads` and `payroll_upload_rows`.
- `employee_onboarding`: employees insert, read and update their own row (update only while `pending`, `under_review` or `rejected`, and the check clause only verifies `user_id`). Employers insert, read, update and delete rows for their own employer. Admins have full access.
- `employees`: employees insert, read and update their own row. Employers read and update their own employees' rows. Admins have full access.
- The `authenticated` role holds table-level privileges (including insert, update and delete) on both tables, and no column-level restrictions were found.

### Potential weaknesses (from policy text only, NOT tested)

These follow from the policies, grants and triggers above. Nothing was attempted. Confirm each with a throwaway test user before treating it as real, and note that the application may also route writes through a service role.

- **W1:** An employee can update their own onboarding row with no column limit. The check clause only verifies `user_id`, so they may be able to set `status = 'approved'`, change `employer_id` or `live_employer_id`, or change salary. The sync trigger would then activate the employee.
- **W2:** An employee can insert or update their own `employees` row with no column limit, including `advance_limit`, `earned_wages`, `kyc_status`, `risk_score`, `monthly_salary` and `employer_id`.
- **W3:** An employer can update rows for their own employer with no column limit, including `advance_limit`, `kyc_status`, `risk_score`, `status` and payout fields.
- **W4:** An employer can read whole onboarding rows, including encrypted personal fields, risk data and `face_id` (policies are row-level only).
- **W5:** An employer can insert an onboarding row for any `user_id` that has no row yet (the policy only checks employer ownership; the foreign key requires an existing auth user). With `status = 'approved'` on insert, the trigger would create an Active employee.

## Reviewer recommendations (NOT decided)

- **Split the state tracks.** One `approved` value currently activates the employee and approves KYC. Consider separate tracks for invitation progress, document review, employment confirmation, and KYC or risk (platform-owned).
- **Split documents by owner.** Employment documents (contract, payslips) for the employer's reviewers; identity KYC (ID, selfie, address, bank) for the platform. This matches the data-minimization rules in this document.
- **Name the authoritative source of salary.** HR is kept away from salary details, but access limits depend on salary and today the employee supplies it.
- **Decide the scope key.** Three company identifiers exist (see Records and identifiers). New permission tables need one agreed organization key.
- **Harden before adding an actor.** Column limits or guard triggers, and limited views for the new role (no personal fields, no risk data).
- **Limit permission grants.** Letting the Manager capability assign permissions is a privilege-escalation path. Consider owner-only assignment and protection for the last owner.
- **Plan for bulk import cost.** Per-row triggers (sync and access-volume recompute) will fire for every imported row. Consider reusing the row-level error-report pattern from the payroll upload tables.

## Why this capability is useful

Employee management is a function that may be performed by a dedicated HR team, an employer administrator, an owner, or a manager. A small or informal business may not have anyone with the title "HR", but it still needs a practical way to add employees, maintain records, and manage onboarding.

Rather than requiring an organization to create a formal HR department, EaziWage could provide employee-management capabilities that are assigned through permissions. Larger organizations could grant those permissions to HR users, while smaller organizations could use them directly within an employer or administrator account:

```text
Employer / Administrator
				|
				v
Employee-management permissions
				|
				v
				Employees
```

The underlying UI and onboarding flow should remain the same regardless of who performs the function. The difference should be who has access to the capability and which actions they are permitted to perform.

## Proposed HR responsibilities

| Area | Possible HR capability | Notes for discussion |
| --- | --- | --- |
| Employee onboarding | Add one employee, invite employees, or upload a CSV/XLSX file | Imports should validate rows before creating records and produce an error report for rejected rows. |
| Employee directory | Search and update employee records | Support payroll number, employee number, name, email, department, role, and employment status. |
| Organization structure | Manage departments, teams, job titles, and reporting relationships | Decide whether HR manages the structure or only assigns employees to structures configured by an administrator. |
| Document verification | Review, approve, reject, or request replacement documents | Every decision should record the reviewer, timestamp, reason, and document version. |
| Requirements | View organization-specific document requirements | Requirements should be configuration-driven rather than a single fixed checklist for every organization. |
| Employment lifecycle | Start, suspend, transfer, and end employment | Offboarding should be a controlled workflow that considers outstanding advances and preserves records. |
| Employee support | See onboarding progress and send requests for missing information | Avoid exposing financial administration or sensitive records that HR does not need. |

## Suggested first release

The smallest useful version could focus on reducing onboarding effort:

1. An employer administrator can assign employee-management permissions to an HR officer, owner, manager, or another authorized user.
2. Authorized users can view an employee directory with filters for onboarding status, department, and employment status.
3. Authorized users can add an employee individually and send an invitation.
4. Authorized users can upload a CSV using a documented template, preview the import, correct row-level errors, and submit valid rows.
5. Authorized users can assign or update an employee number, payroll number, department, job title, and employment status.
6. Authorized users can review the requirements configured for that organization and act on pending submissions.
7. Employees can see what information or documents are still missing.
8. Employer administrators can review employee-management activity through an audit log and can disable or adjust permissions.

Bulk Excel support could follow CSV once the import rules and error handling are proven. CSV is easier to validate consistently and is sufficient for an initial pilot.

## Role and permission boundary

| Actor or capability | Can be responsible for | Should not automatically include |
| --- | --- | --- |
| Employer / Administrator | Organization setup, funding, EWA policy, commercial settings, and assigning permissions | Employee-management access for every user by default |
| Employee-management capability | Employee records, onboarding, employment structure, and document workflows | Wallet funding, payout approval, EWA policy changes, or unrestricted financial data |
| Employee | Personal profile, required documents, and their own onboarding actions | Other employees' records or organization configuration |
| Platform Admin | Compliance oversight, support, fraud, and platform-level intervention | Day-to-day organization operations unless an escalation requires it |

Permissions should be explicit rather than inferred from a broad `employer` role or from a person's job title. The same capability could be granted to different people depending on the organization. A possible permission set is:

- **Employee Viewer:** directory and onboarding progress only.
- **Employee Operator:** create and update employees, send invitations, and manage documents.
- **Employee Approver:** verify documents and approve employment changes.
- **Employee Manager:** assign employee-management permissions and configure requirements, subject to employer approval.

These are capability names rather than mandatory job titles. A small business owner might hold the operator and approver permissions directly, while a larger organization might assign them to separate HR users.

## Recommended workflows

### Individual onboarding

1. An authorized employee manager creates or imports the employee's basic record.
2. EaziWage validates required fields and checks for an existing employee or pending invitation. **[Corrected 2026-10-12]** Today's `employee_invites` table holds only a token, company ID, expiry and a used flag, with no invitee identity or inviter, so a per-person pending-invitation check is not possible yet.
3. The employee receives an invitation to complete personal information and submit documents.
4. The authorized user sees a progress state such as `Invited`, `In progress`, `Needs attention`, `Ready for review`, or `Complete`.
5. An authorized user verifies the documents required for that employee.
6. The employee becomes active only after the existing approval and eligibility rules are satisfied. **[Corrected 2026-10-12]** In the current database, setting `employee_onboarding.status = 'approved'` activates the employee (`status = 'Active'`, `kyc_status = 'approved'`) through a trigger, with no further checks inside the trigger. Any eligibility rules are enforced elsewhere, if at all (not verified).

### Bulk import

1. An authorized user downloads the organization's current import template.
2. The authorized user uploads a CSV and receives a preview, not an immediate batch write.
3. The system validates headers, required fields, duplicates, field formats, and organization membership.
4. The authorized user fixes invalid rows or confirms the valid subset.
5. EaziWage creates invitations and produces an import summary with a durable import ID.
6. Each row remains traceable without exposing other employees' personal data in error messages.

### Document review

1. The organization defines which document types apply to an employee group or location.
2. The employee submits a document and sees its status.
3. HR approves it, rejects it with a reason, or requests a replacement.
4. Replacing a document creates a new version; the previous decision remains in the audit history.
5. Expiry dates trigger reminders and a review queue.

### Offboarding

An authorized user should be able to report an employment end date and reason, but offboarding should not silently delete an employee. The workflow should preserve the employee record, stop new eligibility where appropriate, notify the employer administrator, and surface any outstanding advance or repayment process for the authorized financial owner.

## Organization-specific requirements

> **Current state (verified 2026-10-12):** requirements are a fixed checklist today (see Verified current state, Documents), so configurable requirement sets would be new work.

Rather than hard-coding one checklist, a possible model is:

```text
Organization
	-> requirement set
			-> document type
			-> applies to: country, department, employment type, or employee group
			-> required / optional
			-> expiry policy
			-> effective date and version
```

The employer administrator or an authorized employee manager could configure or approve the requirement set, while any user with the appropriate verification permission operates the resulting review queue. Requirements should support a useful minimum for informal businesses, such as basic employee information, and optional additional requirements for larger organizations, such as contracts, identification, or tax-related documents.

## Data and security considerations

- Keep employee-management access scoped to an organization, and optionally to a department or business unit, enforcing that scope in both the application and database policies.
- Treat payroll numbers and employee identifiers as sensitive personal or employment data; minimize what is shown in search results and exports.
- Keep an audit trail for imports, edits, invitations, document decisions, status changes, and permission changes.
- Make imports idempotent so retrying an upload does not create duplicate employees or invitations.
- Do not expose wallet balances, payout controls, salary details, payment-method PII, or fraud signals unless a separate permission explicitly allows it.
- Preserve the distinction between an onboarding record and a live employee record. The current system documents `employee_onboarding` and `employees` as separate records joined by `user_id`; any HR flow should resolve that relationship deliberately rather than assuming their IDs are interchangeable. **[Corrected 2026-10-12]** They also point at different employer identifiers: `employee_onboarding.employer_id` references `employer_onboarding.id`, while `employees.employer_id` references `employers.id` (an `organizations` table also exists). Both tables allow one row per user.
- Use the existing authentication, validation, RLS, and authorization patterns before introducing employee-management shortcuts or a title-based HR role. **[Corrected 2026-10-12]** Audit these patterns first. Current RLS policies are row-level only, with no column restrictions or guard triggers (see W1 to W5 under Verified current state). Hardening them is a prerequisite for adding a new actor, not something to inherit.

## Questions to resolve before implementation

1. Which employee-management permissions should exist, and which can be combined for a small business owner or manager?
2. Who can assign permissions: the employer administrator, an authorized employee manager, platform admin, or some combination?
3. Which employment fields are authoritative in EaziWage, and which remain synchronized from an organization's payroll or HRIS? *Current:* the employee submits salary, job title, department, employment type, start date and payroll number on `employee_onboarding`, and they are copied to `employees` on approval. `employees.employee_code` is unique across the whole platform, and `payroll_number` has no uniqueness constraint.
4. Should an HR approval activate an employee, or only complete the HR portion of a separate employer approval flow? *Current:* a single `status = 'approved'` value both activates the employee and sets KYC to approved (see Verified current state, Triggers).
5. What is the minimum information needed for an informal business, and which additional requirements can larger organizations configure?
6. Which document types and retention periods are required in each target country?
7. Should payroll numbers be unique within an organization, and can they change after onboarding? *Current:* no uniqueness constraint exists on `payroll_number`.
8. What happens when an employee already exists because they belong to another organization or previously used EaziWage? *Current:* both tables allow one row per user, so a user can belong to only one employer. The sync trigger's `ON CONFLICT (user_id)` overwrites `employer_id` on re-approval, so a change of employer would silently move the employee.
9. Does the first version need an API or downloadable import result for payroll-system reconciliation?

## Possible delivery phases

| Phase | Scope | Outcome |
| --- | --- | --- |
| 0. Discovery | Permission matrix, organization boundary, field ownership, document rules, and import template | A reviewable product and security contract |
| 1. Directory | Employee-management permissions, scoped employee list, search, filters, and basic employee details | The person responsible can find and maintain employee records |
| 2. Onboarding | Individual invites, progress states, and missing-information requests | Less manual onboarding coordination |
| 3. Verification | Configurable requirements, document queue, decisions, expiry reminders, and audit history | Authorized users can operate the verification process |
| 4. Bulk operations | CSV preview, validation, idempotent import, error report, and export | Authorized users can onboard larger workforces efficiently |
| 5. Integrations | Payroll/HRIS synchronization and reconciliation | EaziWage fits into existing organization workflows |

## Proposed success measures

- Time from employee creation to a complete onboarding record.
- Percentage of onboarding records completed without employer-admin intervention.
- Import success rate and average number of corrections per row.
- Time documents spend waiting for review.
- Number of duplicate employee or invitation records created.
- Number of HR actions requiring escalation to an employer administrator.
- Employee-reported clarity about what information or documents remain outstanding.

This proposal should be reviewed with employers, HR users, compliance stakeholders, and employees before any schema or permission changes are committed.

## Appendix A: re-verification queries (read-only, schema metadata only)

Run these against the live Supabase project before relying on the "Verified current state" section. They read schema metadata, not table data.

```sql
-- 1. Columns
select table_name, column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name in ('employee_onboarding','employees','employee_invites',
                     'payroll_uploads','payroll_upload_rows','employee_kyc_documents')
order by table_name, ordinal_position;

-- 2. Constraints and indexes
select conrelid::regclass as tbl, conname, pg_get_constraintdef(oid) as def
from pg_constraint
where conrelid in ('public.employees'::regclass,'public.employee_onboarding'::regclass,
                   'public.employee_invites'::regclass)
  and contype in ('u','f','p');

select tablename, indexdef from pg_indexes
where schemaname = 'public'
  and tablename in ('employees','employee_onboarding','employee_invites');

-- 3. RLS policies
select tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('employee_onboarding','employees','employee_invites');

-- 4. Table-level grants
select table_name, grantee, privilege_type
from information_schema.table_privileges
where table_schema = 'public'
  and table_name in ('employee_onboarding','employees')
  and grantee in ('authenticated','anon');

-- 5. Triggers (including row/statement orientation)
select event_object_table, trigger_name, event_manipulation, action_timing,
       action_orientation, action_statement
from information_schema.triggers
where trigger_schema = 'public'
  and event_object_table in ('employee_onboarding','employees');

-- 6. Function bodies
select p.proname, pg_get_functiondef(p.oid)
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('sync_employee_from_onboarding','fn_sync_employee_kyc_to_live',
                    'user_owns_employer_record','user_owns_employer_onboarding',
                    'current_user_is_admin','trg_recompute_access_volume_fn');

-- 7. Any membership, role, permission or invite tables
select table_name from information_schema.tables
where table_schema = 'public' and table_type = 'BASE TABLE'
  and (table_name ilike '%member%' or table_name ilike '%role%'
       or table_name ilike '%permission%' or table_name ilike '%invite%');
```