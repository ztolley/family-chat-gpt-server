# Family Chat (GPT)

Dad has a ChatGPT Plus account for work and the rest of the family want one to
help with homework, household management, advice, money planning etc.
Unfortunately ChatGPT doesn't offer a family plan.

Family Chat (GPT) lets each family member log in and submit queries to ChatGPT
via the ChatGPT API and an API key tied to Dad's plan. Queries include metadata
so the server only returns items that belong to the authenticated user.

## Architecture

The application is a web app backed by a JSON HTTP API. Future versions may add
native clients for iOS and Android once the API stabilises.

## Backend

The backend is implemented in Go using the
[chi router](https://github.com/go-chi/chi) and a lightweight middleware stack.
Identity tokens from Google and Apple are validated against their respective
remote JWKS endpoints, and authenticated requests work with an in-memory store
of per-user items.

## Frontend

Static HTML and web components (LIT) compiled into assets under `public/`. The
Go server serves these files directly and falls back to `index.html` to support
client-side routing.

## Development

### Prerequisites

- [Go 1.22+](https://go.dev/dl/)

### Environment variables

Set the following variables before running the server (via `.env`, your shell
profile, or your process manager):

- `PORT` (optional) – HTTP port to bind (default `3000`).
- `GOOGLE_CLIENT_ID` – Google OAuth client ID expected in Google Identity tokens
  (optional, audience will not be enforced if omitted).
- `APPLE_CLIENT_ID` – Apple Services ID expected in Apple identity tokens
  (optional, audience will not be enforced if omitted).
- `PUBLIC_DIR` (optional) – absolute or relative path to the directory containing
  static assets. Defaults to `./public` relative to the working directory.

### Run locally

```bash
go run ./cmd/server
```

The server listens on `http://localhost:PORT` (default `3000`). Press `Ctrl+C`
to stop it.

### Build a binary

```bash
go build -o bin/familychat ./cmd/server
```

This produces a standalone binary at `bin/familychat`.

### Static assets

Everything inside `public/` is served directly. Unmatched `GET` requests fall
back to `public/index.html` so that SPA-style routing continues to work.

### Notes on authentication

Token verification relies on fetching remote JWKS documents from Google and
Apple. Ensure outbound HTTPS traffic is allowed from the runtime environment so
these lookups can succeed.

### Build Notes

A Makefile is provided to provide shortcuts for simple tasks like building the
binary to ensure files are placed in the right place to avoid checking to Git

```bash
make build
make run
make test
make clean
```
