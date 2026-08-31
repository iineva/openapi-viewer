# OpenAPI Viewer Design

## Goal

Build a browser-only Vite, React, and TypeScript application that loads OpenAPI YAML or JSON documents from a local file or remote URL, renders them as an API reference, assists with issuing requests, and retains document history in the browser.

## Product Scope

The application is a document reader first and an API request tool second. It accepts OpenAPI 3.x documents and provides a useful fallback for Swagger 2.0 documents where common fields map cleanly. No server, account, shared history, proxy, or credential persistence is included.

## Experience

The first screen is the usable viewer, built with Ant Design rather than a landing page.

- A compact top bar identifies the viewer and exposes `Open file` and `Load URL` actions.
- The left rail lists saved documents, their source and last-opened time. Users can reopen, remove, or clear history.
- The adjacent navigation rail contains a debounced search field and tags grouped in an Ant Design tree. Search matches HTTP method, route, summary, operation ID, and tag.
- The main reader is a continuous, dense documentation flow. It includes API metadata, servers, authentication schemes, schemas, and tag-grouped operations. An in-page anchor and browser hash identify the selected operation.
- Operation documentation shows parameters, request body schemas, success and error responses, and examples. HTTP methods have restrained semantic colors.
- A collapsed `Try it` panel on each operation opens an Ant Design drawer. It pre-populates editable inputs for path, query, headers, and body. Sending a request shows status, response headers, and formatted JSON or plain text.

The layout is responsive: on narrow screens, document history and API navigation collapse into drawers while the document reader remains primary.

## Architecture

`App` owns the active document identity, selected operation, and high-level UI state. Focused modules isolate persistence, parsing, request construction, and OpenAPI-to-view-model traversal from React components.

`DocumentRepository` uses IndexedDB through `idb` to store document source text plus metadata. It records local-file documents and URL documents after a successful parse. It caps history at 20 entries, updates `lastOpenedAt` when reopened, and supports deleting individual entries and clearing the collection. The remote URL is retained with the fetched text so recently loaded documentation stays readable offline.

The loader reads local text with `File.text()` or remote text with `fetch`. It parses JSON/YAML using `@scalar/openapi-parser`, resolves a normalized document shape, and returns focused validation errors. Remote responses require a successful HTTP status. Browser CORS failure produces an explicit explanation that the remote server must permit this browser origin; the app does not offer a proxy because it is intentionally frontend-only.

Traversal utilities produce stable `OperationViewModel` values from `paths`, operations, tags, components, and common OpenAPI variants. A stable operation key such as `get-/pets` drives selection, search, hash navigation, and anchors.

## Data Model

```ts
type SourceKind = 'file' | 'url'

interface StoredDocument {
  id: string
  name: string
  sourceKind: SourceKind
  sourceValue: string
  content: string
  createdAt: string
  lastOpenedAt: string
}

interface LoadedDocument {
  record: StoredDocument
  specification: OpenAPIV3.Document | SwaggerV2.Document
}
```

`sourceValue` is the filename for file imports and the canonical URL for remote loads. Request form values exist only in React state for the active session and are never persisted, which avoids storing authorization credentials in browser history.

## Error Handling

- Empty files, unsupported extensions, unreadable files, invalid JSON/YAML, and invalid OpenAPI structures display persistent Ant Design alerts with actionable copy.
- URL validation occurs before fetching. HTTP failures include the status code. Network/CORS failures distinguish browser policy from parse errors.
- Unknown or unresolved schemas render their raw JSON representation instead of preventing the rest of the document from being read.
- Request execution validates required path parameters and preserves the constructed request until the drawer closes. Fetch failures and non-JSON responses remain visible in the response panel.

## Dependencies

- `react`, `react-dom`, `typescript`, and `vite`
- `antd` and `@ant-design/icons`
- `@scalar/openapi-parser` for YAML/JSON parsing and OpenAPI normalization
- `idb` for IndexedDB persistence
- `vitest`, `@testing-library/react`, and `fake-indexeddb` for unit and component tests

## Testing

Unit tests cover parser normalization, operation extraction/search, URL request construction, and repository persistence including history trimming. Component tests verify file/URL load UI states, searchable operation navigation, reader selection, and request validation. A production build and a browser smoke test validate the responsive Ant Design layout and local-file workflow.

## Constraints

- The project is pure frontend; no backend, proxy, or remote database is added.
- The implementation uses Vite + React + TypeScript and Ant Design.
- Local files and remote URLs are both first-class sources.
- History is stored locally in the browser using IndexedDB.
- Remote requests and remote document loading are subject to target-server CORS policy.
