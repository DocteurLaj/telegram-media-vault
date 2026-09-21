import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { querySettings } from "@/lib/settings-db";
import type { TelegramMediaRef } from "@/lib/db";

type ConnectedAccount = {
  api_id: number;
  api_hash: string;
  session_string: string;
  status: string;
};

let cachedClient: TelegramClient | null = null;
let cachedSession = "";

export async function getTelegramClient() {
  const accountResult = await querySettings<ConnectedAccount>(
    "select api_id, api_hash, session_string, status from telegram_accounts where id='default' limit 1",
  );
  const account = accountResult.rows[0];
  if (!account?.session_string || account.status !== "connected") {
    throw new Error("Compte Telegram non connecté");
  }

  if (cachedClient && cachedSession === account.session_string && await cachedClient.isUserAuthorized().catch(() => false)) {
    return cachedClient;
  }

  cachedSession = account.session_string;
  cachedClient = new TelegramClient(new StringSession(account.session_string), Number(account.api_id), account.api_hash, { connectionRetries: 5 });
  await cachedClient.connect();
  if (!(await cachedClient.isUserAuthorized())) throw new Error("Session Telegram expirée");
  return cachedClient;
}

export async function getTelegramMessage(ref: TelegramMediaRef) {
  const client = await getTelegramClient();
  const entity = ref.sourceUsername ? await client.getEntity(ref.sourceUsername) : await client.getEntity(ref.sourceTelegramId);
  const messages = await client.getMessages(entity, { ids: Number(ref.telegramMessageId) });
  const message = messages[0];
  if (!message?.media) throw new Error("Média Telegram introuvable");
  return { client, entity, message };
}
