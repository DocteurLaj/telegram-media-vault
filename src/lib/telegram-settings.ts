import type { StorageMode } from "@/lib/media";

export type TelegramConnectInput = {
  apiId?: string | number | null;
  apiHash?: string | null;
  phone?: string | null;
};

export type TelegramConnectValidation =
  | { ok: true; apiId: number; apiHash: string; phone: string }
  | { ok: false; errors: string[] };

export type DialogIdentifier =
  | { kind: "username"; value: string }
  | { kind: "id"; value: string };

const STORAGE_MODES = new Set<StorageMode>(["links", "download", "both"]);

export function normalizeStorageMode(value: unknown): StorageMode {
  const mode = String(value ?? "").trim().toLowerCase();
  if (!STORAGE_MODES.has(mode as StorageMode)) {
    throw new Error("Mode de stockage invalide");
  }
  return mode as StorageMode;
}

export function validateTelegramConnectInput(input: TelegramConnectInput): TelegramConnectValidation {
  const errors: string[] = [];
  const apiId = Number(input.apiId);
  const apiHash = String(input.apiHash ?? "").trim();
  const phone = String(input.phone ?? "").trim();

  if (!Number.isInteger(apiId) || apiId <= 0) errors.push("API ID invalide");
  if (!/^[a-fA-F0-9]{32}$/.test(apiHash)) errors.push("API Hash invalide");
  if (!phone) errors.push("Téléphone requis");
  if (phone && !/^\+?[0-9][0-9\s().-]{5,}$/.test(phone)) errors.push("Téléphone invalide");

  if (errors.length) return { ok: false, errors };
  return { ok: true, apiId, apiHash: apiHash.toLowerCase(), phone };
}

export function normalizeDialogIdentifier(raw: string): DialogIdentifier {
  const value = raw.trim();
  if (!value) throw new Error("Identifiant de groupe invalide");

  const urlMatch = value.match(/^https?:\/\/(?:www\.)?t\.me\/([A-Za-z0-9_]{5,})\/?$/);
  if (urlMatch?.[1]) {
    return { kind: "username", value: urlMatch[1] };
  }

  const username = value.replace(/^@/, "");
  if (/^[A-Za-z0-9_]{5,}$/.test(username)) {
    return { kind: "username", value: username };
  }

  if (/^-?\d{5,}$/.test(value)) {
    return { kind: "id", value };
  }

  throw new Error("Identifiant de groupe invalide");
}

export function parseGroupStorageOverrides(raw: string): Record<string, StorageMode> {
  const overrides: Record<string, StorageMode> = {};
  for (const part of raw.split(",").map((item) => item.trim()).filter(Boolean)) {
    const [group, mode, ...extra] = part.split("=");
    if (!group || !mode || extra.length) throw new Error("Format override invalide");
    overrides[group.trim()] = normalizeStorageMode(mode);
  }
  return overrides;
}
