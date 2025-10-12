# Family Chat (GPT) – Node Server

Family Chat (GPT) lets each family member sign in with Google and submit their
own GPT prompts while sharing a single OpenAI subscription. Requests carry
metadata so the API only exposes items owned by the authenticated user.

## Architecture

The backend is a TypeScript + Express service that exposes a JSON REST API. The
Google OAuth authorization code flow (with refresh tokens) is terminated on the
server: `/auth/google/token` exchanges authorization codes for tokens, and
`/auth/google/refresh` mints new Google ID tokens from stored refresh tokens.
API routes still accept the Google ID token via the `Authorization` header, and
route handlers remain annotated with `@openapi` JSDoc blocks to enable
machine-generated docs.

## Frontend

The accompanying web client (Lit-based) consumes this API. It is developed in
the neighbouring `family-chat-gpt-web` workspace.

## Development

### Prerequisites

- [Node.js 20+](https://nodejs.org/)
- npm (ships with Node.js)

### Environment variables

- `PORT` (optional) – HTTP port to bind. Defaults to `3000`.
- `GOOGLE_CLIENT_ID` – Google OAuth client ID used for the OAuth flow.
- `GOOGLE_CLIENT_SECRET` – Corresponding client secret (required for the server
  token exchange).
- `GOOGLE_REDIRECT_URI` (optional) – Redirect URI registered for the OAuth
  client. Defaults to `postmessage`, which is supported by Google Identity
  Services.

### Install dependencies

```bash
npm install
```

### Run in development mode

```bash
npm run dev
```

The dev server restarts on source changes and listens on
`http://localhost:PORT` (default `3000`).

### Build for production

```bash
npm run build
```

JavaScript output lands in `dist/`. Start the compiled server with:

```bash
npm run start
```

### Lint

```bash
npm run lint
```

### Authentication notes

Token verification makes outbound HTTPS calls to Google to download and cache
signing keys. Ensure the runtime environment permits egress traffic to Google
APIs.

### API documentation

- `GET /docs` returns the machine-generated OpenAPI 3.1 JSON document, derived
  from inline `@openapi` annotations.
- `GET /docs/ui` serves the same specification through a Redoc-powered UI for a
  human-friendly browsing experience.
