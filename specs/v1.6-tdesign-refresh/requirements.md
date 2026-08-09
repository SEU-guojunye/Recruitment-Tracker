# Recruitment Tracker v1.6 TDesign Refresh Requirements

## Problem and scope

The production React dashboards still implement the v1.5 information architecture and data contract. This change aligns the shared extension/Web experience with `PRD.md` v1.6 and `dashboard-tdesign.html`, while preserving the existing local-first CRUD, CSV, progress editing, CloudBase snapshot, and read-only Web boundaries.

## Product decisions

- `industryType` is optional and may contain a preset or future custom value.
- `recruitmentBatch` defaults to `秋招正式批` and only accepts the three PRD values.
- `priority` defaults to `P1` and only accepts `P0`, `P1`, or `P2`.
- `companyNotes` remains a compatibility field but is never collected, displayed, updated, or exported with new content.
- Existing development data is not migrated; the schema version remains `1` as required by the PRD.
- Company logos are derived at render time from `recruitmentLink`; icon URLs are not parsed, stored, exported, or synchronized.
- The detailed Steps rules override the generic mobile single-line rule: progress labels may wrap so every stage remains understandable.
- No separate current-progress summary is rendered; Steps, `aria-current`, and the latest update field communicate the state.

## User stories and acceptance criteria

### R1. Company data contract

As an editor, I want to classify companies by industry, recruitment batch, and priority so that I can filter and prioritize follow-up work.

- When a company is created without classification fields, the system shall store an empty `industryType`, `秋招正式批`, and `P1`.
- When a company is saved or imported, the system shall reject unsupported recruitment batches and priorities before writing data.
- When legacy `companyNotes` content exists, the system shall preserve it internally without exposing or updating it through v1.6 interfaces.

### R2. Parser and Popup boundary

As an editor capturing a recruitment page, I want the parser to save only company-level source information so that no application data is inferred.

- When parsing succeeds or fails, the parser shall return an ISO 8601 UTC `parsedAt` value.
- When the Popup displays parsed data, it shall show only company name and recruitment link and shall not show company notes or classification fields.

### R3. Recruitment information view

As an editor or read-only viewer, I want to scan recruitment companies in a stable table/card layout.

- When the recruitment tab is active, the system shall show company logo/name, industry, batch, priority, recruitment link, application count, latest update, and allowed actions.
- When keyword, priority, and industry filters are set, the system shall combine them with AND semantics.
- When a company icon cannot be loaded, the system shall show the first two company-name characters without a broken-image placeholder.

### R4. Application view

As a user, I want applications grouped by company with each application’s metadata and progress kept independent.

- When the application tab is active, each company summary shall show company, application link, application count, and visible application names without recent-progress badges.
- When a company is expanded, each visible application shall show job title, application link, location, applied date, latest update date, and its own progress Steps.
- When the user changes one application, the system shall not change another application under the same company.

### R5. TDesign Steps and accessibility

As a keyboard and screen-reader user, I want progress state communicated by structure and text as well as color.

- When Steps are rendered at any supported viewport, the system shall keep them horizontal without requiring horizontal scrolling.
- When a step is current, the system shall apply `aria-current="step"`, a brand-blue filled marker, a focus ring, and current-state text.
- When a step is completed, the system shall render a check mark and brand-blue connector; upcoming steps shall use neutral markers and connectors.

### R6. Editable extension behavior

As the desktop editor, I want existing write workflows available in the refreshed layout.

- When “投递” is selected from a recruitment row, the system shall open the new-application form with that company selected.
- When classification text or “编辑” is selected, the system shall open the company editor with current values.
- When application progress is edited, the edit entry shall sit beside the progress title while quick switching, application editing, and deletion remain available.

### R7. Read-only Web behavior

As a mobile viewer, I want the same data hierarchy without any mutation capability.

- While Web mode is read-only, the system shall not render or bind company, application, progress, CSV, or upload mutations.
- At 320, 360, 390, and 430 px widths, the system shall show two-column statistics and responsive list cards without page-level horizontal overflow.

### R8. CSV and regression safety

As an editor, I want exports and imports to preserve all v1.6 business data safely.

- When exporting, the CSV shall contain `industryType`, `recruitmentBatch`, and `priority`, and shall emit an empty `companyNotes` compatibility cell.
- When importing valid v1.6 CSV, the system shall preserve classification fields and reject invalid closed-enum values atomically.
- After each implementation stage, lint and the relevant tests shall pass before the stage is committed.

## Non-goals

- Storing binary logos, favicon URLs, or a separate company domain field.
- Inferring classification fields in the parser.
- Migrating pre-v1.6 development data.
- Changing CloudBase authentication, database structure, or deployment configuration.
