import type { NextFunction, Request, Response } from "express";
import { OAuth2Client } from "google-auth-library";

import type { TokenIdentity } from "../types";

export interface AuthenticatedRequest extends Request {
  identity?: TokenIdentity;
}

export function createAuthMiddleware(googleClientId?: string) {
  const client = new OAuth2Client();

  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    const header = req.header("Authorization");
    if (!header || !header.toLowerCase().startsWith("bearer ")) {
      res.status(401).json({ error: "Missing bearer token." });
      return;
    }

    const token = header.slice("bearer ".length).trim();
    if (!token) {
      res.status(401).json({ error: "Missing bearer token." });
      return;
    }

    try {
      const ticket = await client.verifyIdToken({
        idToken: token,
        audience: googleClientId ? googleClientId.trim() || undefined : undefined,
      });
      const payload = ticket.getPayload();
      if (!payload?.sub) {
        res.status(401).json({ error: "Token payload missing subject." });
        return;
      }

      const identity: TokenIdentity = {
        provider: "google",
        subject: payload.sub,
      };

      const email =
        typeof payload.email === "string" ? payload.email.trim() : "";
      if (email) {
        identity.email = email;
      }

      const name = typeof payload.name === "string" ? payload.name.trim() : "";
      if (name) {
        identity.name = name;
      }

      req.identity = identity;
      next();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error ?? "");
      if (
        googleClientId &&
        message.toLowerCase().includes("audience") &&
        message.toLowerCase().includes("does not match")
      ) {
        res
          .status(401)
          .json({ error: "Token audience does not match the configured client id." });
        return;
      }
      res.status(401).json({ error: "Failed to validate token." });
    }
  };
}
