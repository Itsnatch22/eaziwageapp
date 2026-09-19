# Proposed Human Resource Dashboard

> **Status:** Discussion proposal. This document describes a possible product direction, not an approved implementation.

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
2. EaziWage validates required fields and checks for an existing employee or pending invitation.
3. The employee receives an invitation to complete personal information and submit documents.
4. The authorized user sees a progress state such as `Invited`, `In progress`, `Needs attention`, `Ready for review`, or `Complete`.
5. An authorized user verifies the documents required for that employee.
6. The employee becomes active only after the existing approval and eligibility rules are satisfied.

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
- Preserve the distinction between an onboarding record and a live employee record. The current system documents `employee_onboarding` and `employees` as separate records joined by `user_id`; any HR flow should resolve that relationship deliberately rather than assuming their IDs are interchangeable.
- Use the existing authentication, validation, RLS, and authorization patterns before introducing employee-management shortcuts or a title-based HR role.

## Questions to resolve before implementation

1. Which employee-management permissions should exist, and which can be combined for a small business owner or manager?
2. Who can assign permissions: the employer administrator, an authorized employee manager, platform admin, or some combination?
3. Which employment fields are authoritative in EaziWage, and which remain synchronized from an organization's payroll or HRIS?
4. Should an HR approval activate an employee, or only complete the HR portion of a separate employer approval flow?
5. What is the minimum information needed for an informal business, and which additional requirements can larger organizations configure?
6. Which document types and retention periods are required in each target country?
7. Should payroll numbers be unique within an organization, and can they change after onboarding?
8. What happens when an employee already exists because they belong to another organization or previously used EaziWage?
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
