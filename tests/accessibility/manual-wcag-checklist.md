# Manual WCAG 2.2 A/AA checklist — B20

> Exact-HEAD candidate checklist. Applicable rows are **PENDING**; no conformance claim.

## Required scenarios

Keyboard-only; visible/unobscured/returned focus; destructive dialogs; errors/instructions; live regions; busy/disabled; tables/chart alternatives; names; contrast; text spacing; 200% zoom; 320 CSS px reflow; target size; reduced motion; persistent context; recovery; non-color meaning; no personalized investment advice.

|SC|L|Name|Basis|Scope|Oracle|Evidence|Result|Reopen|
|---|---|---|---|---|---|---|---|---|
|1.1.1|A|Non-text Content|Applies to FinScope UI|charts|every informative non-text item has an equivalent accessible name/description; dec|1.1.1: tester notes + screenshot/log hash|PENDING|new candidate HEAD or affected UI change|
|1.2.1|A|Audio-only and Video-only (Prerecorded)|No prerecorded audio/video|media inventory|inspect audio/video/source|none present|N/A|add prerecorded media|
|1.2.2|A|Captions (Prerecorded)|No prerecorded synchronized media|media inventory|inspect tracks/captions|none present|N/A|add prerecorded synchronized media|
|1.2.3|A|Audio Description or Media Alternative (Pr|No prerecorded synchronized media|media inventory|inspect media alternatives|none present|N/A|add prerecorded synchronized media|
|1.2.4|AA|Captions (Live)|No live media|media inventory|inspect live streams|none present|N/A|add live media|
|1.2.5|AA|Audio Description (Prerecorded)|No prerecorded video|media inventory|inspect audio descriptions|none present|N/A|add prerecorded video|
|1.3.1|A|Info and Relationships|Applies to FinScope UI|application shell|all in-scope UI states satisfy WCAG 2.2 success criterion 1.3.1 (Info and Relation|1.3.1: tester notes + screenshot/log hash|PENDING|new candidate HEAD or affected UI change|
|1.3.2|A|Meaningful Sequence|Applies to FinScope UI|application shell|all in-scope UI states satisfy WCAG 2.2 success criterion 1.3.2 (Meaningful Sequen|1.3.2: tester notes + screenshot/log hash|PENDING|new candidate HEAD or affected UI change|
|1.3.3|A|Sensory Characteristics|Applies to FinScope UI|application shell|all in-scope UI states satisfy WCAG 2.2 success criterion 1.3.3 (Sensory Character|1.3.3: tester notes + screenshot/log hash|PENDING|new candidate HEAD or affected UI change|
|1.3.4|AA|Orientation|Applies to FinScope UI|application shell|all in-scope UI states satisfy WCAG 2.2 success criterion 1.3.4 (Orientation) with|1.3.4: tester notes + screenshot/log hash|PENDING|new candidate HEAD or affected UI change|
|1.3.5|AA|Identify Input Purpose|No personal-data purpose field|all forms|inspect input-purpose taxonomy|issuer/price/file inputs only|N/A|add personal-data fields|
|1.4.1|A|Use of Color|Applies to FinScope UI|charts|color is always accompanied by text, pattern, icon or programmatic state|1.4.1: tester notes + screenshot/log hash|PENDING|new candidate HEAD or affected UI change|
|1.4.2|A|Audio Control|No auto-playing audio|media inventory|inspect audio/playback|no audio output|N/A|add audio output|
|1.4.3|AA|Contrast (Minimum)|Applies to FinScope UI|application shell|all in-scope UI states satisfy WCAG 2.2 success criterion 1.4.3 (Contrast (Minimum|1.4.3: tester notes + screenshot/log hash|PENDING|new candidate HEAD or affected UI change|
|1.4.4|AA|Resize Text|Applies to FinScope UI|all text and controls|200% text resize preserves content and operation|1.4.4: tester notes + screenshot/log hash|PENDING|new candidate HEAD or affected UI change|
|1.4.5|AA|Images of Text|Applies to FinScope UI|application shell|all in-scope UI states satisfy WCAG 2.2 success criterion 1.4.5 (Images of Text) w|1.4.5: tester notes + screenshot/log hash|PENDING|new candidate HEAD or affected UI change|
|1.4.10|AA|Reflow|Applies to FinScope UI|application shell|all in-scope UI states satisfy WCAG 2.2 success criterion 1.4.10 (Reflow) without |1.4.10: tester notes + screenshot/log hash|PENDING|new candidate HEAD or affected UI change|
|1.4.11|AA|Non-text Contrast|Applies to FinScope UI|application shell|all in-scope UI states satisfy WCAG 2.2 success criterion 1.4.11 (Non-text Contras|1.4.11: tester notes + screenshot/log hash|PENDING|new candidate HEAD or affected UI change|
|1.4.12|AA|Text Spacing|Applies to FinScope UI|application shell|all in-scope UI states satisfy WCAG 2.2 success criterion 1.4.12 (Text Spacing) wi|1.4.12: tester notes + screenshot/log hash|PENDING|new candidate HEAD or affected UI change|
|1.4.13|AA|Content on Hover or Focus|Applies to FinScope UI|tooltips|supplemental hover/focus content is dismissible, hoverable and persistent while ne|1.4.13: tester notes + screenshot/log hash|PENDING|new candidate HEAD or affected UI change|
|2.1.1|A|Keyboard|Applies to FinScope UI|application shell|all in-scope UI states satisfy WCAG 2.2 success criterion 2.1.1 (Keyboard) without|2.1.1: tester notes + screenshot/log hash|PENDING|new candidate HEAD or affected UI change|
|2.1.2|A|No Keyboard Trap|Applies to FinScope UI|application shell|all in-scope UI states satisfy WCAG 2.2 success criterion 2.1.2 (No Keyboard Trap)|2.1.2: tester notes + screenshot/log hash|PENDING|new candidate HEAD or affected UI change|
|2.1.4|A|Character Key Shortcuts|Applies to FinScope UI|application shell|all in-scope UI states satisfy WCAG 2.2 success criterion 2.1.4 (Character Key Sho|2.1.4: tester notes + screenshot/log hash|PENDING|new candidate HEAD or affected UI change|
|2.2.1|A|Timing Adjustable|No user time limit|all workflows|inspect timers/session expiry|no timed interaction|N/A|add a user time limit|
|2.2.2|A|Pause, Stop, Hide|Applies to FinScope UI|application shell|all in-scope UI states satisfy WCAG 2.2 success criterion 2.2.2 (Pause, Stop, Hide|2.2.2: tester notes + screenshot/log hash|PENDING|new candidate HEAD or affected UI change|
|2.3.1|A|Three Flashes or Below Threshold|Applies to FinScope UI|application shell|all in-scope UI states satisfy WCAG 2.2 success criterion 2.3.1 (Three Flashes or |2.3.1: tester notes + screenshot/log hash|PENDING|new candidate HEAD or affected UI change|
|2.4.1|A|Bypass Blocks|Applies to FinScope UI|application shell|all in-scope UI states satisfy WCAG 2.2 success criterion 2.4.1 (Bypass Blocks) wi|2.4.1: tester notes + screenshot/log hash|PENDING|new candidate HEAD or affected UI change|
|2.4.2|A|Page Titled|Applies to FinScope UI|application shell and routed views|each page/view has a unique descriptive document title|2.4.2: tester notes + screenshot/log hash|PENDING|new candidate HEAD or affected UI change|
|2.4.3|A|Focus Order|Applies to FinScope UI|application shell|all in-scope UI states satisfy WCAG 2.2 success criterion 2.4.3 (Focus Order) with|2.4.3: tester notes + screenshot/log hash|PENDING|new candidate HEAD or affected UI change|
|2.4.4|A|Link Purpose (In Context)|Applies to FinScope UI|application shell|all in-scope UI states satisfy WCAG 2.2 success criterion 2.4.4 (Link Purpose (In |2.4.4: tester notes + screenshot/log hash|PENDING|new candidate HEAD or affected UI change|
|2.4.5|AA|Multiple Ways|Applies to FinScope UI|application shell|all in-scope UI states satisfy WCAG 2.2 success criterion 2.4.5 (Multiple Ways) wi|2.4.5: tester notes + screenshot/log hash|PENDING|new candidate HEAD or affected UI change|
|2.4.6|AA|Headings and Labels|Applies to FinScope UI|headings|headings and labels are unique enough and describe topic or purpose|2.4.6: tester notes + screenshot/log hash|PENDING|new candidate HEAD or affected UI change|
|2.4.7|AA|Focus Visible|Applies to FinScope UI|application shell|all in-scope UI states satisfy WCAG 2.2 success criterion 2.4.7 (Focus Visible) wi|2.4.7: tester notes + screenshot/log hash|PENDING|new candidate HEAD or affected UI change|
|2.4.11|AA|Focus Not Obscured (Minimum)|Applies to FinScope UI|application shell|all in-scope UI states satisfy WCAG 2.2 success criterion 2.4.11 (Focus Not Obscur|2.4.11: tester notes + screenshot/log hash|PENDING|new candidate HEAD or affected UI change|
|2.5.1|A|Pointer Gestures|No path/multipoint gesture|all controls|keyboard/pointer inventory|single-point activation|N/A|add path/multipoint gestures|
|2.5.2|A|Pointer Cancellation|Applies to FinScope UI|application shell|all in-scope UI states satisfy WCAG 2.2 success criterion 2.5.2 (Pointer Cancellat|2.5.2: tester notes + screenshot/log hash|PENDING|new candidate HEAD or affected UI change|
|2.5.3|A|Label in Name|Applies to FinScope UI|application shell|all in-scope UI states satisfy WCAG 2.2 success criterion 2.5.3 (Label in Name) wi|2.5.3: tester notes + screenshot/log hash|PENDING|new candidate HEAD or affected UI change|
|2.5.4|A|Motion Actuation|No device-motion input|all routes|inspect motion listeners|none present|N/A|add device-motion input|
|2.5.7|AA|Dragging Movements|No dragging operation|all controls|inspect draggable/pointermove|none required|N/A|add required dragging|
|2.5.8|AA|Target Size (Minimum)|Applies to FinScope UI|application shell|all in-scope UI states satisfy WCAG 2.2 success criterion 2.5.8 (Target Size (Mini|2.5.8: tester notes + screenshot/log hash|PENDING|new candidate HEAD or affected UI change|
|3.1.1|A|Language of Page|Applies to FinScope UI|HTML document|the document root declares a valid primary language|3.1.1: tester notes + screenshot/log hash|PENDING|new candidate HEAD or affected UI change|
|3.1.2|AA|Language of Parts|Applies to FinScope UI|application shell|all in-scope UI states satisfy WCAG 2.2 success criterion 3.1.2 (Language of Parts|3.1.2: tester notes + screenshot/log hash|PENDING|new candidate HEAD or affected UI change|
|3.2.1|A|On Focus|Applies to FinScope UI|application shell|all in-scope UI states satisfy WCAG 2.2 success criterion 3.2.1 (On Focus) without|3.2.1: tester notes + screenshot/log hash|PENDING|new candidate HEAD or affected UI change|
|3.2.2|A|On Input|Applies to FinScope UI|application shell|all in-scope UI states satisfy WCAG 2.2 success criterion 3.2.2 (On Input) without|3.2.2: tester notes + screenshot/log hash|PENDING|new candidate HEAD or affected UI change|
|3.2.3|AA|Consistent Navigation|Applies to FinScope UI|application shell|all in-scope UI states satisfy WCAG 2.2 success criterion 3.2.3 (Consistent Naviga|3.2.3: tester notes + screenshot/log hash|PENDING|new candidate HEAD or affected UI change|
|3.2.4|AA|Consistent Identification|Applies to FinScope UI|application shell|all in-scope UI states satisfy WCAG 2.2 success criterion 3.2.4 (Consistent Identi|3.2.4: tester notes + screenshot/log hash|PENDING|new candidate HEAD or affected UI change|
|3.2.6|A|Consistent Help|Applies to FinScope UI|application shell|all in-scope UI states satisfy WCAG 2.2 success criterion 3.2.6 (Consistent Help) |3.2.6: tester notes + screenshot/log hash|PENDING|new candidate HEAD or affected UI change|
|3.3.1|A|Error Identification|Applies to FinScope UI|application shell|all in-scope UI states satisfy WCAG 2.2 success criterion 3.3.1 (Error Identificat|3.3.1: tester notes + screenshot/log hash|PENDING|new candidate HEAD or affected UI change|
|3.3.2|A|Labels or Instructions|Applies to FinScope UI|CIK/ticker|each input has a visible/programmatic label and necessary instructions before subm|3.3.2: tester notes + screenshot/log hash|PENDING|new candidate HEAD or affected UI change|
|3.3.3|AA|Error Suggestion|Applies to FinScope UI|application shell|all in-scope UI states satisfy WCAG 2.2 success criterion 3.3.3 (Error Suggestion)|3.3.3: tester notes + screenshot/log hash|PENDING|new candidate HEAD or affected UI change|
|3.3.4|AA|Error Prevention (Legal, Financial, Data)|Applies to FinScope UI|application shell|all in-scope UI states satisfy WCAG 2.2 success criterion 3.3.4 (Error Prevention |3.3.4: tester notes + screenshot/log hash|PENDING|new candidate HEAD or affected UI change|
|3.3.7|A|Redundant Entry|Applies to FinScope UI|application shell|all in-scope UI states satisfy WCAG 2.2 success criterion 3.3.7 (Redundant Entry) |3.3.7: tester notes + screenshot/log hash|PENDING|new candidate HEAD or affected UI change|
|3.3.8|AA|Accessible Authentication (Minimum)|No authentication|all routes|inspect login/challenges|no auth flow|N/A|introduce authentication|
|4.1.2|A|Name, Role, Value|Applies to FinScope UI|application shell|all in-scope UI states satisfy WCAG 2.2 success criterion 4.1.2 (Name, Role, Value|4.1.2: tester notes + screenshot/log hash|PENDING|new candidate HEAD or affected UI change|
|4.1.3|AA|Status Messages|Applies to FinScope UI|application shell|all in-scope UI states satisfy WCAG 2.2 success criterion 4.1.3 (Status Messages) |4.1.3: tester notes + screenshot/log hash|PENDING|new candidate HEAD or affected UI change|

## Sign-off gate

- Record tester, date, browser/OS, assistive technology, viewport, zoom, measurements, failures and evidence hashes.
- T088 stays pending until 43 applicable rows PASS and all 12 N/A bases remain true on the exact candidate HEAD.
- Any unexecuted or failed applicable row requires `LOCAL_VALIDATION_REQUIRED`.
