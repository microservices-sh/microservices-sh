INSERT INTO services (id, name, description, duration_minutes, price_cents, currency, status, created_at, updated_at)
SELECT 'svc-consultation', 'Consultation', 'A first booking flow for discovery calls or appointments.', 60, 0, 'USD', 'active', datetime('now'), datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM services WHERE id = 'svc-consultation');

INSERT INTO services (id, name, description, duration_minutes, price_cents, currency, status, created_at, updated_at)
SELECT 'svc-standard', 'Standard Service', 'A flexible service slot for local operators.', 45, 0, 'USD', 'active', datetime('now'), datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM services WHERE id = 'svc-standard');
