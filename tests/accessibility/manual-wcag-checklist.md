# B20 manual WCAG 2.2 A/AA checklist

> Candidate status: `LOCAL_VALIDATION_REQUIRED`. This is an auditable execution record, not a conformance claim. No applicable criterion may be changed to PASS without exact-head evidence.

## Execution identity

- Candidate HEAD: `________________`
- Operator: `________________`
- UTC timestamp: `________________`
- Browser/version: `________________`
- OS, viewport and display scale: `________________`
- Keyboard mode and assistive technology: `________________`
- Evidence bundle and SHA-256: `________________`

For every manual procedure record the exact view/control/flow, steps, expected oracle, observed result, screenshot/video/accessibility-tree/log path, artifact SHA-256, operator and timestamp. Valid results are `PASS`, `FAIL` or `BLOCKED`; blank fields, generic assertions and axe-only output are not PASS.

## Required cross-cutting scenarios

| Scenario | Required manual oracle | Result / evidence |
|---|---|---|
| Keyboard | Traverse and activate every primary action with Tab, Shift+Tab, Enter and Space; no pointer-only path. | `PENDING_LOCAL_VALIDATION` |
| Focus visible | Every focused interactive control has a visible indicator. | `PENDING_LOCAL_VALIDATION` |
| Focus not obscured | Sticky UI, dialogs and viewport edges never fully obscure focus. | `PENDING_LOCAL_VALIDATION` |
| Focus return | Closing/cancelling dialogs returns focus to the exact invoker; recovery focuses the resulting target. | `PENDING_LOCAL_VALIDATION` |
| Destructive confirmations | Import, replace, delete and export confirmations state action, consequences, preserved data and cancellation. | `PENDING_LOCAL_VALIDATION` |
| Errors and instructions | Labels, formats and prerequisites precede input; errors identify the field and correction. | `PENDING_LOCAL_VALIDATION` |
| Live regions | Status, error, busy, cancellation and recovery announcements are audible once, atomic and severity-appropriate. | `PENDING_LOCAL_VALIDATION` |
| Busy and disabled | Busy/disabled states are programmatically exposed and not styling-only. | `PENDING_LOCAL_VALIDATION` |
| Tables and graphs | Captions, scoped headers, chart name/description and complete equivalent data communicate the same information. | `PENDING_LOCAL_VALIDATION` |
| Accessible names | Names are unique, contain visible labels and never depend only on placeholders. | `PENDING_LOCAL_VALIDATION` |
| Contrast | Text meets 4.5:1 or 3:1 for large text; UI, focus and non-text boundaries meet 3:1 in every state. | `PENDING_LOCAL_VALIDATION` |
| Text spacing | WCAG text-spacing overrides cause no loss, overlap or truncation. | `PENDING_LOCAL_VALIDATION` |
| Zoom 200% | All content and actions remain visible and operable at 200% zoom. | `PENDING_LOCAL_VALIDATION` |
| Reflow 320 CSS px | No two-dimensional page scroll is required; named data-table regions may scroll locally. | `PENDING_LOCAL_VALIDATION` |
| Target size | Pointer targets meet 24×24 CSS px minimum and primary controls retain the project 44 px target. | `PENDING_LOCAL_VALIDATION` |
| Reduced motion | Reduced-motion preference removes non-essential animation and no information depends on motion. | `PENDING_LOCAL_VALIDATION` |
| Persistent context | Issuer CIK, period, profile and snapshot remain explicit across evidence, metrics, insights and price analysis. | `PENDING_LOCAL_VALIDATION` |
| Error recovery | Recovery actions are reachable, issue-specific, preserve stated capabilities and focus the recovered target. | `PENDING_LOCAL_VALIDATION` |
| Color independence | State, quality, outcome and errors remain understandable in monochrome and are written in text. | `PENDING_LOCAL_VALIDATION` |
| Advice boundary | Insights and price analysis remain descriptive, non-personalized and explicitly not investment advice. | `PENDING_LOCAL_VALIDATION` |

## Applicable criteria — 43 release-blocking records

The normative oracle and test method for every row are the matching entries in `definitions/wcag-2.2-aa-matrix.json` and `fixtures/accessibility/wcag-oracle-inventory.json`. Execute the named manual review plus every relevant cross-cutting scenario above.

| # | Matrix ID — criterion | AC | Manual scope and deterministic evidence required | Result |
|---:|---|---|---|---|
| 1 | SC-1-1-1 — Non-text Content (A) | AC-074 | Charts, icons, statuses and evidence links: verify accessible equivalents and hidden decoration. | `PENDING_LOCAL_VALIDATION` |
| 7 | SC-1-3-1 — Info and Relationships (A) | AC-074 | Headings, landmarks, labels, descriptions, tables, lists and status relationships in every view/state. | `PENDING_LOCAL_VALIDATION` |
| 8 | SC-1-3-2 — Meaningful Sequence (A) | AC-074 | DOM, reading and keyboard sequence remains meaningful at desktop, zoom and reflow widths. | `PENDING_LOCAL_VALIDATION` |
| 9 | SC-1-3-3 — Sensory Characteristics (A) | AC-074 | Instructions and outcomes do not depend only on shape, position, size, sound or color. | `PENDING_LOCAL_VALIDATION` |
| 10 | SC-1-3-4 — Orientation (AA) | AC-074 | All routes and dialogs operate in portrait and landscape without an essential orientation lock. | `PENDING_LOCAL_VALIDATION` |
| 12 | SC-1-4-1 — Use of Color (A) | AC-074 | Errors, selections, quality, rule outcomes and chart meaning remain explicit without color. | `PENDING_LOCAL_VALIDATION` |
| 14 | SC-1-4-3 — Contrast Minimum (AA) | AC-074 | Measure normal/large text in default, hover, focus, disabled, error and destructive states. | `PENDING_LOCAL_VALIDATION` |
| 15 | SC-1-4-4 — Resize Text (AA) | AC-074 | Verify every route and dialog at 200% text/zoom with no loss of content or operation. | `PENDING_LOCAL_VALIDATION` |
| 16 | SC-1-4-5 — Images of Text (AA) | AC-074 | Confirm essential text is rendered as real text, not rasterized imagery. | `PENDING_LOCAL_VALIDATION` |
| 17 | SC-1-4-10 — Reflow (AA) | AC-074 | Verify each route at 320 CSS px; document only justified local table scrolling. | `PENDING_LOCAL_VALIDATION` |
| 18 | SC-1-4-11 — Non-text Contrast (AA) | AC-074 | Measure controls, boundaries, focus, chart lines and state indicators at 3:1. | `PENDING_LOCAL_VALIDATION` |
| 19 | SC-1-4-12 — Text Spacing (AA) | AC-074 | Apply line/paragraph/letter/word spacing overrides and verify no clipping or overlap. | `PENDING_LOCAL_VALIDATION` |
| 20 | SC-1-4-13 — Content on Hover or Focus (AA) | AC-074 | Any supplemental content is dismissible, hoverable and persistent; record absence if none exists. | `PENDING_LOCAL_VALIDATION` |
| 21 | SC-2-1-1 — Keyboard (A) | AC-067, AC-068 | Execute every route, field, dialog, table action and recovery action without a pointer. | `PENDING_LOCAL_VALIDATION` |
| 22 | SC-2-1-2 — No Keyboard Trap (A) | AC-067, AC-068 | Traverse dialogs, scroll regions and all routes in both directions and escape every context. | `PENDING_LOCAL_VALIDATION` |
| 23 | SC-2-1-4 — Character Key Shortcuts (A) | AC-067, AC-068 | Confirm no single-character shortcut fires unexpectedly, or verify its disable/remap/focus restriction. | `PENDING_LOCAL_VALIDATION` |
| 25 | SC-2-2-2 — Pause Stop Hide (A) | AC-077 | Confirm no auto-updating/moving content, or verify a keyboard-operable pause/stop/hide control. | `PENDING_LOCAL_VALIDATION` |
| 26 | SC-2-3-1 — Three Flashes or Below Threshold (A) | AC-074 | Inspect all transitions/status changes and confirm no flashing content exceeds the threshold. | `PENDING_LOCAL_VALIDATION` |
| 27 | SC-2-4-1 — Bypass Blocks (A) | AC-074 | Activate the skip link by keyboard and verify focus moves to the main landmark. | `PENDING_LOCAL_VALIDATION` |
| 28 | SC-2-4-2 — Page Titled (A) | AC-074 | Confirm an informative page title and route/view context for all reachable states. | `PENDING_LOCAL_VALIDATION` |
| 29 | SC-2-4-3 — Focus Order (A) | AC-067, AC-068 | Record focus order for navigation, forms, dialogs, errors and recovery; it must follow task sequence. | `PENDING_LOCAL_VALIDATION` |
| 30 | SC-2-4-4 — Link Purpose In Context (A) | AC-074 | Every link purpose is clear; repeated metric evidence links identify their metric. | `PENDING_LOCAL_VALIDATION` |
| 31 | SC-2-4-5 — Multiple Ways (AA) | AC-074 | Verify all application views remain reachable consistently through primary navigation. | `PENDING_LOCAL_VALIDATION` |
| 32 | SC-2-4-6 — Headings and Labels (AA) | AC-074 | Heading hierarchy and labels accurately describe topic, input, action and consequence. | `PENDING_LOCAL_VALIDATION` |
| 33 | SC-2-4-7 — Focus Visible (AA) | AC-067, AC-068 | Inspect every interactive state and capture visible focus evidence. | `PENDING_LOCAL_VALIDATION` |
| 34 | SC-2-4-11 — Focus Not Obscured Minimum (AA) | AC-067, AC-068 | Verify focus is not fully hidden at zoom, reflow, dialog and scroll boundaries. | `PENDING_LOCAL_VALIDATION` |
| 36 | SC-2-5-2 — Pointer Cancellation (A) | AC-069, AC-073 | Confirm actions complete on release, can be aborted/cancelled and destructive actions require confirmation. | `PENDING_LOCAL_VALIDATION` |
| 37 | SC-2-5-3 — Label in Name (A) | AC-069, AC-073 | Compare visible control text with computed accessible name for every action/input. | `PENDING_LOCAL_VALIDATION` |
| 40 | SC-2-5-8 — Target Size Minimum (AA) | AC-074 | Measure pointer targets and spacing in all routes at desktop and 320 CSS px. | `PENDING_LOCAL_VALIDATION` |
| 41 | SC-3-1-1 — Language of Page (A) | AC-074 | Confirm the document language is valid and announced correctly. | `PENDING_LOCAL_VALIDATION` |
| 42 | SC-3-1-2 — Language of Parts (AA) | AC-074 | Review domain terms and any language changes; mark changes programmatically when present. | `PENDING_LOCAL_VALIDATION` |
| 43 | SC-3-2-1 — On Focus (A) | AC-072, AC-073 | Focusing a control never changes context, submits, navigates or mutates data. | `PENDING_LOCAL_VALIDATION` |
| 44 | SC-3-2-2 — On Input (A) | AC-072, AC-073 | Input changes never unexpectedly navigate or mutate persisted data; preview/confirmation remain explicit. | `PENDING_LOCAL_VALIDATION` |
| 45 | SC-3-2-3 — Consistent Navigation (AA) | AC-074 | Primary navigation order, naming and placement remain consistent across views. | `PENDING_LOCAL_VALIDATION` |
| 46 | SC-3-2-4 — Consistent Identification (AA) | AC-074 | Controls with the same function use consistent visible and accessible names. | `PENDING_LOCAL_VALIDATION` |
| 47 | SC-3-2-6 — Consistent Help (A) | AC-074 | Help/instruction placement and access remain consistent wherever comparable help exists. | `PENDING_LOCAL_VALIDATION` |
| 48 | SC-3-3-1 — Error Identification (A) | AC-069, AC-075 | Trigger issuer, acquisition, price and deletion errors; verify text and programmatic field association. | `PENDING_LOCAL_VALIDATION` |
| 49 | SC-3-3-2 — Labels or Instructions (A) | AC-069, AC-075 | Verify visible labels, accepted formats, prerequisites and consequences before input/submission. | `PENDING_LOCAL_VALIDATION` |
| 50 | SC-3-3-3 — Error Suggestion (AA) | AC-069, AC-075 | Every detectable error provides a concrete correction that does not weaken validation. | `PENDING_LOCAL_VALIDATION` |
| 51 | SC-3-3-4 — Error Prevention Legal Financial Data (AA) | AC-069, AC-075 | Verify preview, confirmation, cancellation, reversible paths and preserved-data statements for mutations. | `PENDING_LOCAL_VALIDATION` |
| 52 | SC-3-3-7 — Redundant Entry (A) | AC-072, AC-073 | Repeated context such as CIK/period/profile/snapshot is retained or selectable without needless re-entry. | `PENDING_LOCAL_VALIDATION` |
| 54 | SC-4-1-2 — Name Role Value (A) | AC-069 | Inspect computed accessibility tree for controls, dialogs, progress, tables, statuses and recovery. | `PENDING_LOCAL_VALIDATION` |
| 55 | SC-4-1-3 — Status Messages (AA) | AC-070, AC-071 | Verify completion, error, busy, cancellation and recovery announcements without forced focus. | `PENDING_LOCAL_VALIDATION` |

## Exactly 12 N/A records

Each record is valid only while its exact-head scope-absence oracle passes. Evidence must inspect route registration, rendered components, dependencies and product requirements.

| # | Matrix ID — criterion | Foundation | Scope evaluated | Oracle and evidence | Result | Concrete reopening condition |
|---:|---|---|---|---|---|---|
| 2 | SC-1-2-1 — Audio-only and Video-only Prerecorded | MVP contains no prerecorded audio-only or video-only media. | Exact candidate routes, components, dependencies and requirements. | Excluded media is absent; attach exact-head inventory, operator, timestamp and digest. | `N/A — SCOPE ABSENCE TO BE RECONFIRMED ON EXACT HEAD` | Any prerecorded audio-only or video-only feature. |
| 3 | SC-1-2-2 — Captions Prerecorded | MVP contains no prerecorded synchronized media requiring captions. | Exact candidate routes, components, dependencies and requirements. | Excluded media is absent; attach exact-head inventory, operator, timestamp and digest. | `N/A — SCOPE ABSENCE TO BE RECONFIRMED ON EXACT HEAD` | Any prerecorded synchronized media. |
| 4 | SC-1-2-3 — Audio Description or Media Alternative Prerecorded | MVP contains no prerecorded synchronized media requiring an alternative. | Exact candidate routes, components, dependencies and requirements. | Excluded media is absent; attach exact-head inventory, operator, timestamp and digest. | `N/A — SCOPE ABSENCE TO BE RECONFIRMED ON EXACT HEAD` | Any prerecorded synchronized media. |
| 5 | SC-1-2-4 — Captions Live | MVP contains no live synchronized media. | Exact candidate routes, components, dependencies and requirements. | Excluded media is absent; attach exact-head inventory, operator, timestamp and digest. | `N/A — SCOPE ABSENCE TO BE RECONFIRMED ON EXACT HEAD` | Any live synchronized media. |
| 6 | SC-1-2-5 — Audio Description Prerecorded | MVP contains no prerecorded video requiring audio description. | Exact candidate routes, components, dependencies and requirements. | Excluded media is absent; attach exact-head inventory, operator, timestamp and digest. | `N/A — SCOPE ABSENCE TO BE RECONFIRMED ON EXACT HEAD` | Any prerecorded video. |
| 11 | SC-1-3-5 — Identify Input Purpose | CIK, ticker and local file inputs are domain data; MVP collects no user-purpose personal fields in the WCAG taxonomy. | Exact forms, route inventory, schemas and requirements. | Covered personal-field purposes are absent; attach exact-head form inventory and digest. | `N/A — SCOPE ABSENCE TO BE RECONFIRMED ON EXACT HEAD` | Any personal/contact/identity input covered by the taxonomy. |
| 13 | SC-1-4-2 — Audio Control | MVP has no autoplay or other audio output. | Exact candidate routes, media dependencies and rendered states. | Audio output is absent; attach exact-head inventory and digest. | `N/A — SCOPE ABSENCE TO BE RECONFIRMED ON EXACT HEAD` | Any automatic or user-triggered audio output. |
| 24 | SC-2-2-1 — Timing Adjustable | MVP imposes no user-facing time limit; operation timeouts are error handling, not form deadlines. | Exact workflows, dialogs, timers and requirements. | User deadline/timed interaction is absent; attach exact-head timer inventory and digest. | `N/A — SCOPE ABSENCE TO BE RECONFIRMED ON EXACT HEAD` | Any session, form, reading or action time limit. |
| 35 | SC-2-5-1 — Pointer Gestures | No function requires multipoint or path-based gestures. | Exact controls, chart interactions and event handlers. | Every operation has a single-point/keyboard path; attach event-handler inventory. | `N/A — SCOPE ABSENCE TO BE RECONFIRMED ON EXACT HEAD` | Any path-based or multipoint gesture. |
| 38 | SC-2-5-4 — Motion Actuation | No function is operated by device or user motion. | Exact dependencies, permissions and event handlers. | Motion actuation is absent; attach exact-head sensor/event inventory. | `N/A — SCOPE ABSENCE TO BE RECONFIRMED ON EXACT HEAD` | Any accelerometer, gyroscope, camera-motion or gesture actuation. |
| 39 | SC-2-5-7 — Dragging Movements | No function requires dragging; selection and ordering use buttons/fields. | Exact controls, charts and pointer handlers. | Drag-required operation is absent; attach exact-head handler inventory. | `N/A — SCOPE ABSENCE TO BE RECONFIRMED ON EXACT HEAD` | Any drag-to-move, reorder, resize or select operation. |
| 53 | SC-3-3-8 — Accessible Authentication Minimum | MVP has no authentication, login or cognitive-function authentication step. | Exact routes, dependencies, storage and requirements. | Authentication is absent; attach exact-head route/dependency inventory. | `N/A — SCOPE ABSENCE TO BE RECONFIRMED ON EXACT HEAD` | Any login, reauthentication, challenge or account access feature. |

## Closure rule

T088 remains pending while any applicable record says `PENDING_LOCAL_VALIDATION`, `FAIL` or `BLOCKED`, or while any N/A scope absence has not been reconfirmed against the exact candidate HEAD. Completion requires authenticated evidence for all 55 records and every cross-cutting scenario. B21 and convergence remain out of scope.
