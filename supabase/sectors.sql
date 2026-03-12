create table public.sectors (
  id uuid not null default gen_random_uuid (),
  name text not null,
  industry text not null,
  created_at timestamp with time zone not null default now(),
  constraint sectors_pkey primary key (id)
) TABLESPACE pg_default;

-- Enable Row Level Security
ALTER TABLE public.sectors ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read sectors
CREATE POLICY "Allow all authenticated users to read sectors"
    ON public.sectors FOR SELECT
    TO authenticated
    USING (true);

-- Seed data for industries
INSERT INTO public.sectors (name, industry) VALUES
-- Agriculture
('Crop Production', 'agriculture'),
('Animal Production', 'agriculture'),
('Forestry & Logging', 'agriculture'),
('Fishing & Aquaculture', 'agriculture'),
('Support Activities for Agriculture', 'agriculture'),

-- Manufacturing
('Food & Beverage', 'manufacturing'),
('Textiles & Apparel', 'manufacturing'),
('Chemicals & Pharmaceuticals', 'manufacturing'),
('Electronics & Electrical Equipment', 'manufacturing'),
('Machinery & Equipment', 'manufacturing'),
('Furniture Manufacturing', 'manufacturing'),

-- Construction
('Residential Construction', 'construction'),
('Commercial Construction', 'construction'),
('Infrastructure & Civil Engineering', 'construction'),
('Specialized Trade Contractors', 'construction'),

-- Retail
('Fashion & Accessories', 'retail'),
('Consumer Electronics', 'retail'),
('Supermarkets & Groceries', 'retail'),
('E-commerce', 'retail'),
('Home & Furniture Retail', 'retail'),

-- Hospitality
('Hotels & Accommodation', 'hospitality'),
('Restaurants & Food Service', 'hospitality'),
('Tourism & Travel Agencies', 'hospitality'),
('Events & Recreation', 'hospitality'),

-- Healthcare
('Hospitals & Clinics', 'healthcare'),
('Pharmaceutical Services', 'healthcare'),
('Medical Diagnostics', 'healthcare'),
('Health Insurance Support', 'healthcare'),

-- Education
('Primary & Secondary Education', 'education'),
('Higher Education (Universities)', 'education'),
('Vocational & Technical Training', 'education'),
('E-learning & EdTech', 'education'),

-- Financial Services
('Banking & Microfinance', 'financial_services'),
('Insurance', 'financial_services'),
('Fintech & Payments', 'financial_services'),
('Asset Management & Investment', 'financial_services'),

-- Technology
('Software Development', 'technology'),
('IT Services & Consulting', 'technology'),
('Cybersecurity', 'technology'),
('Telecommunications', 'technology'),
('Cloud Services', 'technology'),

-- Transport
('Logistics & Freight', 'transport'),
('Aviation & Airlines', 'transport'),
('Shipping & Maritime', 'transport'),
('Public Transport & Rail', 'transport'),

-- Professional Services
('Legal Services', 'professional_services'),
('Accounting & Auditing', 'professional_services'),
('Management Consulting', 'professional_services'),
('Marketing & Advertising', 'professional_services'),

-- Government
('Public Administration', 'government'),
('Defense & Security', 'government'),
('Social Security & Public Welfare', 'government'),

-- NGO
('International Foundations', 'ngo'),
('Local Non-Profit Organizations', 'ngo'),
('Charitable Trusts', 'ngo'),

-- Other
('Media & Entertainment', 'other'),
('General Business Services', 'other'),
('Personal Services', 'other');