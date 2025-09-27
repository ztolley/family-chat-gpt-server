package storage

import (
	"errors"
	"sync"
	"time"

	"github.com/ztolley/family-chat-gpt-server/internal/types"
)

var ErrNotFound = errors.New("item not found")

type MemoryStore struct {
	mu    sync.RWMutex
	items map[string][]types.Item
}

func NewMemoryStore() *MemoryStore {
	return &MemoryStore{items: make(map[string][]types.Item)}
}

func (s *MemoryStore) List(subject string) []types.Item {
	s.mu.RLock()
	defer s.mu.RUnlock()
	items := s.items[subject]
	result := make([]types.Item, len(items))
	copy(result, items)
	return result
}

func (s *MemoryStore) Add(subject string, item types.Item) types.Item {
	s.mu.Lock()
	defer s.mu.Unlock()
	item.UpdatedAt = ensureRFC3339(item.UpdatedAt)
	s.items[subject] = append(s.items[subject], item)
	return item
}

func (s *MemoryStore) Update(subject, id string, transform func(item types.Item) types.Item) (types.Item, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	items := s.items[subject]
	for i := range items {
		if items[i].ID == id {
			updated := transform(items[i])
			updated.UpdatedAt = ensureRFC3339(updated.UpdatedAt)
			items[i] = updated
			s.items[subject] = items
			return updated, nil
		}
	}
	return types.Item{}, ErrNotFound
}

func (s *MemoryStore) Delete(subject, id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	items := s.items[subject]
	for i := range items {
		if items[i].ID == id {
			s.items[subject] = append(items[:i], items[i+1:]...)
			return nil
		}
	}
	return ErrNotFound
}

func ensureRFC3339(value string) string {
	if value == "" {
		return time.Now().UTC().Format(time.RFC3339)
	}
	if _, err := time.Parse(time.RFC3339, value); err != nil {
		return time.Now().UTC().Format(time.RFC3339)
	}
	return value
}
