# OpenAPI Viewer

OpenAPI YAML and JSON reader with a Go service for self-managed GitLab login, repository scanning, and secure server-side access to private specifications.

## Local Development

1. Create a GitLab OAuth Application with `read_user`, `read_api`, and `read_repository` scopes. Its redirect URI must be `http://127.0.0.1:5173/api/auth/gitlab/callback`.
2. Copy `.env.example` to `.env` and replace the GitLab OAuth values. `DEV_OPENAPI_DIR=./src/openapi` makes YAML/JSON files in that ignored directory available in the left file list; `LOCAL_OPENAPI_FILE=/absolute/path/openapi.yaml` automatically previews one file on startup. Load the values into your shell before starting Go.
3. Start the API service: `set -a; source .env; set +a; go run ./cmd/openapi-viewer`.
4. In another terminal, start the frontend: `npm run dev`.

Vite listens on all network interfaces and proxies `/api` to `http://127.0.0.1:8080`. Open `http://<development-machine-LAN-IP>:5173` from another device on the same network. For GitLab login over LAN, set both `APP_BASE_URL` and `GITLAB_REDIRECT_URL` to that LAN origin and add the same callback URL to the GitLab OAuth application. The Go process must be restarted after any `.env` change.

## Production

Build and run a single image with:

```sh
./scripts/build-image.sh openapi-viewer:latest
APP_BASE_URL=http://localhost:8080 \
GITLAB_REDIRECT_URL=http://localhost:8080/api/auth/gitlab/callback \
./scripts/run-image.sh openapi-viewer:latest
```

`run-image.sh` reads `.env` by default; set `ENV_FILE=/path/to/production.env` to use another file. Register the same `GITLAB_REDIRECT_URL` in the self-managed GitLab OAuth application. The runtime image contains only the Go executable and Vite build output, not the project source directories.

To run without Docker, build the frontend with `npm run build`, then start the Go service from the project root. It serves the fixed `./dist` directory. Set `APP_BASE_URL` and `GITLAB_REDIRECT_URL` to the production service origin, for example `https://viewer.company.internal`; the Go service serves the frontend and all `/api` requests from one origin. Set `COOKIE_SECURE=true` when served through HTTPS.

No database is used in this initial single-instance implementation. GitLab access tokens live only in the Go process memory, so users sign in again after a service restart. Repository and selected-file defaults are stored per GitLab user in browser local storage.
