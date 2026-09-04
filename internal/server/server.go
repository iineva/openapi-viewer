package server

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"io/fs"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/steven/openapi-viewer/internal/config"
	"github.com/steven/openapi-viewer/internal/gitlab"
	"golang.org/x/oauth2"
)

const oauthStateCookieName = "openapi_viewer_oauth_state"

type Server struct {
	config   config.Config
	gitlab   *gitlab.Client
	oauth    oauth2.Config
	sessions *sessionStore
	signer   []byte
}

func New(configuration config.Config) *Server {
	return &Server{
		config: configuration,
		gitlab: gitlab.NewClient(configuration.GitLabBaseURL, nil),
		oauth: oauth2.Config{
			ClientID:     configuration.GitLabClientID,
			ClientSecret: configuration.GitLabClientSecret,
			RedirectURL:  configuration.GitLabRedirectURL,
			Endpoint: oauth2.Endpoint{
				AuthURL:  configuration.GitLabBaseURL + "/oauth/authorize",
				TokenURL: configuration.GitLabBaseURL + "/oauth/token",
			},
			Scopes: []string{"read_user", "read_api", "read_repository"},
		},
		sessions: newSessionStore(),
		signer:   []byte(configuration.SessionSecret),
	}
}

func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/auth/gitlab/login", s.login)
	mux.HandleFunc("GET /api/auth/gitlab/callback", s.callback)
	mux.HandleFunc("POST /api/auth/logout", s.logout)
	mux.HandleFunc("GET /api/auth/session", s.currentSession)
	mux.HandleFunc("GET /api/gitlab/projects", s.projects)
	mux.HandleFunc("GET /api/gitlab/projects/{projectID}/refs", s.branches)
	mux.HandleFunc("POST /api/gitlab/projects/{projectID}/scan", s.scan)
	mux.HandleFunc("GET /api/gitlab/projects/{projectID}/file", s.file)
	return s.staticHandler(mux)
}

func (s *Server) login(w http.ResponseWriter, r *http.Request) {
	state, err := randomValue(24)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "create OAuth state")
		return
	}
	s.setCookie(w, oauthStateCookieName, state, 600)
	http.Redirect(w, r, s.oauth.AuthCodeURL(state, oauth2.AccessTypeOffline), http.StatusFound)
}

func (s *Server) callback(w http.ResponseWriter, r *http.Request) {
	state, err := r.Cookie(oauthStateCookieName)
	if err != nil || !hmac.Equal([]byte(state.Value), []byte(r.URL.Query().Get("state"))) {
		writeError(w, http.StatusBadRequest, "invalid OAuth state")
		return
	}
	token, err := s.oauth.Exchange(r.Context(), r.URL.Query().Get("code"))
	if err != nil {
		writeError(w, http.StatusBadGateway, "exchange GitLab authorization code")
		return
	}
	user, err := s.gitlab.CurrentUser(r.Context(), token.AccessToken)
	if err != nil {
		writeError(w, http.StatusBadGateway, "load GitLab user")
		return
	}
	id, err := s.sessions.create(token.AccessToken, user)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "create session")
		return
	}
	s.setCookie(w, sessionCookieName, s.sign(id), int((12 * time.Hour).Seconds()))
	s.setCookie(w, oauthStateCookieName, "", -1)
	http.Redirect(w, r, s.config.AppBaseURL, http.StatusFound)
}

func (s *Server) logout(w http.ResponseWriter, r *http.Request) {
	if session, ok := s.session(r); ok {
		s.sessions.remove(session.id)
	}
	s.setCookie(w, sessionCookieName, "", -1)
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) currentSession(w http.ResponseWriter, r *http.Request) {
	session, ok := s.session(r)
	if !ok {
		writeError(w, http.StatusUnauthorized, "GitLab login required")
		return
	}
	writeJSON(w, http.StatusOK, session.User)
}

func (s *Server) projects(w http.ResponseWriter, r *http.Request) {
	session, ok := s.requireSession(w, r)
	if !ok {
		return
	}
	projects, err := s.gitlab.Projects(r.Context(), session.Token)
	if err != nil {
		writeError(w, http.StatusBadGateway, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, projects)
}

func (s *Server) branches(w http.ResponseWriter, r *http.Request) {
	session, projectID, ok := s.sessionProject(w, r)
	if !ok {
		return
	}
	branches, err := s.gitlab.Branches(r.Context(), session.Token, projectID)
	if err != nil {
		writeError(w, http.StatusBadGateway, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, branches)
}

func (s *Server) scan(w http.ResponseWriter, r *http.Request) {
	session, projectID, ok := s.sessionProject(w, r)
	if !ok {
		return
	}
	var request struct {
		Ref string `json:"ref"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 16<<10)).Decode(&request); err != nil || strings.TrimSpace(request.Ref) == "" {
		writeError(w, http.StatusBadRequest, "a GitLab ref is required")
		return
	}
	files, err := s.gitlab.ScanOpenAPIFiles(r.Context(), session.Token, projectID, request.Ref)
	if err != nil {
		writeError(w, http.StatusBadGateway, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, files)
}

func (s *Server) file(w http.ResponseWriter, r *http.Request) {
	session, projectID, ok := s.sessionProject(w, r)
	if !ok {
		return
	}
	ref, filePath := r.URL.Query().Get("ref"), r.URL.Query().Get("path")
	if ref == "" || filePath == "" {
		writeError(w, http.StatusBadRequest, "ref and path are required")
		return
	}
	content, err := s.gitlab.FileContent(r.Context(), session.Token, projectID, ref, filePath)
	if err != nil {
		writeError(w, http.StatusBadGateway, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"content": content})
}

type activeSession struct {
	id string
	gitlab.User
	Token string
}

func (s *Server) requireSession(w http.ResponseWriter, r *http.Request) (activeSession, bool) {
	session, ok := s.session(r)
	if !ok {
		writeError(w, http.StatusUnauthorized, "GitLab login required")
	}
	return session, ok
}

func (s *Server) sessionProject(w http.ResponseWriter, r *http.Request) (activeSession, int64, bool) {
	session, ok := s.requireSession(w, r)
	if !ok {
		return activeSession{}, 0, false
	}
	projectID, err := strconv.ParseInt(r.PathValue("projectID"), 10, 64)
	if err != nil || projectID <= 0 {
		writeError(w, http.StatusBadRequest, "invalid GitLab project ID")
		return activeSession{}, 0, false
	}
	return session, projectID, true
}

func (s *Server) session(r *http.Request) (activeSession, bool) {
	cookie, err := r.Cookie(sessionCookieName)
	if err != nil {
		return activeSession{}, false
	}
	id, ok := s.verify(cookie.Value)
	if !ok {
		return activeSession{}, false
	}
	stored, ok := s.sessions.get(id)
	if !ok {
		return activeSession{}, false
	}
	return activeSession{id: id, User: stored.User, Token: stored.Token}, true
}

func (s *Server) sign(value string) string {
	mac := hmac.New(sha256.New, s.signer)
	_, _ = mac.Write([]byte(value))
	return value + "." + base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
}

func (s *Server) verify(value string) (string, bool) {
	parts := strings.Split(value, ".")
	if len(parts) != 2 || parts[0] == "" {
		return "", false
	}
	return parts[0], hmac.Equal([]byte(value), []byte(s.sign(parts[0])))
}

func (s *Server) setCookie(w http.ResponseWriter, name, value string, maxAge int) {
	http.SetCookie(w, &http.Cookie{Name: name, Value: value, Path: "/", MaxAge: maxAge, HttpOnly: true, SameSite: http.SameSiteLaxMode, Secure: s.config.CookieSecure})
}

func (s *Server) staticHandler(api http.Handler) http.Handler {
	files := http.FileServer(http.Dir(s.config.StaticDir))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/api/") {
			api.ServeHTTP(w, r)
			return
		}
		requested := filepath.Join(s.config.StaticDir, filepath.Clean(r.URL.Path))
		if r.URL.Path != "/" {
			if info, err := os.Stat(requested); err == nil && !info.IsDir() {
				files.ServeHTTP(w, r)
				return
			}
		}
		index, err := os.ReadFile(filepath.Join(s.config.StaticDir, "index.html"))
		if errors.Is(err, fs.ErrNotExist) {
			writeError(w, http.StatusServiceUnavailable, "frontend assets are not built")
			return
		}
		if err != nil {
			writeError(w, http.StatusInternalServerError, "read frontend assets")
			return
		}
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		_, _ = w.Write(index)
	})
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}

func Run(ctx context.Context, configuration config.Config) error {
	server := &http.Server{Addr: configuration.Address, Handler: New(configuration).Handler()}
	go func() {
		<-ctx.Done()
		_ = server.Close()
	}()
	if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		return err
	}
	return nil
}
