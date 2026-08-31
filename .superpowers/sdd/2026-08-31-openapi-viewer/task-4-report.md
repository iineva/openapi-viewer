# Task 4: Request Drawer and Final Verification

## Scope

Implemented the document-reader request assistant. Each operation now keeps a collapsed `Try it` panel that opens a session-only Ant Design drawer. The drawer edits path, query, header, and body values; blocks missing required path parameters; sends the browser request through `fetch`; and renders response status, headers, formatted JSON, or plain text.

## Files

- Created `src/components/RequestDrawer.tsx`
- Created `src/components/RequestDrawer.test.tsx`
- Modified `src/components/DocumentReader.tsx`
- Modified `src/styles.css`
- Modified `README.md`
- Created this report

## TDD Evidence

RED:

1. `npm test -- --run src/components/RequestDrawer.test.tsx` initially failed because `RequestDrawer` did not exist.
2. After adding the non-functional render shell required to execute the tests, the same command ran three tests and failed as expected: no required-path validation, no editable parameter controls, and no response rendering.

GREEN:

1. `npm test -- --run src/components/RequestDrawer.test.tsx` passed: 1 file, 3 tests.
2. `npm test -- --run` passed: 6 files, 20 tests.
3. `npm run build` passed: TypeScript validation and Vite production build completed. Vite emitted its standard bundle-size advisory only.

## Runtime Check

Started `npm run dev -- --host 127.0.0.1`; `http://127.0.0.1:5173/` returned HTTP 200 and the Vite HTML entrypoint. The browser-control capability was unavailable in this session, so a direct visual interaction could not be automated. The operation-to-drawer interactions remain covered by the focused component suite.

## Self-Review

- Document-first behavior remains intact: the drawer is reachable only from a collapsed `Try it` panel in each operation's documentation.
- Required path parameters prevent `fetch` until a non-blank value is entered.
- Requests call browser `fetch` using the prepared method, URL, headers, and non-empty body.
- Responses expose status, every browser-visible header, and a formatted JSON or text body.
- Fetch errors give explicit CORS guidance. The README documents browser-only operation, CORS requirements, and the deliberate absence of a proxy.
- Request values and credentials remain React component state; no repository, storage, or persistence path receives them, and closing the drawer unmounts that state.
- `git diff --check` was clean before the final commit.

## Commit

`feat: add per-operation request drawer`

## Concerns

- The production build has Vite's existing 500 kB chunk-size advisory; it does not affect this task's behavior.
- Browser-control tooling was not exposed in this run, so visual verification was limited to the served HTTP entrypoint plus component interaction tests.
