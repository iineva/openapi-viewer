package server

import (
	"crypto/rand"
	"encoding/base64"
	"sync"

	"github.com/steven/openapi-viewer/internal/gitlab"
)

const sessionCookieName = "openapi_viewer_session"

type session struct {
	Token string
	User  gitlab.User
}

type sessionStore struct {
	mu       sync.RWMutex
	sessions map[string]session
}

func newSessionStore() *sessionStore {
	return &sessionStore{sessions: make(map[string]session)}
}

func (s *sessionStore) create(token string, user gitlab.User) (string, error) {
	id, err := randomValue(32)
	if err != nil {
		return "", err
	}
	s.mu.Lock()
	s.sessions[id] = session{Token: token, User: user}
	s.mu.Unlock()
	return id, nil
}

func (s *sessionStore) get(id string) (session, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	value, ok := s.sessions[id]
	return value, ok
}

func (s *sessionStore) remove(id string) {
	s.mu.Lock()
	delete(s.sessions, id)
	s.mu.Unlock()
}

func randomValue(size int) (string, error) {
	bytes := make([]byte, size)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(bytes), nil
}
