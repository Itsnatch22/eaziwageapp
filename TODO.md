# TODO - Employee onboarding payout bank selector

- [ ] Add per-country bank lists to `app/dashboards/employee-dashboard/onboarding/page.tsx`.
- [ ] Update Step 7 (“Payout”) so employees can select **their bank they have enrolled in** from the list based on selected country.
- [ ] Keep the bank account number as a free-text input.
- [ ] Ensure validation (`canProceed` case 7) still works.
- [ ] Ensure POST `/api/employee-dashboard/onboarding` receives the selected `bank_name` value.

