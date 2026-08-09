# Implementation Plan

- [x] 1. Establish the v1.6 company data contract
  - Add classification constants, model defaults, validation, selectors, statistics, and CSV columns.
  - Update core fixtures and tests; preserve parser/Popup boundary changes already in progress.
  - _Requirements: R1, R2, R8_

- [x] 2. Rebuild the shared TDesign dashboard
  - Implement the approved navigation, statistics, list tracks, company logo, application metadata, and horizontal Steps.
  - Replace the legacy layered visual theme with one TDesign token system.
  - _Requirements: R3, R4, R5_

- [x] 3. Integrate extension editing workflows
  - Add company classification fields, row operations, preselected application creation, and progress/action placement.
  - Preserve CSV, sync, capacity, CRUD, and two-step cascade deletion behavior.
  - _Requirements: R1, R6, R8_

- [ ] 4. Integrate the read-only Web dashboard
  - Pass recruitment filters through Web state and apply mobile responsive rules without mutation handlers.
  - Verify snapshot states and the read-only component boundary.
  - _Requirements: R3, R4, R5, R7_

- [ ] 5. Complete regression and browser acceptance
  - Update acceptance documentation and E2E expectations.
  - Run lint, tests, builds, responsive browser flows, accessibility checks, and CloudBase code review.
  - _Requirements: R1-R8_
