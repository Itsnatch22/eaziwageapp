# Redefined workflow for respective dashboards

The user requires you to refactor his codebase using the defined tasks that he has provided.
Do not touch any other logic, change route, dismantle UI appearance for code components unless the user has stated so.

# Task 1:

`app/admin`
1. /page.tsx - The Reconciliation and Risk-scoring stat cards should fetch realtime from their respective pages in `app/admin/reconciliation` and `app/admin/risk-scoring`.
2. /employers -
    i. The total employees stat card should collect the employees available from the onboarded companies that have already been verified by the admin and display the total number.
    ii. The employer detail modal isn't displaying:
        - Employer code
        -Employees tab isn't showing the employees for the respective companies
3. /review-requests - Reviewing and resolving aren't functioning and updating in realtime seems like it is stuck
4. /reconciliation -
    i. Employers aren't appearing in the page.
    ii. Search isn't working as expected, but I think it's tied to whether employers are visible in the page.
5. /employees - Cannot read properties of null (reading 'toLowerCase')

NOTE: use the standardized currency format for the admin side, you can liase with how `/lib/utils.ts` has implemented it and other files in the `app/admin` dashboard. WHERE APPLICABLE..

# Task 2

`components/admin/CommandPalette.tsx`
6. The admin can't search for employees. Which brings me to question whether the employees are upserting from table schema `supabase/employee_onboarding.sql` to table schema `supabase/employees.sql` and how it's being applied to their respective routes... compare to how the employers are being updated to appear in their respective table with relation to their respective route.

In the table ,from Supabase, employers, the status isn't updating as per required, let's say a scenario where an account has been set to `active` by the admin, in the UI and routes and the change is happening in table `employer_onboarding`, I tend to think it's the upserting that isn't happening as expected.

Please don't tamper with the schema in the `supabase` folder.

# Task 3

Get your references between `app/dashboards/employee-dashboard` and `app/dashboards/employer-dashboard` and their respective routes.

How does Department distribution work when an employee account has been activated? and every employee seems to be falling under general