import type { NextFunction, Request, RequestHandler, Response } from "express";
import Ajv, { type ErrorObject } from "ajv";
import addFormats from "ajv-formats";

type ValidationTargets = "body" | "query" | "params";

const ajv = new Ajv({
  allErrors: true,
  removeAdditional: "failing",
  strict: false,
});

addFormats(ajv);

interface ValidationErrorDetail {
  message: string;
  path: string;
}

export function validateRequest(
  schema: Record<string, unknown>,
  target: ValidationTargets = "body"
): RequestHandler {
  const validator = ajv.compile(schema);

  return (req: Request, res: Response, next: NextFunction) => {
    const data = (req as Record<ValidationTargets, unknown>)[target];

    if (validator(data)) {
      next();
      return;
    }

    const details = (validator.errors ?? []).map(formatValidationError);

    res.status(400).json({
      error: "Invalid request payload.",
      details,
    });
  };
}

function formatValidationError(error: ErrorObject): ValidationErrorDetail {
  const jsonPointer = error.instancePath || "";
  const missingProperty =
    error.keyword === "required" && typeof error.params.missingProperty === "string"
      ? `/${error.params.missingProperty}`
      : "";

  const path = jsonPointer || missingProperty;

  return {
    message: error.message ?? "Invalid value.",
    path,
  };
}
