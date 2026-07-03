
-- organizations schema was retired (FIX-17). organization_id on employees is a legacy
-- column kept for backward compat — drop the NOT NULL so the sync trigger can insert
-- new employees without it.
ALTER TABLE employees ALTER COLUMN organization_id DROP NOT NULL;

