package main

import (
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/cors"

	"github.com/ztolley/family-chat-gpt-server/internal/api"
	"github.com/ztolley/family-chat-gpt-server/internal/auth"
	"github.com/ztolley/family-chat-gpt-server/internal/httpx"
	"github.com/ztolley/family-chat-gpt-server/internal/static"
	"github.com/ztolley/family-chat-gpt-server/internal/storage"
)

func main() {
	port := readPort()

	publicDir, indexPath, err := static.Resolve(os.Getenv("PUBLIC_DIR"))
	if err != nil {
		log.Fatalf("failed to resolve public assets: %v", err)
	}

	googleClientID := os.Getenv("GOOGLE_CLIENT_ID")
	appleClientID := os.Getenv("APPLE_CLIENT_ID")

	verifier := auth.NewTokenVerifier(nil, googleClientID, appleClientID)
	store := storage.NewMemoryStore()
	apiService := api.New(store)

	r := chi.NewRouter()
	r.Use(httpx.Recoverer)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins: []string{"*"},
		AllowedMethods: []string{http.MethodGet, http.MethodPost, http.MethodPut, http.MethodDelete, http.MethodOptions},
		AllowedHeaders: []string{"Content-Type", "Authorization"},
		ExposedHeaders: []string{},
		MaxAge:         300,
	}))

	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		httpx.WriteJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})

	r.Get("/config", func(w http.ResponseWriter, r *http.Request) {
		httpx.WriteJSON(w, http.StatusOK, map[string]*string{
			"googleClientId": httpx.StringPtrOrNil(googleClientID),
			"appleClientId":  httpx.StringPtrOrNil(appleClientID),
		})
	})

	r.Route("/api", func(apiRouter chi.Router) {
		apiRouter.Use(auth.Middleware(verifier))
		apiService.Mount(apiRouter)
	})

	r.MethodNotAllowed(func(w http.ResponseWriter, r *http.Request) {
		httpx.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed.")
	})

	r.NotFound(static.Handler(publicDir, indexPath))

	log.Printf("Server listening on http://localhost:%d", port)

	server := &http.Server{
		Addr:    fmt.Sprintf(":%d", port),
		Handler: r,
	}

	if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Fatalf("server error: %v", err)
	}
}

func readPort() int {
	value := os.Getenv("PORT")
	if value == "" {
		return 3000
	}
	port, err := strconv.Atoi(value)
	if err != nil || port <= 0 || port > 65535 {
		return 3000
	}
	return port
}
