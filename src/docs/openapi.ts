import path from "node:path";
import { fileURLToPath } from "node:url";

import swaggerJSDoc from "swagger-jsdoc";

import {
  itemCreateOpenApiSchema,
  itemOpenApiSchema,
  itemUpdateOpenApiSchema,
} from "../types";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const apiFiles = [
  path.resolve(__dirname, "../routes/**/*.ts"),
  path.resolve(__dirname, "../app.ts"),
];

export const openApiSpec = swaggerJSDoc({
  definition: {
    openapi: "3.1.0",
    info: {
      title: "Family Chat GPT API",
      version: "1.0.0",
      description:
        "REST API for Family Chat GPT. Generated from inline @openapi annotations.",
    },
    components: {
      schemas: {
        Item: itemOpenApiSchema,
        ItemCreate: itemCreateOpenApiSchema,
        ItemUpdate: itemUpdateOpenApiSchema,
      },
    },
  },
  apis: apiFiles,
});
