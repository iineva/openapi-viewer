# OpenAPI Viewer Final Fix Wave

## Scope

Resolved the six final review findings at commit `a779d22383419a23ca0db700ac445e598334123a`: complete response documentation, canonical remote document URL handling for requests, request body media-type preservation, remote body-read error wrapping, blank-header filtering, and debounced operation search.

## Root Causes And Fixes

1. `DocumentReader.responseRows` reduced every response to status and description. `ResponseDetails` now renders every OpenAPI 3 response content media type, its schema and examples, response headers, Swagger-style top-level schema/examples, and raw JSON for additional or unknown shapes.
2. Canonical remote provenance stopped at `App.activeDocument.record`, while `buildRequest` only knew the viewer origin. `getOperations` now carries the canonical remote `sourceValue` on each operation, and `buildRequest` uses it as the URL base. Local documents continue to use the viewer origin.
3. `requestBodyExample` returned only serialized example text. It now returns the chosen media type with the body, `RequestValues` retains it, and request preparation supplies `Content-Type` for a non-empty body unless a case-insensitive user header already exists.
4. Only the initial `fetch` was inside the actionable network/CORS boundary. `response.text()` failures are now wrapped with the same browser network/CORS guidance.
5. Request headers were copied verbatim, including blank optional inputs. `buildRequest` now removes whitespace-only header values before fetch preparation.
6. Navigation filtering used the live input state directly. A 250 ms debounced query now drives operation filtering while the input remains immediately responsive.

## TDD Evidence

RED, against the unmodified implementation:

1. `npm test -- --run src/components/DocumentReader.test.tsx`: 1 test failed because `Response 200 details` and all response content detail were absent.
2. `npm test -- --run src/lib/openapi.test.ts src/lib/request.test.ts -t 'canonical remote|relative and omitted'`: 2 tests failed; extracted operations omitted `documentUrl`, and the request resolved to `http://localhost:3000/api/v1/pets/7` instead of the remote document origin.
3. `npm test -- --run src/components/RequestDrawer.test.tsx -t 'preserves the selected'`: 1 test failed; fetch received an empty optional header and no `Content-Type` instead of `text/plain`.
4. `npm test -- --run src/lib/documents.test.ts -t 'response body'`: 1 test failed because raw `Network connection lost` escaped instead of actionable CORS/network guidance.
5. `npm test -- --run src/lib/request.test.ts -t 'filters blank headers'`: 1 test failed because no selected media-type header was supplied; the drawer RED above also proved the blank header leaked to fetch.
6. `npm test -- --run src/components/OperationNavigation.test.tsx`: 1 test failed because `/users` disappeared immediately after the keystroke rather than after 250 ms.

GREEN after the minimal source changes:

1. `npm test -- --run src/components/DocumentReader.test.tsx`: 1/1 passed.
2. `npm test -- --run src/lib/openapi.test.ts src/lib/request.test.ts`: 9/9 passed.
3. `npm test -- --run src/components/RequestDrawer.test.tsx`: 4/4 passed.
4. `npm test -- --run src/lib/documents.test.ts`: 8/8 passed.
5. `npm test -- --run src/components/OperationNavigation.test.tsx`: 1/1 passed.
6. `npm test -- --run`: 8 files, 28/28 tests passed.
7. `npm run build`: TypeScript validation and Vite production build passed.
8. `git diff --check`: passed with no whitespace errors.

## Changed Files

- Modified `src/types/openapi.ts`
- Modified `src/lib/openapi.ts`
- Modified `src/lib/openapi.test.ts`
- Modified `src/lib/request.ts`
- Modified `src/lib/request.test.ts`
- Modified `src/lib/documents.ts`
- Modified `src/lib/documents.test.ts`
- Modified `src/App.tsx`
- Modified `src/App.test.tsx`
- Modified `src/components/DocumentReader.tsx`
- Created `src/components/DocumentReader.test.tsx`
- Modified `src/components/RequestDrawer.tsx`
- Modified `src/components/RequestDrawer.test.tsx`
- Modified `src/components/OperationNavigation.tsx`
- Created `src/components/OperationNavigation.test.tsx`
- Modified `src/styles.css`
- Created this report

## Self-Review

- Relative servers resolve against the canonical remote document URL; omitted servers resolve to that URL's origin root; local files retain viewer-origin behavior.
- User-provided `Content-Type` is detected case-insensitively and preserved. Blank headers are removed without altering non-blank values.
- Remote documents reopened from IndexedDB retain their saved canonical URL because operation extraction reads the active stored record.
- Response rendering retains known schemas, headers, and examples and does not discard unfamiliar response/media fields.
- Request form state remains component-local. No headers, bodies, authorization values, or other request credentials enter IndexedDB.
- The existing 20-document repository limit is unchanged. No backend, proxy, or new dependency was added.

## Commit

`fix: address final OpenAPI viewer review findings`

## Concerns

- Vite continues to emit its existing advisory that the main minified bundle exceeds 500 kB. The production build succeeds; code splitting is outside this focused fix wave.
- Ant Design emits existing deprecation/test-layout warnings in some component-test output. They do not fail the suite and were not introduced by these fixes.
