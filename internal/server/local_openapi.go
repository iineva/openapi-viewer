package server

import (
	"errors"
	"io/fs"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"gopkg.in/yaml.v3"
)

type localOpenAPIFile struct {
	Path    string `json:"path"`
	Title   string `json:"title"`
	Version string `json:"version"`
}

func (s *Server) localOpenAPIFiles(w http.ResponseWriter, r *http.Request) {
	files, err := scanLocalOpenAPIFiles(s.config.DevOpenAPIDir)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "scan local OpenAPI files")
		return
	}
	writeJSON(w, http.StatusOK, files)
}

func (s *Server) localOpenAPIFile(w http.ResponseWriter, r *http.Request) {
	content, err := readLocalOpenAPIFile(s.config.DevOpenAPIDir, r.URL.Query().Get("path"))
	if errors.Is(err, errInvalidLocalOpenAPIPath) {
		writeError(w, http.StatusBadRequest, "invalid local OpenAPI path")
		return
	}
	if errors.Is(err, fs.ErrNotExist) {
		writeError(w, http.StatusNotFound, "local OpenAPI file not found")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "read local OpenAPI file")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"content": content})
}

func (s *Server) localOpenAPIDefault(w http.ResponseWriter, r *http.Request) {
	path := s.config.LocalOpenAPIFile
	if path == "" {
		writeError(w, http.StatusNotFound, "no local OpenAPI file configured")
		return
	}
	content, err := os.ReadFile(path)
	if errors.Is(err, fs.ErrNotExist) {
		writeError(w, http.StatusNotFound, "local OpenAPI file not found")
		return
	}
	if err != nil || !isOpenAPI(filepath.Base(path), content) {
		writeError(w, http.StatusBadRequest, "invalid local OpenAPI file")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"content": string(content), "name": filepath.Base(path)})
}

var errInvalidLocalOpenAPIPath = errors.New("invalid local OpenAPI path")

func scanLocalOpenAPIFiles(root string) ([]localOpenAPIFile, error) {
	if strings.TrimSpace(root) == "" {
		return []localOpenAPIFile{}, nil
	}
	files := []localOpenAPIFile{}
	err := filepath.WalkDir(root, func(path string, entry fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if entry.IsDir() || entry.Type()&fs.ModeSymlink != 0 {
			return nil
		}
		content, err := os.ReadFile(path)
		if err != nil || !isOpenAPI(entry.Name(), content) {
			return nil
		}
		info := openAPIInfo(content)
		relative, err := filepath.Rel(root, path)
		if err != nil {
			return err
		}
		files = append(files, localOpenAPIFile{Path: filepath.ToSlash(relative), Title: info.title, Version: info.version})
		return nil
	})
	if errors.Is(err, fs.ErrNotExist) {
		return []localOpenAPIFile{}, nil
	}
	sort.Slice(files, func(first, second int) bool { return files[first].Path < files[second].Path })
	return files, err
}

func readLocalOpenAPIFile(root, requested string) (string, error) {
	if strings.TrimSpace(root) == "" || requested == "" || filepath.IsAbs(requested) {
		return "", errInvalidLocalOpenAPIPath
	}
	cleaned := filepath.Clean(requested)
	if cleaned == "." || cleaned == ".." || strings.HasPrefix(cleaned, ".."+string(filepath.Separator)) {
		return "", errInvalidLocalOpenAPIPath
	}
	resolvedRoot, err := filepath.EvalSymlinks(root)
	if err != nil {
		return "", err
	}
	resolvedFile, err := filepath.EvalSymlinks(filepath.Join(resolvedRoot, cleaned))
	if err != nil {
		return "", err
	}
	relative, err := filepath.Rel(resolvedRoot, resolvedFile)
	if err != nil || relative == ".." || strings.HasPrefix(relative, ".."+string(filepath.Separator)) {
		return "", errInvalidLocalOpenAPIPath
	}
	content, err := os.ReadFile(resolvedFile)
	if err != nil {
		return "", err
	}
	if !isOpenAPI(filepath.Base(resolvedFile), content) {
		return "", errInvalidLocalOpenAPIPath
	}
	return string(content), nil
}

type specificationInfo struct{ title, version string }

func isOpenAPI(name string, content []byte) bool {
	if extension := strings.ToLower(filepath.Ext(name)); extension != ".yaml" && extension != ".yml" && extension != ".json" {
		return false
	}
	var document map[string]any
	if yaml.Unmarshal(content, &document) != nil {
		return false
	}
	_, openAPI := document["openapi"].(string)
	_, swagger := document["swagger"].(string)
	return openAPI || swagger
}

func openAPIInfo(content []byte) specificationInfo {
	var document struct {
		Info struct {
			Title   string `yaml:"title"`
			Version string `yaml:"version"`
		} `yaml:"info"`
	}
	_ = yaml.Unmarshal(content, &document)
	return specificationInfo{title: document.Info.Title, version: document.Info.Version}
}
