-- "Media & Entertainment" is being promoted from a sector under "other" to its
-- own industry below — remove the old sector row so it isn't duplicated.
DELETE FROM public.sectors WHERE industry = 'other' AND name = 'Media & Entertainment';

INSERT INTO public.sectors (name, industry) VALUES
  -- agriculture
  ('Horticulture & Floriculture', 'agriculture'),
  ('Agro-Processing', 'agriculture'),
  ('Dairy Farming', 'agriculture'),
  -- manufacturing
  ('Plastics & Packaging', 'manufacturing'),
  ('Cement & Building Materials', 'manufacturing'),
  ('Paper & Printing', 'manufacturing'),
  -- construction
  ('Architecture & Engineering Design', 'construction'),
  -- retail
  ('Pharmacies & Health Retail', 'retail'),
  ('Automotive Retail & Dealerships', 'retail'),
  -- hospitality
  ('Catering Services', 'hospitality'),
  -- healthcare
  ('Veterinary Services', 'healthcare'),
  ('Elderly & Home Care', 'healthcare'),
  -- education
  ('Early Childhood Education', 'education'),
  ('Research Institutions', 'education'),
  -- financial_services
  ('Sacco & Cooperative Societies', 'financial_services'),
  ('Forex Bureaus', 'financial_services'),
  -- technology
  ('Mobile App Development', 'technology'),
  ('Data Centers & Hosting', 'technology'),
  -- transport
  ('Courier & Delivery Services', 'transport'),
  ('Vehicle Rental & Leasing', 'transport'),
  -- professional_services
  ('Human Resources & Recruitment', 'professional_services'),
  ('Translation & Interpretation Services', 'professional_services'),
  -- government
  ('Diplomatic Missions & Embassies', 'government'),
  -- ngo
  ('Humanitarian & Relief Organizations', 'ngo'),
  ('Advocacy & Human Rights Organizations', 'ngo'),
  -- other
  ('Sports & Recreation', 'other'),
  ('Religious Organizations', 'other'),
  -- energy_utilities (new industry)
  ('Electricity Generation & Distribution', 'energy_utilities'),
  ('Renewable Energy (Solar, Wind, Geothermal)', 'energy_utilities'),
  ('Water & Sanitation Utilities', 'energy_utilities'),
  ('Oil & Gas Distribution', 'energy_utilities'),
  -- real_estate (new industry)
  ('Property Development', 'real_estate'),
  ('Real Estate Brokerage & Sales', 'real_estate'),
  ('Property Management', 'real_estate'),
  ('Facilities Management', 'real_estate'),
  -- mining_extractives (new industry)
  ('Mining & Quarrying', 'mining_extractives'),
  ('Oil & Gas Exploration', 'mining_extractives'),
  ('Gemstones & Precious Metals', 'mining_extractives'),
  -- wholesale_distribution (new industry)
  ('Wholesale Trade', 'wholesale_distribution'),
  ('Import & Export', 'wholesale_distribution'),
  ('Supply Chain & Distribution', 'wholesale_distribution'),
  -- media_entertainment (new industry)
  ('Broadcasting (TV & Radio)', 'media_entertainment'),
  ('Publishing (Print & Digital)', 'media_entertainment'),
  ('Film, Music & Entertainment Production', 'media_entertainment'),
  ('Advertising Agencies & PR', 'media_entertainment'),
  ('Gaming & Digital Entertainment', 'media_entertainment');
