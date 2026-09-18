# Proposed Human Resource Dashboard

> **Status:** Discussion proposal. This document describes a possible product direction, not an approved implementation.

## Why this role is useful

Today, the employer/administrator experience carries responsibilities that are different from the work an HR team does every day. HR typically owns the employee lifecycle and organization data, while an employer administrator owns commercial, financial, and platform-level decisions.

Introducing HR as a separate role could make employee onboarding less burdensome without replacing either existing dashboard:

```text
Employer / Administrator
				|
				v
			 HR  --->  Employees
```

EaziWage would remain the platform connecting these roles, with each role seeing only the actions appropriate to its responsibilities.

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

1. HR users can access only organizations they are assigned to.
2. HR can view an employee directory with filters for onboarding status, department, and employment status.
3. HR can add an employee individually and send an invitation.
4. HR can upload a CSV using a documented template, preview the import, correct row-level errors, and submit valid rows.
5. HR can assign or update an employee number, payroll number, department, job title, and employment status.
6. HR can review the documents required by that organization and act on pending submissions.
7. Employees can see what information or documents are still missing.
8. Administrators can review HR activity through an audit log and can disable or adjust HR access.

Bulk Excel support could follow CSV once the import rules and error handling are proven. CSV is easier to validate consistently and is sufficient for an initial pilot.

## Role and permission boundary

| Role | Owns | Should not automatically own |
| --- | --- | --- |
| Employer / Administrator | Organization setup, funding, EWA policy, commercial settings, and HR access | Routine employee data entry on behalf of HR |
| HR | Employee records, onboarding, employment structure, and document workflows | Wallet funding, payout approval, EWA policy changes, or unrestricted financial data |
| Employee | Personal profile, required documents, and their own onboarding actions | Other employees' records or organization configuration |
| Platform Admin | Compliance oversight, support, fraud, and platform-level intervention | Day-to-day organization operations unless an escalation requires it |

Permissions should be explicit rather than inferred from a broad `employer` role. A future organization may need several HR permission sets, for example:

- **HR Viewer:** directory and onboarding progress only.
- **HR Operator:** create and update employees, send invitations, and manage documents.
- **HR Approver:** verify documents and approve employment changes.
- **HR Manager:** manage HR users and organization-level HR configuration, subject to employer approval.

## Recommended workflows

### Individual onboarding

1. HR creates or imports the employee's basic record.
2. EaziWage validates required fields and checks for an existing employee or pending invitation.
3. The employee receives an invitation to complete personal information and submit documents.
4. HR sees a progress state such as `Invited`, `In progress`, `Needs attention`, `Ready for review`, or `Complete`.
5. HR verifies organization-required documents.
6. The employee becomes active only after the existing approval and eligibility rules are satisfied.

### Bulk import

1. HR downloads the organization's current import template.
2. HR uploads a CSV and receives a preview, not an immediate batch write.
3. The system validates headers, required fields, duplicates, field formats, and organization membership.
4. HR fixes invalid rows or confirms the valid subset.
5. EaziWage creates invitations and produces an import summary with a durable import ID.
6. Each row remains traceable without exposing other employees' personal data in error messages.

### Document review

1. The organization defines which document types apply to an employee group or location.
2. The employee submits a document and sees its status.
3. HR approves it, rejects it with a reason, or requests a replacement.
4. Replacing a document creates a new version; the previous decision remains in the audit history.
5. Expiry dates trigger reminders and a review queue.

### Offboarding

HR should be able to report an employment end date and reason, but offboarding should not silently delete an employee. The workflow should preserve the employee record, stop new eligibility where appropriate, notify the employer administrator, and surface any outstanding advance or repayment process for the authorized financial owner.

## Organization-specific requirements

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

The employer administrator could approve the requirement configuration, while HR operates the resulting review queue. This keeps HR close to the work without allowing a new HR user to weaken compliance requirements unilaterally.

## Data and security considerations

- Keep HR access scoped to an organization and enforce that scope in both the application and database policies.
- Treat payroll numbers and employee identifiers as sensitive personal or employment data; minimize what is shown in search results and exports.
- Keep an audit trail for imports, edits, invitations, document decisions, status changes, and permission changes.
- Make imports idempotent so retrying an upload does not create duplicate employees or invitations.
- Do not expose wallet balances, payout controls, salary details, payment-method PII, or fraud signals unless a separate permission explicitly allows it.
- Preserve the distinction between an onboarding record and a live employee record. The current system documents `employee_onboarding` and `employees` as separate records joined by `user_id`; any HR flow should resolve that relationship deliberately rather than assuming their IDs are interchangeable.
- Use the existing authentication, validation, RLS, and authorization patterns before introducing HR-specific shortcuts.

## Questions to resolve before implementation

1. Is HR assigned at the organization level, or can HR access only a department, country, or business unit?
2. Who approves a new HR user: the employer administrator, platform admin, or both?
3. Which employment fields are authoritative in EaziWage, and which remain synchronized from an organization's payroll or HRIS?
4. Should an HR approval activate an employee, or only complete the HR portion of a separate employer approval flow?
5. Which document types and retention periods are required in each target country?
6. Should payroll numbers be unique within an organization, and can they change after onboarding?
7. What happens when an employee already exists because they belong to another organization or previously used EaziWage?
8. Does the first version need an API or downloadable import result for payroll-system reconciliation?

## Possible delivery phases

| Phase | Scope | Outcome |
| --- | --- | --- |
| 0. Discovery | Permission matrix, organization boundary, field ownership, document rules, and import template | A reviewable product and security contract |
| 1. Directory | HR role, scoped employee list, search, filters, and basic employee details | HR can find and maintain employee records |
| 2. Onboarding | Individual invites, progress states, and missing-information requests | Less manual onboarding coordination |
| 3. Verification | Configurable requirements, document queue, decisions, expiry reminders, and audit history | HR can operate the verification process |
| 4. Bulk operations | CSV preview, validation, idempotent import, error report, and export | HR can onboard larger workforces efficiently |
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
