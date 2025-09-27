package api

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/ztolley/family-chat-gpt-server/internal/auth"
	"github.com/ztolley/family-chat-gpt-server/internal/httpx"
	"github.com/ztolley/family-chat-gpt-server/internal/storage"
	"github.com/ztolley/family-chat-gpt-server/internal/types"
)

const maxRequestBodyBytes = 1 << 20

// Service wires the HTTP handlers for the API endpoints and delegates to the
// injected dependencies for stateful operations.
type Service struct {
	Store storage.Store
}

// New creates a Service bound to the provided store implementation.
func New(store storage.Store) *Service {
	return &Service{Store: store}
}

// Mount registers the API routes on the supplied router.
func (s *Service) Mount(r chi.Router) {
	r.Get("/items", s.listItems)
	r.Post("/items", s.createItem)
	r.Put("/items/{id}", s.updateItem)
	r.Delete("/items/{id}", s.deleteItem)
}

func (s *Service) listItems(w http.ResponseWriter, r *http.Request) {
	identity, ok := auth.IdentityFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, http.StatusInternalServerError, "Authentication context missing.")
		return
	}

	items := s.Store.List(identity.Subject)
	httpx.WriteJSON(w, http.StatusOK, items)
}

type itemPayload struct {
	Title       *string `json:"title"`
	Description *string `json:"description"`
}

func (s *Service) createItem(w http.ResponseWriter, r *http.Request) {
	identity, ok := auth.IdentityFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, http.StatusInternalServerError, "Authentication context missing.")
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, maxRequestBodyBytes)
	defer r.Body.Close()

	var payload itemPayload
	decoder := json.NewDecoder(r.Body)
	if err := decoder.Decode(&payload); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "Invalid JSON payload.")
		return
	}

	title, ok := normaliseTitle(payload.Title)
	if !ok {
		httpx.WriteError(w, http.StatusBadRequest, "A non-empty title is required.")
		return
	}

	description := normaliseDescription(payload.Description)

	item := types.Item{
		ID:          uuid.NewString(),
		Title:       title,
		Description: description,
		UpdatedAt:   timestampNow(),
	}

	s.Store.Add(identity.Subject, item)
	httpx.WriteJSON(w, http.StatusCreated, item)
}

func (s *Service) updateItem(w http.ResponseWriter, r *http.Request) {
	identity, ok := auth.IdentityFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, http.StatusInternalServerError, "Authentication context missing.")
		return
	}

	itemID := strings.TrimSpace(chi.URLParam(r, "id"))
	if itemID == "" {
		httpx.WriteError(w, http.StatusBadRequest, "Item id is required.")
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, maxRequestBodyBytes)
	defer r.Body.Close()

	var payload itemPayload
	decoder := json.NewDecoder(r.Body)
	if err := decoder.Decode(&payload); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "Invalid JSON payload.")
		return
	}

	var (
		titleProvided       bool
		titleValue          string
		descriptionProvided bool
		descriptionValue    *string
	)

	if payload.Title != nil {
		titleProvided = true
		titleValue, ok = normaliseTitle(payload.Title)
		if !ok {
			httpx.WriteError(w, http.StatusBadRequest, "Title must be a string when provided.")
			return
		}
	}

	if payload.Description != nil {
		descriptionProvided = true
		descriptionValue = normaliseDescription(payload.Description)
	}

	updated, err := s.Store.Update(identity.Subject, itemID, func(item types.Item) types.Item {
		if titleProvided {
			item.Title = titleValue
		}
		if descriptionProvided {
			item.Description = descriptionValue
		}
		item.UpdatedAt = timestampNow()
		return item
	})
	if err != nil {
		if errors.Is(err, storage.ErrNotFound) {
			httpx.WriteError(w, http.StatusNotFound, "Item not found.")
			return
		}
		httpx.WriteError(w, http.StatusInternalServerError, "Failed to update item.")
		return
	}

	httpx.WriteJSON(w, http.StatusOK, updated)
}

func (s *Service) deleteItem(w http.ResponseWriter, r *http.Request) {
	identity, ok := auth.IdentityFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, http.StatusInternalServerError, "Authentication context missing.")
		return
	}

	itemID := strings.TrimSpace(chi.URLParam(r, "id"))
	if itemID == "" {
		httpx.WriteError(w, http.StatusBadRequest, "Item id is required.")
		return
	}

	if err := s.Store.Delete(identity.Subject, itemID); err != nil {
		if errors.Is(err, storage.ErrNotFound) {
			httpx.WriteError(w, http.StatusNotFound, "Item not found.")
			return
		}
		httpx.WriteError(w, http.StatusInternalServerError, "Failed to delete item.")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func normaliseTitle(value *string) (string, bool) {
	if value == nil {
		return "", false
	}
	trimmed := strings.TrimSpace(*value)
	if trimmed == "" {
		return "", false
	}
	return trimmed, true
}

func normaliseDescription(value *string) *string {
	if value == nil {
		return nil
	}
	trimmed := strings.TrimSpace(*value)
	if trimmed == "" {
		return nil
	}
	return httpx.StringPtr(trimmed)
}

func timestampNow() string {
	return time.Now().UTC().Format(time.RFC3339)
}
