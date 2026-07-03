
ALTER TABLE advances
  ADD COLUMN payment_method_id UUID REFERENCES payment_methods(id),
  ADD COLUMN payment_method_snapshot JSONB;

