package auth

import (
	"context"
	"crypto/rsa"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"math/big"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"

	"github.com/ztolley/family-chat-gpt-server/internal/types"
)

const (
	googleIssuerPrimary   = "https://accounts.google.com"
	googleIssuerSecondary = "accounts.google.com"
	googleJWKSURL         = "https://www.googleapis.com/oauth2/v3/certs"
	appleIssuer           = "https://appleid.apple.com"
	appleJWKSURL          = "https://appleid.apple.com/auth/keys"
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
	appleClientID  string
	googleJWKS     *jwksCache
	appleJWKS      *jwksCache
	parser         *jwt.Parser
}

func NewTokenVerifier(client *http.Client, googleClientID, appleClientID string) *TokenVerifier {
	if client == nil {
		client = &http.Client{Timeout: 10 * time.Second}
	}

	return &TokenVerifier{
		googleClientID: googleClientID,
		appleClientID:  appleClientID,
		googleJWKS:     newJWKSCache(googleJWKSURL, client, time.Hour),
		appleJWKS:      newJWKSCache(appleJWKSURL, client, time.Hour),
		parser:         jwt.NewParser(jwt.WithValidMethods([]string{jwt.SigningMethodRS256.Name})),
	}
}

func (v *TokenVerifier) Verify(ctx context.Context, token string) (*types.TokenIdentity, error) {
	if strings.TrimSpace(token) == "" {
		return nil, &AuthenticationError{Message: "Missing bearer token.", StatusCode: http.StatusUnauthorized}
	}

	claims := &idTokenClaims{}
	if _, _, err := v.parser.ParseUnverified(token, claims); err != nil {
		return nil, &AuthenticationError{Message: "Invalid token.", StatusCode: http.StatusUnauthorized}
	}

	provider, cache, audience := v.selectProvider(claims.Issuer)
	if cache == nil {
		return nil, &AuthenticationError{Message: "Unknown token issuer.", StatusCode: http.StatusUnauthorized}
	}

	keyFunc := func(t *jwt.Token) (interface{}, error) {
		if t.Method.Alg() != jwt.SigningMethodRS256.Alg() {
			return nil, &AuthenticationError{Message: "Unsupported token algorithm.", StatusCode: http.StatusUnauthorized}
		}

		kidValue, ok := t.Header["kid"].(string)
		if !ok || kidValue == "" {
			return nil, &AuthenticationError{Message: "Token is missing key id.", StatusCode: http.StatusUnauthorized}
		}

		key, err := cache.GetKey(ctx, kidValue)
		if err != nil {
			return nil, &AuthenticationError{Message: "Failed to validate token signature.", StatusCode: http.StatusUnauthorized}
		}

		return key, nil
	}

	parsedToken, err := v.parser.ParseWithClaims(token, claims, keyFunc)
	if err != nil {
		var authErr *AuthenticationError
		if errors.As(err, &authErr) {
			return nil, authErr
		}
		return nil, &AuthenticationError{Message: "Failed to validate token.", StatusCode: http.StatusUnauthorized}
	}

	if !parsedToken.Valid {
		return nil, &AuthenticationError{Message: "Invalid token.", StatusCode: http.StatusUnauthorized}
	}

	if claims.Subject == "" {
		return nil, &AuthenticationError{Message: "Token payload missing subject.", StatusCode: http.StatusUnauthorized}
	}

	if provider == types.ProviderGoogle {
		if claims.Issuer != googleIssuerPrimary && claims.Issuer != googleIssuerSecondary {
			return nil, &AuthenticationError{Message: "Invalid Google token issuer.", StatusCode: http.StatusUnauthorized}
		}
	}

	if provider == types.ProviderApple {
		if claims.Issuer != appleIssuer {
			return nil, &AuthenticationError{Message: "Invalid Apple token issuer.", StatusCode: http.StatusUnauthorized}
		}
	}

	if audience != "" && !audienceContains(claims.Audience, audience) {
		return nil, &AuthenticationError{Message: "Token audience does not match the configured client id.", StatusCode: http.StatusUnauthorized}
	}

	identity := &types.TokenIdentity{
		Provider: provider,
		Subject:  claims.Subject,
	}

	if email := strings.TrimSpace(claims.Email); email != "" {
		identity.Email = stringPtr(email)
	}

	if name := strings.TrimSpace(claims.Name); name != "" {
		identity.Name = stringPtr(name)
	}

	return identity, nil
}

func (v *TokenVerifier) selectProvider(issuer string) (types.AuthProvider, *jwksCache, string) {
	switch issuer {
	case googleIssuerPrimary, googleIssuerSecondary:
		return types.ProviderGoogle, v.googleJWKS, v.googleClientID
	case appleIssuer:
		return types.ProviderApple, v.appleJWKS, v.appleClientID
	default:
		return "", nil, ""
	}
}

type idTokenClaims struct {
	jwt.RegisteredClaims
	Email string `json:"email"`
	Name  string `json:"name"`
}

type jwksCache struct {
	url    string
	client *http.Client
	ttl    time.Duration

	mu      sync.Mutex
	keys    map[string]*rsa.PublicKey
	fetched time.Time
}

func newJWKSCache(url string, client *http.Client, ttl time.Duration) *jwksCache {
	return &jwksCache{url: url, client: client, ttl: ttl}
}

func (c *jwksCache) GetKey(ctx context.Context, kid string) (*rsa.PublicKey, error) {
	if strings.TrimSpace(kid) == "" {
		return nil, errors.New("kid is required")
	}

	c.mu.Lock()
	defer c.mu.Unlock()

	if c.keys == nil || time.Since(c.fetched) > c.ttl {
		if err := c.refresh(ctx); err != nil {
			return nil, err
		}
	}

	key, ok := c.keys[kid]
	if ok {
		return key, nil
	}

	if err := c.refresh(ctx); err != nil {
		return nil, err
	}

	key, ok = c.keys[kid]
	if !ok {
		return nil, fmt.Errorf("public key not found for kid %q", kid)
	}

	return key, nil
}

func (c *jwksCache) refresh(ctx context.Context) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.url, nil)
	if err != nil {
		return err
	}

	resp, err := c.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("unexpected status code %d", resp.StatusCode)
	}

	var payload jwksResponse
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return err
	}

	keys := make(map[string]*rsa.PublicKey, len(payload.Keys))
	for _, entry := range payload.Keys {
		if !strings.EqualFold(entry.Kty, "RSA") {
			continue
		}
		if entry.Kid == "" || entry.N == "" || entry.E == "" {
			continue
		}

		pub, err := buildRSAPublicKey(entry.N, entry.E)
		if err != nil {
			continue
		}

		keys[entry.Kid] = pub
	}

	if len(keys) == 0 {
		return errors.New("no RSA keys found in JWKS payload")
	}

	c.keys = keys
	c.fetched = time.Now()
	return nil
}

type jwksResponse struct {
	Keys []jwkEntry `json:"keys"`
}

type jwkEntry struct {
	Kid string `json:"kid"`
	Kty string `json:"kty"`
	N   string `json:"n"`
	E   string `json:"e"`
}

func buildRSAPublicKey(nValue, eValue string) (*rsa.PublicKey, error) {
	nBytes, err := base64.RawURLEncoding.DecodeString(nValue)
	if err != nil {
		return nil, err
	}

	eBytes, err := base64.RawURLEncoding.DecodeString(eValue)
	if err != nil {
		return nil, err
	}

	n := new(big.Int).SetBytes(nBytes)
	e := bigEndianBytesToInt(eBytes)
	if e == 0 {
		return nil, errors.New("invalid RSA exponent")
	}

	return &rsa.PublicKey{N: n, E: e}, nil
}

func bigEndianBytesToInt(data []byte) int {
	result := 0
	for _, b := range data {
		result = (result << 8) | int(b)
	}
	return result
}

func stringPtr(value string) *string {
	return &value
}

func audienceContains(auds jwt.ClaimStrings, audience string) bool {
	for _, value := range auds {
		if value == audience {
			return true
		}
	}
	return false
}
