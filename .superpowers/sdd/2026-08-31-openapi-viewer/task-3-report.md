# Task 3 Report: Ant Design Document Viewer

## Delivered Files

- `src/App.tsx`: viewer state, local file and URL loading, history integration, hash selection, and responsive layout ownership.
- `src/App.test.tsx`: end-to-end component coverage for controls, local loading, mobile navigation search, operation selection, and browser hash updates.
- `src/components/HistoryPanel.tsx`: saved-document reopen, removal, and clear-history controls.
- `src/components/OperationNavigation.tsx`: tag-grouped Ant Design tree, operation search, and selection controls.
- `src/components/DocumentReader.tsx`: continuous API metadata, servers, security, operations, schemas, parameter, request-body, and response rendering.
- `src/main.tsx`, `src/styles.css`: application bootstrap, Ant Design reset, dense responsive viewer styling.
- `src/test/setup.ts`: browser API shims required by Ant Design under JSDOM (`matchMedia`, `ResizeObserver`, `scrollIntoView`, and pseudo-element-safe computed styles).

## TDD Evidence

### RED

Command: `npm test -- --run src/App.test.tsx`

The first run failed as expected because `src/App.tsx` did not exist:

```
Error: Failed to resolve import "./App" from "src/App.test.tsx".
```

After the initial implementation, the same test exposed and drove fixes for the JSDOM browser API prerequisites and a real tree-state issue: an Ant Design tree mounted without operations did not expand tag groups after a document loaded. Controlled expanded keys now make loaded operations reachable.

### GREEN

Command: `npm test -- --run src/App.test.tsx`

```
Test Files  1 passed (1)
Tests       1 passed (1)
```

Command: `npm test -- --run`

```
Test Files  5 passed (5)
Tests       16 passed (16)
```

Command: `npm run build`

```
tsc --noEmit && vite build
built in 2.40s
```

## Self-Review

- The UI consumes the existing `loadFileDocument`, `loadRemoteDocument`, `documentRepository`, `parseSpecification`, `getOperations`, and `searchOperations` utilities without duplicating their parsing, persistence, or search logic.
- Source failures are surfaced as persistent, dismissible Ant Design alerts. URL loading remains browser-only and inherits Task 2 CORS feedback.
- The reader maintains operation-specific anchors, selection state, and browser hashes; search works against the existing operation traversal utility and tree groups stay expanded when a document is loaded.
- Desktop uses two Ant Design sider rails. Narrow layouts retain the reader as the primary content and expose history and navigation through icon-triggered drawers.
- `git diff --check` completed without whitespace errors.

## Commit

- `feat: implement Ant Design document viewer` (Task 3 implementation and this report)

## Concerns

- No in-app browser-control tool was available in this environment, so interactive visual smoke testing could not be performed here. Component coverage exercises the narrow drawer path; the responsive desktop layout is verified statically and by the production build.
- Vite emitted its standard non-blocking warning that the Ant Design-inclusive main bundle is larger than 500 kB after minification (1,075.88 kB / 343.06 kB gzip). Code splitting is a later optimization, not required for Task 3 behavior.

## Follow-up Fix: Narrow Header Actions

Review identified that the 56px, 320px-wide header could wrap its four compact actions onto a second row. Compact mode now keeps the history and navigation drawer buttons and places `Open file` and `Load URL` in a single `Open source actions` overflow menu. The header action group does not wrap, so the reader remains below the header.

### Regression Evidence

- RED: the new narrow-mode test failed because the `Open source actions` button was absent while direct source buttons remained in the header.
- GREEN: `npm test -- --run src/App.test.tsx` passes 2 tests, including source menu accessibility and the existing load/search/select workflow.

### Files Changed

- `src/App.tsx`
- `src/styles.css`
- `src/App.test.tsx`
- `task-3-report.md`

### Follow-up Commit

- `fix: prevent compact header action overflow`
