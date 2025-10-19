export const ITEM_TITLE_MAX_LENGTH = 256;
export const ITEM_DESCRIPTION_MAX_LENGTH = 2048;

export interface Item {
  id: string;
  title: string;
  description?: string;
  updatedAt: string;
}

export interface ItemCreatePayload {
  title: string;
  description?: string | null;
}

export interface ItemUpdatePayload {
  title?: string;
  description?: string | null;
}

export const itemOpenApiSchema = {
  type: "object",
  required: ["id", "title", "updatedAt"],
  properties: {
    id: {
      type: "string",
      format: "uuid",
      description: "Unique item identifier.",
    },
    title: {
      type: "string",
      maxLength: ITEM_TITLE_MAX_LENGTH,
      description: "Short human readable name.",
    },
    description: {
      type: "string",
      nullable: true,
      maxLength: ITEM_DESCRIPTION_MAX_LENGTH,
      description: "Optional longer description.",
    },
    updatedAt: {
      type: "string",
      format: "date-time",
      description: "ISO-8601 timestamp of the last update.",
    },
  },
  additionalProperties: false,
} as const;

export const itemCreateOpenApiSchema = {
  type: "object",
  required: ["title"],
  additionalProperties: false,
  properties: {
    title: {
      type: "string",
      minLength: 1,
      maxLength: ITEM_TITLE_MAX_LENGTH,
      description: "A non-empty title for the item.",
    },
    description: {
      type: ["string", "null"],
      nullable: true,
      maxLength: ITEM_DESCRIPTION_MAX_LENGTH,
      description: "Optional longer description.",
    },
  },
} as const;

export const itemUpdateOpenApiSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: {
      type: "string",
      minLength: 1,
      maxLength: ITEM_TITLE_MAX_LENGTH,
      description: "New title when updating the item.",
    },
    description: {
      type: ["string", "null"],
      nullable: true,
      maxLength: ITEM_DESCRIPTION_MAX_LENGTH,
      description: "Updated description; null clears the field.",
    },
  },
} as const;
