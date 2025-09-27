package auth

import (
	"context"
	"errors"
	"net/http"
	"strings"

	"github.com/ztolley/family-chat-gpt-server/internal/httpx"
	"github.com/ztolley/family-chat-gpt-server/internal/types"
)

type contextKey string

const identityKey contextKey = "identity"

// WithIdentity embeds the authenticated identity into the supplied context.
func WithIdentity(ctx context.Context, identity *types.TokenIdentity) context.Context {
	return context.WithValue(ctx, identityKey, identity)
}

// IdentityFromContext retrieves the authenticated identity placed in the
// request context by the authentication middleware.
func IdentityFromContext(ctx context.Context) (*types.TokenIdentity, bool) {
	identity, ok := ctx.Value(identityKey).(*types.TokenIdentity)
	return identity, ok && identity != nil
}

// Middleware validates a bearer token and attaches the resulting identity to
// the request context, rejecting unauthenticated requests with a JSON error.
func Middleware(verifier *TokenVerifier) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			header := r.Header.Get("Authorization")
			if header == "" || !strings.HasPrefix(header, "Bearer ") {
				httpx.WriteError(w, http.StatusUnauthorized, "Missing bearer token.")
				return
			}

			token := strings.TrimSpace(strings.TrimPrefix(header, "Bearer "))
			identity, err := verifier.Verify(r.Context(), token)
			if err != nil {
				var authErr *AuthenticationError
				if errors.As(err, &authErr) {
					httpx.WriteError(w, authErr.StatusCode, authErr.Message)
					return
				}
				httpx.WriteError(w, http.StatusUnauthorized, "Failed to validate token.")
				return
			}

			ctx := WithIdentity(r.Context(), identity)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}
