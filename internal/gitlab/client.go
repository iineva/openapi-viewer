package gitlab

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"path"
	"strings"

	"gopkg.in/yaml.v3"
)

type Client struct {
	baseURL    string
	httpClient *http.Client
}

type OpenAPIFile struct {
	Path    string `json:"path"`
	SHA     string `json:"sha"`
	Title   string `json:"title"`
	Version string `json:"version"`
}

type User struct {
	ID       int64  `json:"id"`
	Username string `json:"username"`
	Name     string `json:"name"`
}

type Project struct {
	ID                int64  `json:"id"`
	Name              string `json:"name"`
	PathWithNamespace string `json:"path_with_namespace"`
	DefaultBranch     string `json:"default_branch"`
}

type Branch struct {
	Name string `json:"name"`
}

type treeEntry struct {
	ID   string `json:"id"`
	Path string `json:"path"`
	Type string `json:"type"`
}

func NewClient(baseURL string, httpClient *http.Client) *Client {
	if httpClient == nil {
		httpClient = http.DefaultClient
	}
	return &Client{baseURL: strings.TrimRight(baseURL, "/"), httpClient: httpClient}
}

func (c *Client) ScanOpenAPIFiles(ctx context.Context, token string, projectID int64, ref string) ([]OpenAPIFile, error) {
	entries, err := c.repositoryTree(ctx, token, projectID, ref)
	if err != nil {
		return nil, err
	}

	files := make([]OpenAPIFile, 0)
	for _, entry := range entries {
		if entry.Type != "blob" || !isSpecificationPath(entry.Path) {
			continue
		}
		content, err := c.FileContent(ctx, token, projectID, ref, entry.Path)
		if err != nil {
			return nil, err
		}
		title, version, ok := openAPIMetadata(content)
		if ok {
			files = append(files, OpenAPIFile{Path: entry.Path, SHA: entry.ID, Title: title, Version: version})
		}
	}
	return files, nil
}

func (c *Client) CurrentUser(ctx context.Context, token string) (User, error) {
	var user User
	if err := c.getJSON(ctx, token, "/api/v4/user", nil, &user); err != nil {
		return User{}, err
	}
	return user, nil
}

func (c *Client) Projects(ctx context.Context, token string) ([]Project, error) {
	projects := make([]Project, 0)
	for page := 1; ; page++ {
		var batch []Project
		query := url.Values{"membership": {"true"}, "simple": {"true"}, "order_by": {"path"}, "sort": {"asc"}, "per_page": {"100"}, "page": {fmt.Sprint(page)}}
		if err := c.getJSON(ctx, token, "/api/v4/projects", query, &batch); err != nil {
			return nil, err
		}
		projects = append(projects, batch...)
		if len(batch) < 100 {
			return projects, nil
		}
	}
}

func (c *Client) Branches(ctx context.Context, token string, projectID int64) ([]Branch, error) {
	var branches []Branch
	if err := c.getJSON(ctx, token, fmt.Sprintf("/api/v4/projects/%d/repository/branches", projectID), url.Values{"per_page": {"100"}}, &branches); err != nil {
		return nil, err
	}
	return branches, nil
}

func (c *Client) FileContent(ctx context.Context, token string, projectID int64, ref, filePath string) (string, error) {
	fileID := url.PathEscape(filePath)
	body, err := c.get(ctx, token, fmt.Sprintf("/api/v4/projects/%d/repository/files/%s/raw", projectID, fileID), url.Values{"ref": {ref}})
	if err != nil {
		return "", err
	}
	return string(body), nil
}

func (c *Client) repositoryTree(ctx context.Context, token string, projectID int64, ref string) ([]treeEntry, error) {
	entries := make([]treeEntry, 0)
	for page := 1; ; page++ {
		query := url.Values{"ref": {ref}, "recursive": {"true"}, "per_page": {"100"}, "page": {fmt.Sprint(page)}}
		body, err := c.get(ctx, token, fmt.Sprintf("/api/v4/projects/%d/repository/tree", projectID), query)
		if err != nil {
			return nil, err
		}
		var batch []treeEntry
		if err := json.Unmarshal(body, &batch); err != nil {
			return nil, fmt.Errorf("decode repository tree: %w", err)
		}
		entries = append(entries, batch...)
		if len(batch) < 100 {
			return entries, nil
		}
	}
}

func (c *Client) get(ctx context.Context, token, requestPath string, query url.Values) ([]byte, error) {
	endpoint, err := url.Parse(c.baseURL + requestPath)
	if err != nil {
		return nil, fmt.Errorf("build GitLab request URL: %w", err)
	}
	endpoint.RawQuery = query.Encode()
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint.String(), nil)
	if err != nil {
		return nil, fmt.Errorf("create GitLab request: %w", err)
	}
	request.Header.Set("Authorization", "Bearer "+token)
	response, err := c.httpClient.Do(request)
	if err != nil {
		return nil, fmt.Errorf("request GitLab: %w", err)
	}
	defer response.Body.Close()
	body, err := io.ReadAll(io.LimitReader(response.Body, 10<<20))
	if err != nil {
		return nil, fmt.Errorf("read GitLab response: %w", err)
	}
	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		return nil, fmt.Errorf("GitLab API %s returned %d: %s", requestPath, response.StatusCode, strings.TrimSpace(string(body)))
	}
	return body, nil
}

func (c *Client) getJSON(ctx context.Context, token, requestPath string, query url.Values, target any) error {
	body, err := c.get(ctx, token, requestPath, query)
	if err != nil {
		return err
	}
	if err := json.Unmarshal(body, target); err != nil {
		return fmt.Errorf("decode GitLab response: %w", err)
	}
	return nil
}

func isSpecificationPath(filePath string) bool {
	extension := strings.ToLower(path.Ext(filePath))
	return extension == ".yaml" || extension == ".yml" || extension == ".json"
}

func openAPIMetadata(content string) (title, version string, ok bool) {
	var document map[string]any
	if err := yaml.Unmarshal([]byte(content), &document); err != nil {
		return "", "", false
	}
	if _, hasOpenAPI := document["openapi"]; !hasOpenAPI {
		if _, hasSwagger := document["swagger"]; !hasSwagger {
			return "", "", false
		}
	}
	info, _ := document["info"].(map[string]any)
	if info == nil {
		return "", "", false
	}
	title, _ = info["title"].(string)
	version, _ = info["version"].(string)
	return title, version, title != "" && version != ""
}
