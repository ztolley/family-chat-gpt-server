import { randomUUID } from "node:crypto";
import type { Response } from "express";
import { Router } from "express";

import type { AuthenticatedRequest } from "../middleware/authMiddleware";
import type { Store } from "../storage/memoryStore";
import { NotFoundError } from "../storage/memoryStore";
import {
  itemCreateOpenApiSchema,
  itemUpdateOpenApiSchema,
  type Item,
  type ItemCreatePayload,
  type ItemUpdatePayload,
} from "../types";
import { validateRequest } from "../validation/jsonSchemaValidator";
import { prepareItemPayload } from "../validation/prepareItemPayload";

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
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/Item'
   */
  router.get(
    "/items",
    (
      req: AuthenticatedRequest,
      res: Response<Item[] | { error: string }>,
      next,
    ) => {
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
    },
  );

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
   *             $ref: '#/components/schemas/ItemCreate'
   *     responses:
   *       201:
   *         description: Item created.
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Item'
   *       400:
   *         description: Invalid payload.
   */
  router.post(
    "/items",
    prepareItemPayload,
    validateRequest(itemCreateOpenApiSchema),
    (
      req: AuthenticatedRequest,
      res: Response<Item | { error: string }>,
      next,
    ) => {
      const identity = req.identity;
      if (!identity) {
        res.status(500).json({ error: "Authentication context missing." });
        return;
      }

      const payload = req.body as ItemCreatePayload;

      const item: Item = {
        id: randomUUID(),
        title: payload.title,
        description: payload.description ?? undefined,
        updatedAt: timestampNow(),
      };

      try {
        const created = store.add(identity.subject, item);
        res.status(201).json(created);
      } catch (error) {
        next(error);
      }
    },
  );

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
   *             $ref: '#/components/schemas/ItemUpdate'
   *     responses:
   *       200:
   *         description: Item updated.
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Item'
   *       400:
   *         description: Invalid payload.
   *       404:
   *         description: Item not found.
   */
  router.put(
    "/items/:id",
    prepareItemPayload,
    validateRequest(itemUpdateOpenApiSchema),
    (
      req: AuthenticatedRequest,
      res: Response<Item | { error: string }>,
      next,
    ) => {
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

      const payload = req.body as ItemUpdatePayload;

      try {
        const updated = store.update(identity.subject, itemId, (item) =>
          applyItemPatch(item, payload),
        );

        res.status(200).json(updated);
      } catch (error) {
        if (error instanceof NotFoundError) {
          res.status(404).json({ error: "Item not found." });
          return;
        }
        next(error);
      }
    },
  );

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
    },
  );

  return router;
}

function timestampNow(): string {
  return new Date().toISOString();
}

function applyItemPatch(item: Item, patch: ItemUpdatePayload): Item {
  return {
    ...item,
    ...(patch.title !== undefined ? { title: patch.title } : null),
    ...(patch.description !== undefined
      ? { description: patch.description ?? undefined }
      : null),
    updatedAt: timestampNow(),
  };
}
