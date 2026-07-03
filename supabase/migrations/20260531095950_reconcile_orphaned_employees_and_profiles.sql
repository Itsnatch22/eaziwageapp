
-- Mark Kamau (kamau@gmail.com) → Odongo (employers.id = d1976efe, org = 6977d33f)
UPDATE public.employees
SET employer_id = 'd1976efe-6f9e-4819-b2fb-45631cdb89fe',
    organization_id = '6977d33f-a43c-4334-91ea-a9eef840f09a'
WHERE user_id = 'ca9a3033-e8a5-4a10-b7c1-436014f5215b';

UPDATE public.profiles
SET organization_id = '6977d33f-a43c-4334-91ea-a9eef840f09a'
WHERE id = 'ca9a3033-e8a5-4a10-b7c1-436014f5215b';

-- Wilberforce Otunga (willy@naivas.co.ke) → Naivas (employers.id = f9ffd1e3, org = 653ad5d9)
UPDATE public.employees
SET employer_id = 'f9ffd1e3-a2fb-4fd6-aa85-3059c7f08c76',
    organization_id = '653ad5d9-d97c-4b1b-8e00-079f635eb3ad'
WHERE user_id = 'f24fe8a4-5e5d-41b4-a69c-efb5c97726a5';

UPDATE public.profiles
SET organization_id = '653ad5d9-d97c-4b1b-8e00-079f635eb3ad'
WHERE id = 'f24fe8a4-5e5d-41b4-a69c-efb5c97726a5';

-- Joel Omolo (joendoho@gmail.com) → Notion Labs (employers.id = 7b3449aa, org = 09d793c0)
UPDATE public.employees
SET employer_id = '7b3449aa-540b-4b49-84dd-9badd97ad11a',
    organization_id = '09d793c0-19b5-413e-b924-8896f7b81ac0'
WHERE user_id = '434b4dac-587c-4e5b-8f35-193dec052364';

UPDATE public.profiles
SET organization_id = '09d793c0-19b5-413e-b924-8896f7b81ac0'
WHERE id = '434b4dac-587c-4e5b-8f35-193dec052364';

-- Mark Kamau (markkamau890@gmail.com) → Notion Labs
UPDATE public.employees
SET employer_id = '7b3449aa-540b-4b49-84dd-9badd97ad11a',
    organization_id = '09d793c0-19b5-413e-b924-8896f7b81ac0'
WHERE user_id = '8b8d7e6f-ec81-4e9b-80b6-916960a02453';

UPDATE public.profiles
SET organization_id = '09d793c0-19b5-413e-b924-8896f7b81ac0'
WHERE id = '8b8d7e6f-ec81-4e9b-80b6-916960a02453';

