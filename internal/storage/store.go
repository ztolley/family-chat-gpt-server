package storage

import "github.com/ztolley/family-chat-gpt-server/internal/types"

// Store defines the behaviours required by the API layer to persist items.
type Store interface {
	List(subject string) []types.Item
	Add(subject string, item types.Item) types.Item
	Update(subject, id string, transform func(item types.Item) types.Item) (types.Item, error)
	Delete(subject, id string) error
}

var _ Store = (*MemoryStore)(nil)
