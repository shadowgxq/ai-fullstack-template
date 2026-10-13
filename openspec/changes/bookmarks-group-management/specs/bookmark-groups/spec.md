## ADDED Requirements

### Requirement: Private one-level groups
The system SHALL create empty personal groups, rename them without changing bookmark assignment/order, trim names to 1–30 Unicode code points, reject reserved all/ungrouped names, NUL and same-user ASCII case-insensitive duplicates, and prohibit foreign resource access.

#### Scenario: Concurrent duplicate and renamed group
- **WHEN** two same-user creates use equivalent names or a valid group is renamed
- **THEN** the database permits only one name and rename leaves bookmark ordering and timestamps unchanged

### Requirement: Atomic group removal
The system SHALL confirm the target name and current bookmark count and explain transfer to ungrouped; deletion SHALL transfer every contained bookmark and update their timestamps atomically before removing the group, leaving all_count unchanged.

#### Scenario: Changed impact or failure
- **WHEN** expected_count changed or any mutation fails
- **THEN** deletion is rejected or rolled back without partial transfer and the user can inspect updated impact before a new confirmation

#### Scenario: Current group deleted
- **WHEN** the currently viewed group is successfully deleted
- **THEN** the client selects ungrouped, preserves the keyword, clamps invalid pages and refreshes group counts

### Requirement: Group find and shared recovery
The system SHALL combine group/keyword filters, retain unfiltered group counts, offer valid group choices in bookmark forms and support pending/error/unknown recovery through existing key/receipt/resolve behavior for every group action.

#### Scenario: Unknown group write
- **WHEN** a group write loses its response
- **THEN** the input or target is retained, duplicate submission is blocked and resolving the same operation reveals or fences its result
