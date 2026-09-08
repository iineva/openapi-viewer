package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
)

type Config struct {
	Address            string
	AppBaseURL         string
	GitLabBaseURL      string
	GitLabClientID     string
	GitLabClientSecret string
	GitLabRedirectURL  string
	SessionSecret      string
	DevOpenAPIDir      string
	LocalOpenAPIFile   string
	CookieSecure       bool
}

func Load() (Config, error) {
	config := Config{
		Address:            value("LISTEN_ADDR", ":8080"),
		AppBaseURL:         strings.TrimRight(value("APP_BASE_URL", "http://127.0.0.1:8080"), "/"),
		GitLabBaseURL:      strings.TrimRight(os.Getenv("GITLAB_BASE_URL"), "/"),
		GitLabClientID:     os.Getenv("GITLAB_CLIENT_ID"),
		GitLabClientSecret: os.Getenv("GITLAB_CLIENT_SECRET"),
		GitLabRedirectURL:  os.Getenv("GITLAB_REDIRECT_URL"),
		SessionSecret:      os.Getenv("SESSION_SECRET"),
		DevOpenAPIDir:      strings.TrimSpace(value("DEV_OPENAPI_DIR", "./src/openapi")),
		LocalOpenAPIFile:   strings.TrimSpace(os.Getenv("LOCAL_OPENAPI_FILE")),
	}
	secure, err := strconv.ParseBool(value("COOKIE_SECURE", "false"))
	if err != nil {
		return Config{}, fmt.Errorf("parse COOKIE_SECURE: %w", err)
	}
	config.CookieSecure = secure
	if config.GitLabBaseURL == "" || config.GitLabClientID == "" || config.GitLabClientSecret == "" || config.GitLabRedirectURL == "" || len(config.SessionSecret) < 32 {
		return Config{}, fmt.Errorf("GITLAB_BASE_URL, GITLAB_CLIENT_ID, GITLAB_CLIENT_SECRET, GITLAB_REDIRECT_URL and a SESSION_SECRET of at least 32 bytes are required")
	}
	return config, nil
}

func value(name, fallback string) string {
	if value := os.Getenv(name); value != "" {
		return value
	}
	return fallback
}
