import type { Request, Response } from "express";
import { Router } from "express";
import swaggerUi from "swagger-ui-express";

import { openApiSpec } from "../docs/openapi";

export function createDocsRouter(): Router {
  const router = Router();

  router.get("/docs", (_req: Request, res: Response) => {
    res.set("Cache-Control", "public, max-age=600");
    res.status(200).json(openApiSpec);
  });

  const swaggerUiHandler = swaggerUi.setup(openApiSpec, {
    explorer: true,
    customSiteTitle: "Family Chat GPT API Docs",
  });

  router.use("/docs/ui", swaggerUi.serve);
  router.get("/docs/ui", (_req: Request, res: Response, next) => {
    res.set("Cache-Control", "no-store");
    swaggerUiHandler(_req, res, next);
  });

  return router;
}
