import cors from "cors";
import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";
import helmet from "helmet";

import { createAuthMiddleware } from "./middleware/authMiddleware";
import { createAuthRouter } from "./routes/auth";
import { createDocsRouter } from "./routes/docs";
import { createItemsRouter } from "./routes/items";
import { MemoryStore } from "./storage/memoryStore";

const jsonBodyLimit = "1mb";
const isProduction = process.env.NODE_ENV === "production";

const defaultCspDirectives =
  helmet.contentSecurityPolicy.getDefaultDirectives();
const contentSecurityPolicyDirectives = {
  ...defaultCspDirectives,
  "style-src": [
    ...(defaultCspDirectives["style-src"] ?? []),
    "'unsafe-inline'",
  ],
};

export function createApp() {
  const googleClientId = process.env.GOOGLE_CLIENT_ID?.trim() || undefined;
  const port = Number.parseInt(process.env.PORT ?? "", 10) || 3000;

  const store = new MemoryStore();
  const app = express();

  app.set("port", port);

  if (isProduction) {
    app.use(
      helmet({
        contentSecurityPolicy: {
          directives: contentSecurityPolicyDirectives,
        },
      })
    );
  }

  app.use(
    cors({
      origin: "*",
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
    })
  );

  app.use(
    express.json({
      limit: jsonBodyLimit,
    })
  );

  app.use(createDocsRouter());
  app.use(createAuthRouter());

  /**
   * @openapi
   * /health:
   *   get:
   *     summary: Service health check
   *     tags:
   *       - System
   *     responses:
   *       200:
   *         description: Service is healthy.
   */
  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  /**
   * @openapi
   * /config:
   *   get:
   *     summary: Client configuration
   *     tags:
   *       - System
   *     responses:
   *       200:
   *         description: Returns configuration values required by the web client.
   */
  app.get("/config", (_req, res) => {
    res.status(200).json({
      googleClientId: googleClientId ?? null,
    });
  });

  const auth = createAuthMiddleware(googleClientId);
  app.use("/api", auth, createItemsRouter(store));

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err);
    res.status(500).json({ error: err.message || "Internal server error." });
  });

  return app;
}
