package gitlab

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestScanOpenAPIFilesFindsOnlyValidSpecifications(t *testing.T) {
	t.Helper()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/api/v4/projects/42/repository/tree":
			if got := r.URL.Query().Get("ref"); got != "main" {
				t.Fatalf("tree ref = %q, want main", got)
			}
			_, _ = fmt.Fprint(w, `[
				{"type":"blob","path":"api/openapi.yaml","id":"yaml-sha"},
				{"type":"blob","path":"api/internal.json","id":"json-sha"},
				{"type":"blob","path":"README.md","id":"readme-sha"}
			]`)
		case "/api/v4/projects/42/repository/files/api/openapi.yaml/raw":
			_, _ = fmt.Fprint(w, "openapi: 3.1.0\ninfo:\n  title: Gateway\n  version: 1.0.0\npaths: {}\n")
		case "/api/v4/projects/42/repository/files/api/internal.json/raw":
			_, _ = fmt.Fprint(w, `{"title":"not an OpenAPI document"}`)
		case "/api/v4/projects/42/repository/files/api%2Finternal.json/raw":
			_, _ = fmt.Fprint(w, `{"title":"not an OpenAPI document"}`)
		default:
			t.Fatalf("unexpected request: %s", r.URL.String())
		}
	}))
	defer server.Close()

	client := NewClient(server.URL, server.Client())
	files, err := client.ScanOpenAPIFiles(context.Background(), "token", 42, "main")
	if err != nil {
		t.Fatalf("ScanOpenAPIFiles() error = %v", err)
	}

	if len(files) != 1 {
		t.Fatalf("ScanOpenAPIFiles() files = %#v, want one valid specification", files)
	}
	if got, want := files[0], (OpenAPIFile{Path: "api/openapi.yaml", SHA: "yaml-sha", Title: "Gateway", Version: "1.0.0"}); got != want {
		t.Fatalf("ScanOpenAPIFiles() file = %#v, want %#v", got, want)
	}
}

func TestClientReturnsFileContent(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/v4/projects/42/repository/files/api/openapi.yaml/raw" {
			t.Fatalf("unexpected request: %s", r.URL.String())
		}
		if got := r.URL.Query().Get("ref"); got != "v1.2.3" {
			t.Fatalf("file ref = %q, want v1.2.3", got)
		}
		_, _ = fmt.Fprint(w, "openapi: 3.1.0\ninfo: { title: Gateway, version: 1.0.0 }\npaths: {}\n")
	}))
	defer server.Close()

	content, err := NewClient(server.URL, server.Client()).FileContent(context.Background(), "token", 42, "v1.2.3", "api/openapi.yaml")
	if err != nil {
		t.Fatalf("FileContent() error = %v", err)
	}
	if content == "" {
		t.Fatal("FileContent() returned empty content")
	}
}
