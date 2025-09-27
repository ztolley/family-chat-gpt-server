package httpx

import (
	"encoding/json"
	"log"
	"net/http"
	"strings"
)

// WriteJSON sets a JSON content type, writes the provided status code, and
// encodes the payload to the response body. Errors during encoding are logged
// and swallowed to avoid leaking partial responses to clients.
func WriteJSON(w http.ResponseWriter, status int, payload interface{}) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	if payload == nil {
		return
	}
	if err := json.NewEncoder(w).Encode(payload); err != nil {
		log.Printf("httpx: failed to encode json response: %v", err)
	}
}

// WriteError renders a standard JSON error envelope with the supplied status
// code and message.
func WriteError(w http.ResponseWriter, status int, message string) {
	WriteJSON(w, status, map[string]string{"error": message})
}

// Recoverer is a chi-compatible middleware that recovers from panics, logs the
// error, and responds with a JSON error payload.
func Recoverer(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if rec := recover(); rec != nil {
				log.Printf("httpx: panic recovered: %v", rec)
				WriteError(w, http.StatusInternalServerError, "Internal server error.")
			}
		}()

		next.ServeHTTP(w, r)
	})
}

// StringPtrOrNil trims the supplied value and returns a pointer unless the
// string is empty, in which case nil is returned.
func StringPtrOrNil(value string) *string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil
	}
	return StringPtr(trimmed)
}

// StringPtr returns a pointer to the supplied string.
func StringPtr(value string) *string {
	return &value
}
