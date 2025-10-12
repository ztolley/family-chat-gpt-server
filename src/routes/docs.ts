import path from "node:path";
import { fileURLToPath } from "node:url";

import type { Request, Response } from "express";
import { Router } from "express";

import { openApiSpec } from "../docs/openapi";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const redocBundlePath = path.resolve(
  __dirname,
  "../../node_modules/redoc/bundles/redoc.standalone.js"
);

export function createDocsRouter(): Router {
  const router = Router();

  router.get("/docs", (_req: Request, res: Response) => {
    res.set("Cache-Control", "public, max-age=600");
    res.status(200).json(openApiSpec);
  });

  router.get("/docs/redoc.standalone.js", (_req: Request, res: Response, next) => {
    res.set("Cache-Control", "public, max-age=86400");
    res.sendFile(redocBundlePath, (err) => {
      if (err) {
        next(err);
      }
    });
  });

  router.get("/docs/ui", (req: Request, res: Response) => {
    res.set("Content-Type", "text/html; charset=utf-8");
    res.set("Cache-Control", "no-store");
    res.send(renderRedocHtml("/docs", "/docs/redoc.standalone.js"));
  });

  return router;
}

function renderRedocHtml(specUrl: string, scriptUrl: string): string {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Family Chat GPT API Docs</title>
    <link rel="icon" href="data:,">
    <style>
      body { margin: 0; padding: 0; font-family: sans-serif; background: #fafafa; }
      .container { height: 100vh; }
    </style>
  </head>
  <body>
    <div class="container">
      <redoc spec-url="${specUrl}"></redoc>
    </div>
    <script src="${scriptUrl}"></script>
  </body>
</html>`;
}
