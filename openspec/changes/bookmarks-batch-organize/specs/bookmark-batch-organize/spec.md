## ADDED Requirements

### Requirement: Private atomic batch move
The system SHALL move 1–10 distinct current-user bookmark IDs to one owned group or ungrouped in one transaction, with authenticated ownership on every source and target. Any unavailable source or target MUST reject the complete operation without disclosing private data or partially moving bookmarks.

#### Scenario: Valid mixed-source move
- **WHEN** the authenticated user moves valid bookmarks including some already in the target
- **THEN** only changed-group rows receive one shared update time and changed_count; same-target rows keep their timestamps and no duplicate is created

#### Scenario: Unavailable or foreign object
- **WHEN** any source or target is missing or belongs to another user
- **THEN** the request returns 40914 and all bookmarks remain unchanged, with a durable failed receipt

#### Scenario: Failure and competing writes
- **WHEN** a mid-operation exception or another edit/group deletion competes with the move
- **THEN** real PostgreSQL verification proves complete rollback or a consistent serialized outcome, never a partial move

### Requirement: Idempotent batch outcome recovery
The system SHALL use the existing operation ledger and resolve protocol for batch_move. Equivalent ID ordering MUST replay one result, a changed target MUST conflict under the same key, and resolve MUST prevent a not-yet-started old request from executing later.

#### Scenario: Replay and no-op
- **WHEN** the same intent is replayed with reordered IDs, including an all-same-target intent
- **THEN** the same batch_move result returns resource_id null and the original changed_count, without updating timestamps again

#### Scenario: Unknown result
- **WHEN** transport cannot confirm a submitted batch result
- **THEN** the frontend preserves the original intent/key and resolves it, showing succeeded, failed or not_executed honestly without resubmitting automatically

### Requirement: Current-page selection and recovery
The UI SHALL select only bookmarks on the current actual page, show the selection count and indeterminate/all-selected states, and disable moving an empty selection. Page/filter/history changes MUST clear selection; cancel MUST not write. Explicit failure SHALL retain still-actionable current-page selections after refresh; success SHALL clear selection and refresh counts/list with server page correction.

#### Scenario: Change browsing conditions
- **WHEN** the user changes keyword, group, page or navigation history after selecting items
- **THEN** the selection clears and old/loading-page rows cannot be moved as the new page

#### Scenario: Cancel, success and invalid page
- **WHEN** the user cancels, or successfully moves the last item off the current page
- **THEN** cancel changes no bookmark and success refreshes to the last valid page with current counts and an empty selection

#### Scenario: Failed or unknown move
- **WHEN** a move explicitly fails or remains unknown
- **THEN** explicit failure retains only valid actionable selection after refresh, while unknown preserves the original operation context and blocks duplicate/new conflicting actions until resolved

### Requirement: Complete workflow integration
The implementation SHALL verify the joined M1–M3 API/database and frontend logical workflow, preserve account/session isolation and shared UI/Token semantics, and report runtime/visual checks separately from code verification.

#### Scenario: Save, find and organize
- **WHEN** two authenticated accounts save, search/page, group, batch move, rename/delete groups and revisit their own collections
- **THEN** real HTTP plus PostgreSQL and frontend state checks prove persistent correct counts/order/page/recovery and no cross-account data, with final human acceptance still pending
