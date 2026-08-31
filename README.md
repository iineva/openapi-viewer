# OpenAPI Viewer

A browser-only reader for local and remote OpenAPI YAML or JSON documents. It keeps recently opened documents in the browser and includes an in-session request drawer for individual operations.

## Browser and CORS behavior

The application has no backend or proxy. Loading a remote OpenAPI document and sending a request both use the browser's `fetch` API, so the target server must allow this application's origin with CORS. Request values, including authorization headers, remain only in the open drawer and are never written to document history or other persistent storage.
