import { describe, expect, it } from "vitest";
import {
  normalizeDialogIdentifier,
  normalizeStorageMode,
  parseGroupStorageOverrides,
  validateTelegramConnectInput,
} from "./telegram-settings";

describe("telegram settings helpers", () => {
  it("validates Telegram API credentials and phone before connect", () => {
    expect(validateTelegramConnectInput({ apiId: "12345", apiHash: "0123456789abcdef0123456789abcdef", phone: "+33612345678" })).toEqual({
      ok: true,
      apiId: 12345,
      apiHash: "0123456789abcdef0123456789abcdef",
      phone: "+33612345678",
    });

    expect(validateTelegramConnectInput({ apiId: "abc", apiHash: "short", phone: "" })).toMatchObject({
      ok: false,
      errors: expect.arrayContaining(["API ID invalide", "API Hash invalide", "Téléphone requis"]),
    });
  });

  it("normalizes group identifiers from username, t.me URL, and numeric ID", () => {
    expect(normalizeDialogIdentifier("@FilmsHD")).toEqual({ kind: "username", value: "FilmsHD" });
    expect(normalizeDialogIdentifier("https://t.me/books_channel")).toEqual({ kind: "username", value: "books_channel" });
    expect(normalizeDialogIdentifier("-1001234567890")).toEqual({ kind: "id", value: "-1001234567890" });
    expect(() => normalizeDialogIdentifier("not valid space")).toThrow("Identifiant de groupe invalide");
  });

  it("supports links, download, and both globally and per group", () => {
    expect(normalizeStorageMode("links")).toBe("links");
    expect(normalizeStorageMode("download")).toBe("download");
    expect(normalizeStorageMode("both")).toBe("both");
    expect(() => normalizeStorageMode("bad")).toThrow("Mode de stockage invalide");

    expect(parseGroupStorageOverrides("films=download,-1001=both,books=links")).toEqual({
      films: "download",
      "-1001": "both",
      books: "links",
    });
  });
});
