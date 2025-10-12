import { OAuth2Client } from "google-auth-library";

import type { TokenIdentity } from "../types";

const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
const redirectUri = process.env.GOOGLE_REDIRECT_URI?.trim() || "postmessage";

if (!clientId) {
  throw new Error("GOOGLE_CLIENT_ID must be configured for OAuth exchanges.");
}
if (!clientSecret) {
  throw new Error("GOOGLE_CLIENT_SECRET must be configured for OAuth exchanges.");
}

function createOAuthClient(): OAuth2Client {
  return new OAuth2Client(clientId, clientSecret, redirectUri);
}

async function buildIdentityFromIdToken(idToken: string): Promise<TokenIdentity> {
  const client = createOAuthClient();
  const ticket = await client.verifyIdToken({
    idToken,
    audience: clientId,
  });
  const payload = ticket.getPayload();
  if (!payload || !payload.sub) {
    throw new Error("Token payload missing subject.");
  }
  const identity: TokenIdentity = {
    provider: "google",
    subject: payload.sub,
  };
  if (payload.email) {
    identity.email = payload.email;
  }
  if (payload.name) {
    identity.name = payload.name;
  }
  return identity;
}

export async function exchangeAuthorizationCode(code: string) {
  const client = createOAuthClient();
  const { tokens } = await client.getToken({
    code,
    redirect_uri: redirectUri,
  });
  if (!tokens.id_token) {
    throw new Error("Google response missing id_token.");
  }
  const identity = await buildIdentityFromIdToken(tokens.id_token);
  return {
    idToken: tokens.id_token,
    accessToken: tokens.access_token ?? null,
    refreshToken: tokens.refresh_token ?? null,
    identity,
  };
}

export async function refreshTokens(refreshToken: string) {
  const client = createOAuthClient();
  client.setCredentials({ refresh_token: refreshToken });
  const { credentials } = await client.refreshAccessToken();
  if (!credentials.id_token) {
    throw new Error("Google response missing id_token.");
  }
  const identity = await buildIdentityFromIdToken(credentials.id_token);
  return {
    idToken: credentials.id_token,
    accessToken: credentials.access_token ?? null,
    // Google typically does not rotate refresh tokens during refresh. Preserve the original.
    identity,
  };
}
