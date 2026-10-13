## ADDED Requirements

### Requirement: Private bookmark lifecycle
The system SHALL persist authenticated users' bookmarks with PRD title, absolute HTTP/HTTPS URL, optional group and note rules, allow duplicate URLs, support existing-value edits and cancel without mutation, and require explicit irreversible deletion confirmation.

#### Scenario: Save and return
- **WHEN** an authenticated user saves a valid bookmark without a group and returns after login
- **THEN** the same persisted private bookmark is available in ungrouped, with its note and safe new-tab link action

#### Scenario: Invalid input or foreign resource
- **WHEN** an input exceeds its code-point limit, has an invalid URL, or targets another user's resource/group
- **THEN** the operation is rejected without mutation or private data disclosure and the current draft is retained

### Requirement: Consistent find and pagination
The system SHALL use title/URL literal substring search, trimmed keywords and ASCII case-insensitivity, group AND keyword filtering, stable updated_at/id sorting, ten items per page, valid last-page fallback and counts unaffected by search.

#### Scenario: Search and delete last page item
- **WHEN** a user changes search/group, or removes the final item of an invalidated page
- **THEN** a new filter starts at page one and deletion returns the last valid page with consistent total and group counts

### Requirement: Durable operation recovery
The system SHALL guard each submission intent, persist its resource changes and minimal operation receipt atomically, replay the same key/content without further mutation and reject key-content conflicts. Uncertain transport results SHALL remain unknown until resolve confirms a terminal result or fences a not-started operation.

#### Scenario: Commit response lost
- **WHEN** a save committed but its response is lost
- **THEN** the draft remains, new submission is disabled and resolving the old key reveals success without a duplicate bookmark

#### Scenario: Resolve wins before late write
- **WHEN** resolve locks the user's scope before the original request starts
- **THEN** it persists not_executed and every subsequent write with that key is blocked

### Requirement: Existing host and reusable UI states
The system SHALL use project components, tokens, theme and language settings; provide desktop/mobile navigation, a shared create/edit form, targeted delete confirmation, note display, loading/empty/error/stale feedback and keyboard/field semantics. Account changes SHALL clear private state and reject late responses.

#### Scenario: Switch account during request
- **WHEN** a response arrives after logout or a new session
- **THEN** it cannot display or mutate the preceding user's bookmarks, draft or operation state

#### Scenario: Save failure and refresh failure
- **WHEN** a trusted business failure or a successful save followed by failed refresh occurs
- **THEN** the former preserves input and allows correction while the latter reports saved-but-stale instead of inviting another save
