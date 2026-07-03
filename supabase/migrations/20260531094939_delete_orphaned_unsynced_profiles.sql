
DELETE FROM public.profiles
WHERE organization_id IS NULL
AND id NOT IN (
  SELECT user_id FROM public.employees WHERE user_id IS NOT NULL
)
AND id IN (
  '5d0831cf-d3e2-441e-88fc-a9bcc22c43fa', -- Abdi Rahman
  '111fcc59-567f-4a74-adbc-be3f98069ac1', -- Albert Edrick
  '1a148242-45e2-4aa3-853c-5dac01fdc5b1', -- Sammy Uwimana
  '477dfcd3-a28c-4713-b969-7b1fed954faf', -- Omondi John
  '4a76bded-a530-47db-9ec5-46fd50fa52c7', -- JAC
  'cefff671-4738-4565-9002-3f1b9a418809'  -- Abagucci Mkenya
);

