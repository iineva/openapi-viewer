# OpenAPI Viewer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a browser-only Ant Design OpenAPI document viewer supporting local files, remote URLs, persistent browser history, search, and assisted API requests.

**Architecture:** A Vite React SPA separates parsing, OpenAPI traversal, request construction, and IndexedDB persistence into testable `src/lib` modules. Ant Design components compose a responsive history rail, API navigator, document reader, and on-demand request drawer around those modules.

**Tech Stack:** Vite, React, TypeScript, Ant Design, `@scalar/openapi-parser`, `idb`, Vitest, Testing Library, fake-indexeddb.

**Spec:** `docs/superpowers/specs/2026-08-31-openapi-viewer-design.md`

## Global Constraints

- Build is a pure frontend Vite + React + TypeScript application with Ant Design.
- Accept local YAML/YML/JSON files and remote document URLs.
- Persist document history and source content only in IndexedDB, capped at 20 entries.
- Do not persist request headers, bodies, or credentials.
- Explain remote CORS failures without adding a proxy.

---

### Task 1: Project Foundation and Domain Utilities

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`
- Create: `src/lib/openapi.ts`, `src/lib/openapi.test.ts`, `src/lib/request.ts`, `src/lib/request.test.ts`
- Create: `src/types/openapi.ts`, `src/test/setup.ts`

**Interfaces:**
- Produces: `parseSpecification(content: string): Promise<ApiDocument>` and `getOperations(document: ApiDocument): Operation[]`.
- Produces: `buildRequest(operation: Operation, values: RequestValues): PreparedRequest`.

- [ ] **Step 1: Write failing operation and request utility tests**

```ts
expect(getOperations(sampleDocument)).toContainEqual(expect.objectContaining({ key: 'get-/pets' }))
expect(buildRequest(operation, { path: { id: '7' }, query: { limit: '10' }, headers: {}, body: '' }).url)
  .toBe('https://api.example.com/pets/7?limit=10')
```

- [ ] **Step 2: Run the focused tests and confirm they fail because the utilities do not exist**

Run: `npm test -- --run src/lib/openapi.test.ts src/lib/request.test.ts`

- [ ] **Step 3: Implement normalized parser, operation extraction, search, and request construction**

```ts
export function getOperations(document: ApiDocument): Operation[] {
  return Object.entries(document.paths ?? {}).flatMap(([path, pathItem]) =>
    HTTP_METHODS.flatMap((method) => pathItem?.[method]
      ? [{ key: `${method}-${path}`, method, path, definition: pathItem[method] }]
      : []),
  )
}
```

- [ ] **Step 4: Run focused tests and production build**

Run: `npm test -- --run src/lib/openapi.test.ts src/lib/request.test.ts && npm run build`

### Task 2: Document Loading and Browser History

**Files:**
- Create: `src/lib/documents.ts`, `src/lib/documents.test.ts`, `src/lib/repository.ts`, `src/lib/repository.test.ts`
- Modify: `src/types/openapi.ts`

**Interfaces:**
- Produces: `loadRemoteDocument(url: string): Promise<LoadResult>` and `loadFileDocument(file: File): Promise<LoadResult>`.
- Produces: `documentRepository.list/save/remove/clear`.

- [ ] **Step 1: Write failing tests for local/remote loading, parse errors, history ordering, and trimming**

```ts
await repository.save(record)
expect((await repository.list())[0].id).toBe(record.id)
await expect(loadRemoteDocument('https://example.test/openapi.yaml')).rejects.toThrow('HTTP 404')
```

- [ ] **Step 2: Run the focused tests and confirm failures**

Run: `npm test -- --run src/lib/documents.test.ts src/lib/repository.test.ts`

- [ ] **Step 3: Implement fetch/file loaders and the IndexedDB repository**

```ts
export async function save(record: StoredDocument) {
  const db = await getDatabase()
  await db.put('documents', record)
  await trimToHistoryLimit(db)
}
```

- [ ] **Step 4: Run focused tests**

Run: `npm test -- --run src/lib/documents.test.ts src/lib/repository.test.ts`

### Task 3: Ant Design Document Viewer

**Files:**
- Create: `src/App.tsx`, `src/App.test.tsx`, `src/main.tsx`, `src/styles.css`
- Create: `src/components/HistoryPanel.tsx`, `src/components/OperationNavigation.tsx`, `src/components/DocumentReader.tsx`

**Interfaces:**
- Consumes: `StoredDocument`, `ApiDocument`, and `Operation[]` from the domain utilities.
- Produces: `App`, rendering history actions, source controls, document content, hash-selected operations, and search filtering.

- [ ] **Step 1: Write failing UI tests for loading controls, operation search, and reader selection**

```tsx
render(<App />)
expect(screen.getByRole('button', { name: /open file/i })).toBeInTheDocument()
await user.type(screen.getByPlaceholderText(/search endpoints/i), 'pets')
expect(screen.getByText('GET /pets')).toBeInTheDocument()
```

- [ ] **Step 2: Run the component test and confirm it fails**

Run: `npm test -- --run src/App.test.tsx`

- [ ] **Step 3: Implement responsive Ant Design layout and reading components**

```tsx
<Layout className="app-shell">
  <Sider><HistoryPanel /></Sider>
  <Sider><OperationNavigation operations={operations} /></Sider>
  <Content><DocumentReader document={document} operations={operations} /></Content>
</Layout>
```

- [ ] **Step 4: Run component and full test suites**

Run: `npm test -- --run`

### Task 4: Request Drawer and Final Verification

**Files:**
- Create: `src/components/RequestDrawer.tsx`, `src/components/RequestDrawer.test.tsx`
- Modify: `src/components/DocumentReader.tsx`, `src/App.tsx`, `src/styles.css`, `README.md`

**Interfaces:**
- Consumes: `Operation` and `buildRequest`.
- Produces: a drawer that validates required path values, sends a browser fetch request, and renders response status, headers, and body.

- [ ] **Step 1: Write failing tests for required parameter validation and rendered response**

```tsx
await user.click(screen.getByRole('button', { name: /send request/i }))
expect(await screen.findByText(/required path parameter/i)).toBeInTheDocument()
```

- [ ] **Step 2: Run the request drawer test and confirm it fails**

Run: `npm test -- --run src/components/RequestDrawer.test.tsx`

- [ ] **Step 3: Implement the drawer and document browser-only/CORS behavior in README**

```ts
const response = await fetch(prepared.url, {
  method: prepared.method,
  headers: prepared.headers,
  body: prepared.body || undefined,
})
```

- [ ] **Step 4: Run full verification and visually smoke test the application**

Run: `npm test -- --run && npm run build && npm run dev -- --host 127.0.0.1`

## Self-Review

- Spec coverage: Tasks 1-4 cover parsing, both input sources, IndexedDB history, responsive Ant Design reading UI, operation search, request assistance, CORS feedback, tests, build, and runtime validation.
- Placeholder scan: no unfinished requirements are present.
- Type consistency: `ApiDocument`, `Operation`, `RequestValues`, and `StoredDocument` are produced in Tasks 1-2 and consumed in Tasks 3-4.
