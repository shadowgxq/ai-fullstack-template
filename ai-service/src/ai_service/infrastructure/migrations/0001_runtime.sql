CREATE TABLE ai_runs (
    run_id uuid PRIMARY KEY,
    scope text NOT NULL,
    request_key text NOT NULL,
    request_hash text NOT NULL,
    workflow text NOT NULL,
    input jsonb NOT NULL,
    status text NOT NULL CHECK (status IN ('queued', 'running', 'completed', 'failed')),
    output jsonb,
    error_code text,
    last_sequence integer NOT NULL DEFAULT 1 CHECK (last_sequence > 0),
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (scope, request_key)
);
CREATE TABLE ai_commands (
    run_id uuid PRIMARY KEY REFERENCES ai_runs(run_id),
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE ai_events (
    run_id uuid NOT NULL REFERENCES ai_runs(run_id),
    sequence integer NOT NULL,
    event_type text NOT NULL,
    payload jsonb NOT NULL,
    PRIMARY KEY (run_id, sequence)
);
