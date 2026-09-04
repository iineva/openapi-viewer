FROM node:22-bookworm-slim AS frontend-build

WORKDIR /workspace
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html tsconfig.json vite.config.ts ./
COPY src ./src
RUN npm run build

FROM golang:1.26-bookworm AS server-build

WORKDIR /workspace
COPY go.mod go.sum ./
RUN go mod download
COPY cmd ./cmd
COPY internal ./internal
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags='-s -w' -o /out/openapi-viewer ./cmd/openapi-viewer

FROM gcr.io/distroless/static-debian12:nonroot

COPY --from=server-build /out/openapi-viewer /openapi-viewer
COPY --from=frontend-build /workspace/dist /app/dist

ENV LISTEN_ADDR=:8080
ENV STATIC_DIR=/app/dist

EXPOSE 8080
ENTRYPOINT ["/openapi-viewer"]
