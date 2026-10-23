ALTER TABLE ai_runs DROP CONSTRAINT ai_runs_status_check;
ALTER TABLE ai_runs ADD CONSTRAINT ai_runs_status_check
    CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled'));
ALTER TABLE ai_runs ADD COLUMN cancel_requested boolean NOT NULL DEFAULT false;
ALTER TABLE ai_runs ADD COLUMN execution_descriptor jsonb;

CREATE TABLE ai_operations (
    operation_id uuid PRIMARY KEY,
    run_id uuid NOT NULL UNIQUE REFERENCES ai_runs(run_id),
    input_hash text NOT NULL,
    execution_hash text NOT NULL,
    request_hash text NOT NULL,
    request_body bytea NOT NULL,
    state text NOT NULL CHECK (state IN ('sending', 'responded', 'unknown')),
    send_count smallint NOT NULL DEFAULT 1 CHECK (send_count = 1),
    response_ref uuid UNIQUE,
    raw_response bytea,
    output_json jsonb,
    returned_model text,
    provider_request_id text,
    usage jsonb,
    error_code text,
    sent_at timestamptz NOT NULL DEFAULT now(),
    responded_at timestamptz,
    CHECK ((state = 'responded' AND response_ref IS NOT NULL AND raw_response IS NOT NULL AND responded_at IS NOT NULL)
           OR (state IN ('sending', 'unknown') AND response_ref IS NULL AND raw_response IS NULL AND responded_at IS NULL))
);
