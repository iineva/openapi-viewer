package server

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/steven/openapi-viewer/internal/config"
)

func TestLocalOpenAPIEndpointsListAndReadConfiguredFiles(t *testing.T) {
	directory := t.TempDir()
	specification := "openapi: 3.1.0\ninfo: { title: Local Gateway, version: 1.0.0 }\npaths: {}\n"
	if err := os.WriteFile(filepath.Join(directory, "openapi.yaml"), []byte(specification), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(directory, "notes.yaml"), []byte("title: not openapi"), 0o600); err != nil {
		t.Fatal(err)
	}

	handler := New(config.Config{DevOpenAPIDir: directory}).Handler()
	list := httptest.NewRecorder()
	handler.ServeHTTP(list, httptest.NewRequest(http.MethodGet, "/api/dev/openapi-files", nil))
	if list.Code != http.StatusOK {
		t.Fatalf("list status = %d, want %d", list.Code, http.StatusOK)
	}
	if got, want := list.Body.String(), `[{"path":"openapi.yaml","title":"Local Gateway","version":"1.0.0"}]`+"\n"; got != want {
		t.Fatalf("list body = %q, want %q", got, want)
	}

	file := httptest.NewRecorder()
	handler.ServeHTTP(file, httptest.NewRequest(http.MethodGet, "/api/dev/openapi-file?path=openapi.yaml", nil))
	if file.Code != http.StatusOK || file.Body.String() != `{"content":"openapi: 3.1.0\ninfo: { title: Local Gateway, version: 1.0.0 }\npaths: {}\n"}`+"\n" {
		t.Fatalf("file response = %d %q", file.Code, file.Body.String())
	}

	escaped := httptest.NewRecorder()
	handler.ServeHTTP(escaped, httptest.NewRequest(http.MethodGet, "/api/dev/openapi-file?path=../.env", nil))
	if escaped.Code != http.StatusBadRequest {
		t.Fatalf("escaped path status = %d, want %d", escaped.Code, http.StatusBadRequest)
	}
}

func TestLocalOpenAPIDefaultReadsOnlyTheConfiguredFile(t *testing.T) {
	directory := t.TempDir()
	path := filepath.Join(directory, "preview.yaml")
	if err := os.WriteFile(path, []byte("openapi: 3.1.0\ninfo: { title: Preview, version: 1 }\npaths: {}\n"), 0o600); err != nil {
		t.Fatal(err)
	}

	handler := New(config.Config{LocalOpenAPIFile: path}).Handler()
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/api/dev/openapi-default", nil))
	if response.Code != http.StatusOK || response.Body.String() != `{"content":"openapi: 3.1.0\ninfo: { title: Preview, version: 1 }\npaths: {}\n","name":"preview.yaml"}`+"\n" {
		t.Fatalf("default response = %d %q", response.Code, response.Body.String())
	}
}
