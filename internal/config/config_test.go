package config

import "testing"

func TestLoadUsesTheDevelopmentOpenAPIDirectoryByDefault(t *testing.T) {
	t.Setenv("DEV_OPENAPI_DIR", "")
	t.Setenv("GITLAB_BASE_URL", "https://gitlab.example.test")
	t.Setenv("GITLAB_CLIENT_ID", "client")
	t.Setenv("GITLAB_CLIENT_SECRET", "secret")
	t.Setenv("GITLAB_REDIRECT_URL", "http://localhost:5173/api/auth/gitlab/callback")
	t.Setenv("SESSION_SECRET", "a-session-secret-that-is-at-least-32-bytes")

	configuration, err := Load()
	if err != nil {
		t.Fatal(err)
	}
	if configuration.DevOpenAPIDir != "./src/openapi" {
		t.Fatalf("DevOpenAPIDir = %q, want ./src/openapi", configuration.DevOpenAPIDir)
	}
}
