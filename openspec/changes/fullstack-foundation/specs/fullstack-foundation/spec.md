## ADDED Requirements

### Requirement: Unified fullstack bootstrap
The repository SHALL provide independently runnable frontend, backend and AI services with one documentation and delivery entrypoint.

#### Scenario: Clean checkout
- WHEN the documented Compose startup and smoke commands run
- THEN all applications, migrations and the Worker are checked against real dependencies.

### Requirement: Durable deterministic run
The AI service SHALL separate command acceptance from execution and persist both commands and graph checkpoints.

#### Scenario: Duplicate command or interrupted publication
- WHEN a request is repeated or a Worker restarts after checkpoint persistence
- THEN the same scoped Run is reused and terminal publication remains immutable.

### Requirement: Single-source documentation
Changes SHALL link a REQ-ID, architecture, provider schema, tasks and evidence without per-service duplicate progress.

#### Scenario: Contract changes
- WHEN runtime OpenAPI differs from its committed snapshot
- THEN contract validation fails until the generated snapshot and consumers are reviewed.
