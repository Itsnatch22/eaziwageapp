# EaziWage Utilities

> **Status:** Exploratory product concept for discussion and validation. This is not an implementation commitment.

## 1. Concept

EaziWage Utilities is a potential layer that would help employees connect, fund, track, or manage recurring services and financial commitments using available or earned wages.

The idea originated with connecting subscription services to EaziWage, but the concept should be broader than subscriptions. The objective is to make it easier for employees to allocate and manage money toward recurring or essential financial commitments.

Utilities should extend EaziWage's existing employee financial experience rather than become a disconnected collection of payment integrations.

## 2. Potential utility categories

The following categories are examples, not a finalized list:

| Category | Possible examples |
| --- | --- |
| Subscriptions | Music streaming, video streaming, cloud storage, productivity software, and other digital services |
| Connectivity | Home internet, mobile data, and recurring communication services |
| Health | Medical fund or card contributions, eligible healthcare payments, and health-related services |
| Insurance and protection | Insurance premiums and other recurring protection plans |
| Household and essential services | Electricity, water, and other household obligations |
| Education | School payments, education subscriptions, and other education expenses |

The first validated use case should be selected based on employee need, provider feasibility, payment reliability, and regulatory suitability rather than category breadth.

## 3. Core model

Utilities should be treated as **financial commitments**, not simply as third-party integrations.

An employee might:

1. Discover an available utility or provider.
2. Connect or authorize the provider where supported.
3. Specify an amount, frequency, or payment plan.
4. Authorize EaziWage to allocate funds.
5. View the commitment, upcoming payment, and current status.
6. Receive reminders or payment notifications.
7. Pause, modify, or cancel the commitment where supported.

Provider connectivity is optional. A commitment could also represent a scheduled or manually managed payment where direct provider authorization is not available.

## 4. Financial allocation

A possible employee view could show the difference between funds that are available, committed, and already settled:

```text
Available earned wage
KSh 18,000

Committed allocations
-----------------------------
Spotify              KSh 299
Internet             KSh 2,500
Medical contribution KSh 1,500
Insurance            KSh 2,000

Uncommitted amount
KSh 11,701
```

The product should distinguish clearly between:

- Available funds
- Reserved or committed funds
- Pending payments
- Completed payments
- Failed payments
- Refunded payments
- Cancelled commitments

The terminology and financial treatment require product, legal, compliance, and financial review. In particular, the team must establish whether funds are merely earmarked, reserved in an EaziWage wallet, or transferred to another party.

An insufficient-balance policy would also be required. Possible outcomes include notifying the employee, retrying within a defined window, reducing the payment, suspending the commitment, or allowing the employee to add funds through an approved method.

## 5. Provider integration model

EaziWage should avoid designing this concept around a single provider. Where practical, the system should support a generic provider and commitment model:

```text
Utility commitment
├── Provider
├── Category
├── Payment frequency
├── Amount or payment plan
├── Authorization method
├── Next payment date
├── Payment status
└── Employee commitment
```

Spotify could therefore be one provider in the subscription category rather than a dedicated EaziWage feature.

Provider capabilities will differ. The model should record what each provider supports, such as authorization, payment initiation, cancellation, pause, refunds, status checks, and webhooks. Unsupported actions should be visible rather than presented as universally available.

## 6. Employee experience

Potential employee dashboard functionality includes:

- View active commitments
- Add a utility
- View upcoming payments
- See committed amounts and the remaining uncommitted amount
- View payment history and failure reasons
- Pause or cancel eligible commitments
- Receive payment reminders and failure notifications
- Understand how commitments affect available funds

The experience should remain optional and employee-controlled. Authorization should be specific, understandable, revocable where supported, and separate from an employee's normal earned-wage access decisions.

## 7. Potential future opportunities

Possible extensions include:

- Utility discovery
- Recurring payment automation
- Employee budgeting
- Financial wellness insights
- Employer-sponsored benefits
- Discounts or negotiated provider rates
- Utility bundles
- Organization-specific benefits or services
- Employer contributions or matching

These opportunities should be validated before being included in the core roadmap. Employer-sponsored utilities would require a clear distinction between an employee-authorized commitment and an employer-funded benefit.

## 8. Smallest useful validation scope

Before building a broad integration platform, a pilot could test one narrowly defined commitment flow:

1. Employees view one approved provider or manually configured utility.
2. Employees set an amount and frequency.
3. EaziWage displays the effect on committed and uncommitted funds.
4. Employees receive an upcoming-payment reminder.
5. The system records a simulated or carefully controlled payment outcome.
6. Employees can pause or cancel the commitment where the pilot rules allow it.
7. The product measures whether the commitment is useful without causing confusion about earned-wage availability.

The pilot should not assume that a successful subscription connection proves demand for every other utility category.

## 9. Questions to validate

Before implementation, EaziWage should investigate:

- Which utilities represent a genuine employee problem?
- Which providers have suitable APIs, payment partnerships, or reliable reconciliation options?
- Should EaziWage initiate payments or only facilitate them?
- Where does money sit during an allocation, and who legally controls it?
- What happens when available wage is insufficient?
- Can employees pause or cancel commitments, and what notice rules apply?
- What happens when a payment fails or a provider becomes unavailable?
- How are refunds, reversals, disputes, and duplicate payments handled?
- Should commitments reduce displayed available wage, withdrawable wage, or both?
- Should employers be able to contribute toward utilities?
- Which utilities are appropriate for an employer-sponsored benefit?
- What regulatory, financial, privacy, security, and contractual requirements apply?
- How will provider credentials, tokens, and payment data be protected?
- What is the smallest useful version of the concept?

## 10. Guiding principle

EaziWage should help employees not only access earned income, but also understand and manage where that income goes.

Any Utilities experience should preserve three principles:

1. **Clarity:** employees can distinguish available, committed, pending, and settled money.
2. **Control:** employees choose which commitments to authorize and can manage them where supported.
3. **Trust:** every payment, failure, change, and cancellation is explainable and traceable.
