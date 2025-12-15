import { describe, it, expect } from "vitest";
import { deepMerge } from "./deep-merge";

describe("deepMerge", () => {
  it("should merge flat objects", () => {
    const target = { a: "1", b: "2" };
    const source = { b: "3", c: "4" };

    const result = deepMerge(target, source);

    expect(result).toEqual({ a: "1", b: "3", c: "4" });
  });

  it("should deep merge nested objects", () => {
    const target = {
      common: { save: "Save", cancel: "Cancel" },
      dashboard: { title: "Dashboard" },
    };
    const source = {
      common: { save: "Sauvegarder" },
    };

    const result = deepMerge(target, source);

    expect(result).toEqual({
      common: { save: "Sauvegarder", cancel: "Cancel" },
      dashboard: { title: "Dashboard" },
    });
  });

  it("should handle deeply nested structures", () => {
    const target = {
      level1: {
        level2: {
          level3: { a: "1", b: "2" },
        },
      },
    };
    const source = {
      level1: {
        level2: {
          level3: { b: "3" },
        },
      },
    };

    const result = deepMerge(target, source);

    expect(result).toEqual({
      level1: {
        level2: {
          level3: { a: "1", b: "3" },
        },
      },
    });
  });

  it("should not merge arrays (replace instead)", () => {
    const target = { items: [1, 2, 3] };
    const source = { items: [4, 5] };

    const result = deepMerge(target, source);

    expect(result).toEqual({ items: [4, 5] });
  });

  it("should handle empty source", () => {
    const target = { a: "1", b: "2" };
    const source = {};

    const result = deepMerge(target, source);

    expect(result).toEqual({ a: "1", b: "2" });
  });

  it("should handle empty target", () => {
    const target = {};
    const source = { a: "1" };

    const result = deepMerge(target, source);

    expect(result).toEqual({ a: "1" });
  });

  it("should not mutate original objects", () => {
    const target = { a: "1", nested: { b: "2" } };
    const source = { nested: { b: "3" } };

    deepMerge(target, source);

    expect(target).toEqual({ a: "1", nested: { b: "2" } });
    expect(source).toEqual({ nested: { b: "3" } });
  });

  it("should ignore undefined values in source", () => {
    const target = { a: "1", b: "2" };
    const source = { a: undefined, c: "3" };

    const result = deepMerge(target, source);

    expect(result).toEqual({ a: "1", b: "2", c: "3" });
  });

  it("should ignore null values in source (treat as missing for i18n)", () => {
    const target = { a: "1", b: "2" };
    const source = { a: null, c: "3" } as unknown as Partial<typeof target>;

    const result = deepMerge(target, source);

    expect(result).toEqual({ a: "1", b: "2", c: "3" });
  });

  it("should preserve TypeScript types", () => {
    type Messages = { common: { save: string; cancel: string } };
    const target: Messages = { common: { save: "Save", cancel: "Cancel" } };
    const source: Partial<Messages> = { common: { save: "Sauvegarder" } };

    const result: Messages = deepMerge(target, source);

    expect(result.common.save).toBe("Sauvegarder");
    expect(result.common.cancel).toBe("Cancel");
  });

  it("should simulate i18n fallback scenario", () => {
    const englishMessages = {
      common: {
        save: "Save",
        cancel: "Cancel",
        delete: "Delete",
      },
      dashboard: {
        title: "Dashboard",
        subtitle: "Overview of your inventory",
      },
      items: {
        title: "Items",
        addItem: "Add Item",
      },
    };

    const frenchMessages = {
      common: {
        save: "Sauvegarder",
        cancel: "Annuler",
      },
      dashboard: {
        title: "Tableau de bord",
      },
    };

    const result = deepMerge(englishMessages, frenchMessages);

    expect(result).toEqual({
      common: {
        save: "Sauvegarder",
        cancel: "Annuler",
        delete: "Delete",
      },
      dashboard: {
        title: "Tableau de bord",
        subtitle: "Overview of your inventory",
      },
      items: {
        title: "Items",
        addItem: "Add Item",
      },
    });
  });
});
