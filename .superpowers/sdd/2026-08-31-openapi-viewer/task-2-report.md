# Task 2: Document Loading and Browser History

## Delivered Files

- `src/types/openapi.ts`: added document source, stored-document, and loader result types.
- `src/lib/documents.ts`: local YAML/YML/JSON file loading, HTTP(S) URL loading, parser integration, URL normalization, explicit HTTP and CORS/network failures, and embedded-credential rejection.
- `src/lib/repository.ts`: IndexedDB-backed document history with `list`, `save`, `remove`, and `clear`; history is sorted by `lastOpenedAt` and capped at 20 records.
- `src/lib/documents.test.ts`: tests local/remote loads and source metadata, unsupported input, parsing failure, HTTP errors, browser CORS/network errors, and credential-safe URLs.
- `src/lib/repository.test.ts`: tests history ordering, 20-entry trimming, individual deletion, and clearing.

## TDD Evidence

### RED

Command:

```sh
npm test -- --run src/lib/documents.test.ts src/lib/repository.test.ts
```

Result before implementation: both suites failed during Vite import analysis because `./documents` and `./repository` did not exist.

A follow-up credential-history test failed as expected before its validation was added: it received the browser network failure message instead of rejecting the credential-bearing URL.

### GREEN

Commands:

```sh
npm test -- --run src/lib/documents.test.ts src/lib/repository.test.ts
npm test -- --run
npm run build
```

Results: focused suite passed with 10 tests; full suite passed with 15 tests across 4 files; TypeScript checking and Vite production build completed successfully.

## Commit

- Single Task 2 commit: `feat: add document loading and history`.

## Self-Review

- Confirmed no request values, headers, bodies, or credentials are included in `StoredDocument` or repository writes.
- Confirmed remote responses are persisted only after parsing succeeds.
- Confirmed remote URL failures preserve HTTP status and distinguish browser CORS/network failures without a proxy.
- Confirmed file inputs are restricted to YAML, YML, and JSON extensions, while parser validation remains shared with Task 1.
- Confirmed repository operations close IndexedDB handles after each operation, which avoids blocking database lifecycle operations and keeps the implementation browser-only.
- Reviewed whitespace with `git diff --check`; no errors found.
- The standard independent-review workflow could not dispatch a reviewer because the task explicitly prohibits subagents; local self-review was performed instead.

## Concerns

- Browser CORS/network failures cannot be distinguished reliably from one another by Fetch because both surface as rejected promises; the displayed error states this browser limitation and required target-server CORS permission.
