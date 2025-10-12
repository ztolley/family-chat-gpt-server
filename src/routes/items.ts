import { randomUUID } from "node:crypto";
import type { Response } from "express";
import { Router } from "express";

import type { AuthenticatedRequest } from "../middleware/authMiddleware";
import type { Store } from "../storage/memoryStore";
import { NotFoundError } from "../storage/memoryStore";
import type { Item } from "../types";

interface ItemPayload {
  title?: unknown;
  description?: unknown;
}

const MAX_TITLE_LENGTH = 256;
const MAX_DESCRIPTION_LENGTH = 2048;

export function createItemsRouter(store: Store): Router {
  const router = Router();

  /**
   * @openapi
   * /api/items:
   *   get:
   *     summary: List items
   *     description: Returns all items that belong to the authenticated user.
   *     tags:
   *       - Items
   *     responses:
   *       200:
   *         description: A list of items.
   */
  router.get("/items", (req: AuthenticatedRequest, res, next) => {
    const identity = req.identity;
    if (!identity) {
      res.status(500).json({ error: "Authentication context missing." });
      return;
    }

    try {
      const items = store.list(identity.subject);
      res.status(200).json(items);
    } catch (error) {
      next(error);
    }
  });

  /**
   * @openapi
   * /api/items:
   *   post:
   *     summary: Create item
   *     description: Creates a new item owned by the authenticated user.
   *     tags:
   *       - Items
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               title:
   *                 type: string
   *               description:
   *                 type: string
   *     responses:
   *       201:
   *         description: Item created.
   *       400:
   *         description: Invalid payload.
   */
  router.post("/items", (req: AuthenticatedRequest, res: Response, next) => {
    const identity = req.identity;
    if (!identity) {
      res.status(500).json({ error: "Authentication context missing." });
      return;
    }

    const { title, description } = normalisePayload(req.body as ItemPayload);
    if (!title.valid) {
      res.status(400).json({ error: title.message });
      return;
    }

    if (!description.valid) {
      res.status(400).json({ error: description.message });
      return;
    }

    const titleValue = title.value;
    if (typeof titleValue !== "string") {
      res.status(400).json({ error: "A non-empty title is required." });
      return;
    }

    const descriptionValue =
      description.value === undefined ? null : description.value;

    const item: Item = {
      id: randomUUID(),
      title: titleValue,
      description: descriptionValue ?? undefined,
      updatedAt: timestampNow()
    };

    try {
      const created = store.add(identity.subject, item);
      res.status(201).json(created);
    } catch (error) {
      next(error);
    }
  });

  /**
   * @openapi
   * /api/items/{id}:
   *   put:
   *     summary: Update item
   *     description: Updates an existing item owned by the authenticated user.
   *     tags:
   *       - Items
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               title:
   *                 type: string
   *               description:
   *                 type: string
   *     responses:
   *       200:
   *         description: Item updated.
   *       400:
   *         description: Invalid payload.
   *       404:
   *         description: Item not found.
   */
  router.put("/items/:id", (req: AuthenticatedRequest, res: Response, next) => {
    const identity = req.identity;
    if (!identity) {
      res.status(500).json({ error: "Authentication context missing." });
      return;
    }

    const itemId = String(req.params.id ?? "").trim();
    if (!itemId) {
      res.status(400).json({ error: "Item id is required." });
      return;
    }

    const { title, description } = normalisePayload(req.body as ItemPayload, {
      allowPartial: true
    });

    if (!title.valid) {
      res.status(400).json({ error: title.message });
      return;
    }

    if (!description.valid) {
      res.status(400).json({ error: description.message });
      return;
    }

    try {
      const updated = store.update(identity.subject, itemId, (item) => {
        const nextItem = { ...item };
        if (title.present && typeof title.value === "string") {
          nextItem.title = title.value;
        }
        if (description.present) {
          nextItem.description = description.value ?? undefined;
        }
        nextItem.updatedAt = timestampNow();
        return nextItem;
      });
      res.status(200).json(updated);
    } catch (error) {
      if (error instanceof NotFoundError) {
        res.status(404).json({ error: "Item not found." });
        return;
      }
      next(error);
    }
  });

  /**
   * @openapi
   * /api/items/{id}:
   *   delete:
   *     summary: Delete item
   *     description: Removes an item owned by the authenticated user.
   *     tags:
   *       - Items
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       204:
   *         description: Item deleted.
   *       404:
   *         description: Item not found.
   */
  router.delete(
    "/items/:id",
    (req: AuthenticatedRequest, res: Response, next) => {
      const identity = req.identity;
      if (!identity) {
        res.status(500).json({ error: "Authentication context missing." });
        return;
      }

      const itemId = String(req.params.id ?? "").trim();
      if (!itemId) {
        res.status(400).json({ error: "Item id is required." });
        return;
      }

      try {
        store.delete(identity.subject, itemId);
        res.status(204).send();
      } catch (error) {
        if (error instanceof NotFoundError) {
          res.status(404).json({ error: "Item not found." });
          return;
        }
        next(error);
      }
    }
  );

  return router;
}

interface TitleResult {
  valid: boolean;
  value?: string;
  present: boolean;
  message?: string;
}

interface DescriptionResult {
  valid: boolean;
  value?: string | null;
  present: boolean;
  message?: string;
}

function normalisePayload(
  payload: ItemPayload,
  options: { allowPartial?: boolean } = {}
): {
  title: TitleResult;
  description: DescriptionResult;
} {
  const { allowPartial = false } = options;

  const rawTitle = payload?.title;
  const rawDescription = payload?.description;

  if (!allowPartial && typeof rawTitle !== "string") {
    return {
      title: {
        valid: false,
        message: "A non-empty title is required.",
        present: true
      },
      description: { valid: true, value: null, present: false }
    };
  }

  const titleResult = validateTitle(rawTitle, allowPartial);
  const descriptionResult = validateDescription(rawDescription, allowPartial);

  return {
    title: titleResult,
    description: descriptionResult
  };
}

function validateTitle(value: unknown, allowPartial: boolean): TitleResult {
  if (value === undefined && allowPartial) {
    return { valid: true, value: undefined, present: false };
  }

  if (typeof value !== "string") {
    return {
      valid: false,
      present: true,
      message: allowPartial
        ? "Title must be a string when provided."
        : "A non-empty title is required."
    };
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return {
      valid: false,
      present: true,
      message: allowPartial
        ? "Title must be a string when provided."
        : "A non-empty title is required."
    };
  }

  if (trimmed.length > MAX_TITLE_LENGTH) {
    return {
      valid: false,
      present: true,
      message: `Title must be ${MAX_TITLE_LENGTH} characters or fewer.`
    };
  }

  return { valid: true, value: trimmed, present: true };
}

function validateDescription(
  value: unknown,
  allowPartial: boolean
): DescriptionResult {
  if (value === undefined && allowPartial) {
    return { valid: true, value: undefined, present: false };
  }

  if (value === null) {
    return { valid: true, value: null, present: true };
  }

  if (typeof value !== "string") {
    return {
      valid: false,
      present: true,
      message: "Description must be a string when provided."
    };
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return { valid: true, value: null, present: true };
  }

  if (trimmed.length > MAX_DESCRIPTION_LENGTH) {
    return {
      valid: false,
      present: true,
      message: `Description must be ${MAX_DESCRIPTION_LENGTH} characters or fewer.`
    };
  }

  return { valid: true, value: trimmed, present: true };
}

function timestampNow(): string {
  return new Date().toISOString();
}
