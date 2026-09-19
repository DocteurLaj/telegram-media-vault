export type TelegramCodeValidation =
  | { ok: true; code: string }
  | { ok: false; error: string };

export type TelegramPasswordValidation =
  | { ok: true; password: string }
  | { ok: false; error: string };

export function validateTelegramCodeInput(input: { code?: string | null }): TelegramCodeValidation {
  const code = String(input.code ?? "").replace(/\s+/g, "");
  if (!/^\d{5,8}$/.test(code)) {
    return { ok: false, error: "Code Telegram invalide" };
  }
  return { ok: true, code };
}

export function validateTelegramPasswordInput(input: { password?: string | null }): TelegramPasswordValidation {
  const password = String(input.password ?? "").trim();
  if (!password) return { ok: false, error: "Mot de passe 2FA requis" };
  return { ok: true, password };
}

export function maskPhone(phone: string): string {
  const normalized = phone.replace(/\s+/g, "");
  if (normalized.length <= 4) return "****";
  const head = normalized.startsWith("+") ? normalized.slice(0, 4) : normalized.slice(0, 3);
  return `${head}****${normalized.slice(-4)}`;
}

export function getTelegramErrorMessage(error: unknown): string {
  const candidate = error as { errorMessage?: string; message?: string };
  return candidate.errorMessage ?? candidate.message ?? "Erreur Telegram inconnue";
}

export function isTelegramPasswordRequired(error: unknown): boolean {
  const message = getTelegramErrorMessage(error);
  return message.includes("SESSION_PASSWORD_NEEDED") || message.includes("2FA enabled");
}
