import type { NextFunction, Response } from "express";
import type { AuthenticatedRequest } from "../middleware/authMiddleware";

export function prepareItemPayload(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction,
): void {
  req.body = sanitiseItemPayload(req.body);
  next();
}

function sanitiseItemPayload(input: unknown): Record<string, unknown> {
  if (typeof input !== "object" || input === null) {
    return {};
  }

  const payload = { ...(input as Record<string, unknown>) };

  if (typeof payload.title === "string") {
    payload.title = payload.title.trim();
  }

  if (Object.prototype.hasOwnProperty.call(payload, "description")) {
    const value = payload.description;
    if (typeof value === "string") {
      const trimmed = value.trim();
      payload.description = trimmed.length > 0 ? trimmed : null;
    }
  }

  return payload;
}
