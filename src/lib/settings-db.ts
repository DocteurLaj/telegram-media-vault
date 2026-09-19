import { Pool, type QueryResultRow } from "pg";
import type { StorageMode } from "@/lib/media";

let settingsPool: Pool | undefined;

function getPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return null;
  settingsPool ??= new Pool({ connectionString, max: 5 });
  return settingsPool;
}

export async function querySettings<T extends QueryResultRow>(sql: string, params: unknown[] = []) {
  const db = getPool();
  if (!db) throw new Error("DATABASE_URL manquant");
  return db.query<T>(sql, params);
}

export type TelegramAccountStatus = "not_configured" | "code_required" | "password_required" | "connected" | "failed" | "expired";

export type TelegramAccountRow = {
  id: string;
  api_id: number;
  api_hash_set: boolean;
  phone: string;
  status: TelegramAccountStatus;
  status_message: string | null;
  last_checked_at: string | null;
  created_at: string;
  updated_at: string;
};

export type TelegramGroupRow = {
  id: string;
  telegram_id: string;
  title: string;
  username: string | null;
  enabled: boolean;
  storage_mode: StorageMode;
  created_at: string;
  backfill_status?: string | null;
  backfill_limit?: number | null;
  backfill_processed?: number | null;
  backfill_imported?: number | null;
  backfill_error?: string | null;
  backfill_created_at?: string | null;
};

export async function getDefaultStorageMode(): Promise<StorageMode> {
  const result = await querySettings<{ value: StorageMode }>("select value from app_settings where key = 'default_storage_mode'");
  return result.rows[0]?.value ?? "links";
}

export async function setDefaultStorageMode(mode: StorageMode) {
  await querySettings(
    `insert into app_settings(key, value, updated_at) values ('default_storage_mode', $1, current_timestamp)
     on conflict(key) do update set value = excluded.value, updated_at = current_timestamp`,
    [mode],
  );
}
