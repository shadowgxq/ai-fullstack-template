# Template hygiene

## ADDED Requirements

### Requirement: Single active source
The repository SHALL keep one root engineering/product/contract system and one skill source, SHALL delete obsolete product worktrees, and SHALL archive merged changes while preserving current unapproved requirements.

#### Scenario: Stale tool context
- **WHEN** a duplicate project root, skill or obsolete execution-guidance path is introduced
- **THEN** repository validation fails

### Requirement: Boundaries match implementation
Service transactions SHALL own commits. Backend core and AI application SHALL not import concrete business/storage adapters against their declared dependency directions.

#### Scenario: Rolled back registration
- **WHEN** an operation following a repository insert fails inside its service transaction
- **THEN** no inserted user remains committed

### Requirement: Authentication fails safely
Security-dependent Redis failures SHALL return 503, validation SHALL exclude input/ctx, and JSON login SHALL advertise HTTP Bearer rather than OAuth2 form exchange.

#### Scenario: Failed logout persistence
- **WHEN** the revocation write fails
- **THEN** logout returns 503 rather than claiming success

### Requirement: Single Worker authority
The Worker SHALL use its lock-owning PostgreSQL session for checkpoint writes.

#### Scenario: Lost lock session
- **WHEN** the lock session is terminated before graph execution
- **THEN** the stale worker cannot checkpoint and a new worker can resume the pending command

### Requirement: Optional AI startup
The repository SHALL support frontend/backend startup without AI, while retaining a verified full-stack mode.

#### Scenario: Web-only development
- **WHEN** make up-web and make smoke-web execute
- **THEN** frontend/backend work without a running AI service or Worker
