package types

type AuthProvider string

const (
	ProviderGoogle AuthProvider = "google"
	ProviderApple  AuthProvider = "apple"
)

type TokenIdentity struct {
	Provider AuthProvider `json:"provider"`
	Subject  string       `json:"subject"`
	Email    *string      `json:"email,omitempty"`
	Name     *string      `json:"name,omitempty"`
}

type Item struct {
	ID          string  `json:"id"`
	Title       string  `json:"title"`
	Description *string `json:"description,omitempty"`
	UpdatedAt   string  `json:"updatedAt"`
}
