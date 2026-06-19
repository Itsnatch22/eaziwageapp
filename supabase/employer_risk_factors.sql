create table public.employer_risk_factors (
  id uuid not null default gen_random_uuid (),
  employer_id uuid not null,
  registration_status numeric(3, 1) null default 3,
  tax_compliance numeric(3, 1) null default 3,
  ewa_agreement numeric(3, 1) null default 3,
  audited_financials numeric(3, 1) null default 3,
  liquidity_ratio numeric(3, 1) null default 3,
  payroll_sustainability numeric(3, 1) null default 3,
  employee_count numeric(3, 1) null default 3,
  churn_rate numeric(3, 1) null default 3,
  payroll_integration numeric(3, 1) null default 3,
  industry_risk numeric(3, 1) null default 3,
  regulatory_exposure numeric(3, 1) null default 3,
  beneficial_ownership numeric(3, 1) null default 3,
  pep_screening numeric(3, 1) null default 3,
  composite_score numeric GENERATED ALWAYS as (
    round(
      (
        (
          (
            (
              (
                (
                  (
                    (registration_status + tax_compliance) + ewa_agreement
                  ) / 3.0
                ) * 0.20
              ) + (
                (
                  (
                    (audited_financials + liquidity_ratio) + payroll_sustainability
                  ) / 3.0
                ) * 0.35
              )
            ) + (
              (
                (
                  (employee_count + churn_rate) + payroll_integration
                ) / 3.0
              ) * 0.20
            )
          ) + (
            ((industry_risk + regulatory_exposure) / 2.0) * 0.15
          )
        ) + (
          ((beneficial_ownership + pep_screening) / 2.0) * 0.10
        )
      ),
      2
    )
  ) STORED (4, 2) null,
  scored_by uuid null,
  scored_at timestamp with time zone not null default now(),
  notes text null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint employer_risk_factors_pkey primary key (id),
  constraint risk_factors_employer_unique unique (employer_id),
  constraint employer_risk_factors_scored_by_fkey foreign KEY (scored_by) references auth.users (id),
  constraint employer_risk_factors_employer_id_fkey foreign KEY (employer_id) references employer_onboarding (id) on delete CASCADE,
  constraint employer_risk_factors_ewa_agreement_check check (
    (
      (ewa_agreement >= (0)::numeric)
      and (ewa_agreement <= (5)::numeric)
    )
  ),
  constraint employer_risk_factors_industry_risk_check check (
    (
      (industry_risk >= (0)::numeric)
      and (industry_risk <= (5)::numeric)
    )
  ),
  constraint employer_risk_factors_liquidity_ratio_check check (
    (
      (liquidity_ratio >= (0)::numeric)
      and (liquidity_ratio <= (5)::numeric)
    )
  ),
  constraint employer_risk_factors_audited_financials_check check (
    (
      (audited_financials >= (0)::numeric)
      and (audited_financials <= (5)::numeric)
    )
  ),
  constraint employer_risk_factors_payroll_sustainability_check check (
    (
      (payroll_sustainability >= (0)::numeric)
      and (payroll_sustainability <= (5)::numeric)
    )
  ),
  constraint employer_risk_factors_pep_screening_check check (
    (
      (pep_screening >= (0)::numeric)
      and (pep_screening <= (5)::numeric)
    )
  ),
  constraint employer_risk_factors_registration_status_check check (
    (
      (registration_status >= (0)::numeric)
      and (registration_status <= (5)::numeric)
    )
  ),
  constraint employer_risk_factors_regulatory_exposure_check check (
    (
      (regulatory_exposure >= (0)::numeric)
      and (regulatory_exposure <= (5)::numeric)
    )
  ),
  constraint employer_risk_factors_tax_compliance_check check (
    (
      (tax_compliance >= (0)::numeric)
      and (tax_compliance <= (5)::numeric)
    )
  ),
  constraint employer_risk_factors_payroll_integration_check check (
    (
      (payroll_integration >= (0)::numeric)
      and (payroll_integration <= (5)::numeric)
    )
  ),
  constraint employer_risk_factors_beneficial_ownership_check check (
    (
      (beneficial_ownership >= (0)::numeric)
      and (beneficial_ownership <= (5)::numeric)
    )
  ),
  constraint employer_risk_factors_churn_rate_check check (
    (
      (churn_rate >= (0)::numeric)
      and (churn_rate <= (5)::numeric)
    )
  ),
  constraint employer_risk_factors_employee_count_check check (
    (
      (employee_count >= (0)::numeric)
      and (employee_count <= (5)::numeric)
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_risk_factors_employer on public.employer_risk_factors using btree (employer_id) TABLESPACE pg_default;

create trigger employer_risk_factors_updated_at BEFORE
update on employer_risk_factors for EACH row
execute FUNCTION update_updated_at ();

create trigger sync_risk_score_on_upsert
after INSERT
or
update on employer_risk_factors for EACH row
execute FUNCTION sync_employer_risk_score ();

create trigger trg_sync_risk_score
after INSERT
or
update on employer_risk_factors for EACH row
execute FUNCTION fn_sync_employer_risk_score ();