CREATE TABLE IF NOT EXISTS households (
  id uuid PRIMARY KEY,
  created_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS take_home_facts (
  id uuid PRIMARY KEY,
  household_id uuid NOT NULL REFERENCES households (id),
  context_id text NOT NULL,
  label text NOT NULL,
  amount_cents integer NOT NULL,
  cadence text NOT NULL,
  unit text NOT NULL,
  revision integer NOT NULL,
  confirmed_at timestamptz NOT NULL,
  origin text NOT NULL,
  UNIQUE (household_id, context_id)
);

CREATE TABLE IF NOT EXISTS plans (
  id uuid PRIMARY KEY,
  household_id uuid NOT NULL REFERENCES households (id),
  name text NOT NULL,
  tool_id text NOT NULL,
  tool_version text NOT NULL,
  input jsonb NOT NULL,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL,
  idempotency_key text,
  UNIQUE (household_id, idempotency_key)
);
