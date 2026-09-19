import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { Api } from "telegram/tl";
import { querySettings } from "@/lib/settings-db";
import { getTelegramErrorMessage, isTelegramPasswordRequired } from "@/lib/telegram-login";

type TelegramAccount = {
  id: string;
  api_id: number;
  api_hash: string;
  phone: string;
  status: string;
  phone_code_hash: string | null;
  session_string: string | null;
};

const CONNECTION_RETRIES = 3;

async function getAccount(): Promise<TelegramAccount> {
  const result = await querySettings<TelegramAccount>("select * from telegram_accounts where id='default'");
  if (!result.rows[0]) throw new Error("Compte Telegram non configuré");
  return result.rows[0];
}

async function saveAccountPatch(fields: Record<string, string | null>) {
  const entries = Object.entries(fields);
  if (!entries.length) return;
  const assignments = entries.map(([key], index) => `${key}=$${index + 1}`).join(", ");
  await querySettings(
    `update telegram_accounts set ${assignments}, updated_at=current_timestamp, last_checked_at=current_timestamp where id='default'`,
    entries.map(([, value]) => value),
  );
}

async function createClient(account: TelegramAccount) {
  const session = new StringSession(account.session_string ?? "");
  const client = new TelegramClient(session, Number(account.api_id), account.api_hash, { connectionRetries: CONNECTION_RETRIES });
  await client.connect();
  return client;
}

function sessionString(client: TelegramClient): string {
  return (client.session as StringSession).save();
}

export async function requestTelegramCode() {
  const account = await getAccount();
  const client = await createClient(account);
  try {
    if (await client.isUserAuthorized()) {
      await saveAccountPatch({ status: "connected", status_message: "Compte Telegram déjà connecté", session_string: sessionString(client) });
      return { ok: true, status: "connected", message: "Compte déjà connecté" };
    }

    const sent = await client.sendCode({ apiId: Number(account.api_id), apiHash: account.api_hash }, account.phone);
    await saveAccountPatch({
      status: "code_required",
      status_message: sent.isCodeViaApp ? "Code envoyé dans Telegram" : "Code envoyé par SMS/Telegram",
      phone_code_hash: sent.phoneCodeHash,
      session_string: sessionString(client),
    });
    return { ok: true, status: "code_required", isCodeViaApp: sent.isCodeViaApp, message: "Code envoyé" };
  } catch (error) {
    const message = getTelegramErrorMessage(error);
    await saveAccountPatch({ status: "failed", status_message: message });
    return { ok: false, status: "failed", error: message };
  } finally {
    await client.disconnect();
  }
}

export async function verifyTelegramCode(code: string) {
  const account = await getAccount();
  if (!account.phone_code_hash) throw new Error("Demande d’envoi de code absente ou expirée");
  const client = await createClient(account);
  try {
    const result = await client.invoke(new Api.auth.SignIn({
      phoneNumber: account.phone,
      phoneCodeHash: account.phone_code_hash,
      phoneCode: code,
    }));

    if (result instanceof Api.auth.AuthorizationSignUpRequired) {
      await saveAccountPatch({ status: "failed", status_message: "Ce numéro doit d’abord être inscrit dans Telegram" });
      return { ok: false, status: "failed", error: "Compte Telegram inexistant" };
    }

    await saveAccountPatch({
      status: "connected",
      status_message: "Compte Telegram connecté",
      session_string: sessionString(client),
      phone_code_hash: null,
    });
    return { ok: true, status: "connected", message: "Compte Telegram connecté" };
  } catch (error) {
    if (isTelegramPasswordRequired(error)) {
      await saveAccountPatch({ status: "password_required", status_message: "Mot de passe 2FA requis", session_string: sessionString(client) });
      return { ok: false, status: "password_required", error: "Mot de passe 2FA requis" };
    }
    const message = getTelegramErrorMessage(error);
    await saveAccountPatch({ status: "code_required", status_message: message });
    return { ok: false, status: "code_required", error: message };
  } finally {
    await client.disconnect();
  }
}

export async function verifyTelegramPassword(password: string) {
  const account = await getAccount();
  const client = await createClient(account);
  try {
    await client.signInWithPassword(
      { apiId: Number(account.api_id), apiHash: account.api_hash },
      { password: async () => password, onError: async () => true },
    );
    await saveAccountPatch({
      status: "connected",
      status_message: "Compte Telegram connecté avec 2FA",
      session_string: sessionString(client),
      phone_code_hash: null,
    });
    return { ok: true, status: "connected", message: "Compte Telegram connecté" };
  } catch (error) {
    const message = getTelegramErrorMessage(error);
    await saveAccountPatch({ status: "password_required", status_message: message });
    return { ok: false, status: "password_required", error: message };
  } finally {
    await client.disconnect();
  }
}
