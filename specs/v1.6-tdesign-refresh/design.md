# Recruitment Tracker v1.6 TDesign Refresh Design

## Architecture

The existing workspace boundaries remain unchanged:

- `packages/core`: canonical model creation, validation, selectors, statistics, CSV, and snapshot validation.
- `packages/ui`: shared read-only presentation primitives and TDesign styling.
- `apps/extension`: local editable state, dialogs, CSV, sync, and mutation handlers.
- `apps/web`: authenticated CloudBase snapshot reader and read-only state orchestration.

Data-contract work precedes UI work so both runtime surfaces consume the same canonical fields.

## Data model

`CompanyRecord` adds:

```js
{
  industryType: '',
  recruitmentBatch: '秋招正式批',
  priority: 'P1'
}
```

`industryType` is an open string with preset UI options. Batch and priority use exported constant lists and strict validation. `companyNotes` stays in the in-memory record for compatibility; new records receive an empty string and CSV export always emits an empty compatibility cell.

## Selectors and state

- Recruitment statistics calculate `p0CompanyCount` instead of active-company count.
- Company search indexes company name, recruitment link, industry, batch, and priority.
- Application search indexes the same company fields plus application title, URLs, location, and notes.
- Recruitment filtering accepts `priority` and `industryType` and combines both with the keyword query.
- Extension and Web keep filter state locally and pass it to the shared `DashboardView`.

## UI component boundaries

- `CompanyLogo`: validates the recruitment URL hostname, builds a FaviconKit URL, and manages load/failure fallback locally.
- `ProgressSteps`: converts core timeline states to accessible TDesign-style horizontal Steps.
- `ApplicationCompanyList`: fixed shared column tracks plus responsive company/application detail layouts.
- `RecruitmentCompanyList`: fixed eight-column desktop tracks and paired mobile fields.
- `DashboardToolbar`: tab-specific search and two-filter groups in the panel header.
- `DashboardView`: layout and read-only rendering only; mutation controls continue to be injected by the extension.

## Visual system

The implementation follows the approved TDesign prototype: `#0052D9` brand blue, neutral page/container surfaces, 6 px component radius, 64 px list rows, 13 px table text, tabular numeric fields, restrained level-one shadows, and `Noto Sans SC` typography. The dashboard stays light because an automatic dark theme is not part of the approved prototype.

## Company icon security and failure behavior

Only the parsed hostname is sent to `https://ico.faviconkit.net/favicon/{encoded-hostname}?sz=64`. The full path and query string are never transmitted. The `<img>` uses an empty `alt`, and invalid URLs, invalid hostnames, zero-width images, and load failures all retain the text fallback. No icon request blocks list rendering.

## Compatibility and rollout

The PRD explicitly excludes old-data migration and keeps schema version `1`. Development storage and fixtures will be recreated with canonical fields. Snapshot readers and repositories continue validating through the shared core contract.

## Verification strategy

- Core: model defaults, enum validation, filters, statistics, CSV round trip and atomic rejection.
- UI: accessible tab names, table content, FaviconKit URL/fallback, horizontal Steps and `aria-current`.
- Extension: company/application CRUD, preselected company, classification edits, cascade deletion, progress workflows, CSV and sync actions.
- Web: auth/snapshot states, read-only mutation boundary, responsive viewport checks.
- Final: lint, unit tests, both builds, Playwright/browser smoke checks, and CloudBase project code review.
