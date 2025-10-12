import { Router } from "express";

import {
  exchangeAuthorizationCode,
  refreshTokens,
} from "../auth/googleOAuth";

export function createAuthRouter(): Router {
  const router = Router();

  /**
   * @openapi
   * /auth/google/token:
   *   post:
   *     summary: Exchange Google authorization code
   *     description: Exchanges an OAuth 2.0 authorization code for Google ID/refresh tokens.
   *     tags:
   *       - Auth
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               code:
   *                 type: string
   *     responses:
   *       200:
   *         description: Tokens issued successfully.
   *       400:
   *         description: Missing or invalid request payload.
   *       500:
   *         description: Failed to exchange authorization code.
   */
  router.post("/auth/google/token", async (req, res, next) => {
    const { code } = req.body ?? {};
    if (typeof code !== "string" || !code.trim()) {
      res.status(400).json({ error: "Authorization code is required." });
      return;
    }
    try {
      const result = await exchangeAuthorizationCode(code.trim());
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  });

  /**
   * @openapi
   * /auth/google/refresh:
   *   post:
   *     summary: Refresh Google tokens
   *     description: Uses a Google refresh token to obtain a fresh ID token.
   *     tags:
   *       - Auth
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               refreshToken:
   *                 type: string
   *     responses:
   *       200:
   *         description: Tokens refreshed successfully.
   *       400:
   *         description: Missing refresh token.
   *       500:
   *         description: Failed to refresh tokens.
   */
  router.post("/auth/google/refresh", async (req, res, next) => {
    const { refreshToken } = req.body ?? {};
    if (typeof refreshToken !== "string" || !refreshToken.trim()) {
      res.status(400).json({ error: "Refresh token is required." });
      return;
    }
    try {
      const result = await refreshTokens(refreshToken.trim());
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
