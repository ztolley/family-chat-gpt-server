import { randomUUID } from "node:crypto";

import type { Item } from "../types";

export interface Store {
  list(subject: string): Item[];
  add(subject: string, item: Item): Item;
  update(
    subject: string,
    id: string,
    transform: (item: Item) => Item
  ): Item;
  delete(subject: string, id: string): void;
}

export class NotFoundError extends Error {
  constructor() {
    super("Item not found.");
    this.name = "NotFoundError";
  }
}

export class MemoryStore implements Store {
  private readonly items = new Map<string, Item[]>();

  list(subject: string): Item[] {
    const existing = this.items.get(subject) ?? [];
    return existing.map((item) => ({ ...item }));
  }

  add(subject: string, item: Item): Item {
    const payload = { ...item };
    if (!payload.id) {
      payload.id = randomUUID();
    }
    payload.updatedAt = ensureRFC3339(payload.updatedAt);

    const existing = this.items.get(subject) ?? [];
    this.items.set(subject, [...existing, payload]);
    return { ...payload };
  }

  update(
    subject: string,
    id: string,
    transform: (item: Item) => Item
  ): Item {
    const existing = this.items.get(subject) ?? [];
    const index = existing.findIndex((item) => item.id === id);

    if (index === -1) {
      throw new NotFoundError();
    }

    const updated = ensureRFC3339Item(transform(existing[index]));
    const next = [...existing];
    next[index] = updated;
    this.items.set(subject, next);
    return { ...updated };
  }

  delete(subject: string, id: string): void {
    const existing = this.items.get(subject) ?? [];
    const index = existing.findIndex((item) => item.id === id);
    if (index === -1) {
      throw new NotFoundError();
    }

    const next = [...existing.slice(0, index), ...existing.slice(index + 1)];
    this.items.set(subject, next);
  }
}

function ensureRFC3339(value: string): string {
  if (!value) {
    return new Date().toISOString();
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString();
  }
  return parsed.toISOString();
}

function ensureRFC3339Item(item: Item): Item {
  return {
    ...item,
    updatedAt: ensureRFC3339(item.updatedAt)
  };
}
