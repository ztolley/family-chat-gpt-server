package static

import (
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/ztolley/family-chat-gpt-server/internal/httpx"
)

// Resolve determines the public assets directory and index file path. If base
// is empty the working directory's ./public directory is used.
func Resolve(base string) (string, string, error) {
	if base == "" {
		wd, err := os.Getwd()
		if err != nil {
			return "", "", err
		}
		base = filepath.Join(wd, "public")
	}

	base = filepath.Clean(base)
	info, err := os.Stat(base)
	if err != nil {
		return "", "", err
	}
	if !info.IsDir() {
		return "", "", fmt.Errorf("%s is not a directory", base)
	}

	index := filepath.Join(base, "index.html")
	if _, err := os.Stat(index); err != nil {
		return "", "", err
	}

	return base, index, nil
}

// Handler serves static assets from publicDir and falls back to indexPath for
// unmatched GET requests to support SPA-style routing.
func Handler(publicDir, indexPath string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			httpx.WriteError(w, http.StatusNotFound, "Not found.")
			return
		}

		if r.URL.Path == "" || r.URL.Path == "/" {
			http.ServeFile(w, r, indexPath)
			return
		}

		relative := strings.TrimPrefix(filepath.Clean("/"+r.URL.Path), "/")
		fullPath := filepath.Join(publicDir, relative)
		rel, err := filepath.Rel(publicDir, fullPath)
		if err != nil || strings.HasPrefix(rel, "..") {
			httpx.WriteError(w, http.StatusForbidden, "Forbidden.")
			return
		}

		info, err := os.Stat(fullPath)
		if err == nil && !info.IsDir() {
			http.ServeFile(w, r, fullPath)
			return
		}

		http.ServeFile(w, r, indexPath)
	}
}
