package auth

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"

	"google.golang.org/api/idtoken"
	"google.golang.org/api/option"

	"github.com/ztolley/family-chat-gpt-server/internal/types"
)

type AuthenticationError struct {
	Message    string
	StatusCode int
}

func (e *AuthenticationError) Error() string {
	return e.Message
}

type TokenVerifier struct {
	googleClientID string
	validator      *idtoken.Validator
}

func NewTokenVerifier(client *http.Client, googleClientID string) (*TokenVerifier, error) {
	if client == nil {
		client = &http.Client{Timeout: 10 * time.Second}
	}

	validator, err := idtoken.NewValidator(context.Background(), option.WithHTTPClient(client))
	if err != nil {
		return nil, fmt.Errorf("create google id token validator: %w", err)
	}

	return &TokenVerifier{
		googleClientID: googleClientID,
		validator:      validator,
	}, nil
}

func (v *TokenVerifier) Verify(ctx context.Context, token string) (*types.TokenIdentity, error) {
	if strings.TrimSpace(token) == "" {
		return nil, &AuthenticationError{Message: "Missing bearer token.", StatusCode: http.StatusUnauthorized}
	}

	payload, err := v.validator.Validate(ctx, token, v.googleClientID)
	if err != nil {
		if strings.Contains(err.Error(), "audience provided does not match") {
			return nil, &AuthenticationError{Message: "Token audience does not match the configured client id.", StatusCode: http.StatusUnauthorized}
		}
		return nil, &AuthenticationError{Message: "Failed to validate token.", StatusCode: http.StatusUnauthorized}
	}

	if payload == nil || payload.Subject == "" {
		return nil, &AuthenticationError{Message: "Token payload missing subject.", StatusCode: http.StatusUnauthorized}
	}

	identity := &types.TokenIdentity{
		Provider: types.ProviderGoogle,
		Subject:  payload.Subject,
	}

	if email, ok := stringClaim(payload.Claims, "email"); ok {
		identity.Email = stringPtr(email)
	}
	if name, ok := stringClaim(payload.Claims, "name"); ok {
		identity.Name = stringPtr(name)
	}

	return identity, nil
}

func stringClaim(claims map[string]interface{}, key string) (string, bool) {
	if claims == nil {
		return "", false
	}

	raw, ok := claims[key]
	if !ok {
		return "", false
	}

	value, ok := raw.(string)
	if !ok {
		return "", false
	}

	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return "", false
	}

	return trimmed, true
}

func stringPtr(value string) *string {
	return &value
}
