import { NextResponse } from "next/server";
import { querySettings, type TelegramAccountRow } from "@/lib/settings-db";

export async function GET() {
  try {
    const result = await querySettings<TelegramAccountRow>(`
      select id, api_id, true as api_hash_set, phone, status, status_message, last_checked_at, created_at, updated_at
      from telegram_accounts
      where id = 'default'
    `);

    if (!result.rows[0]) {
      return NextResponse.json({ status: "not_configured", connected: false });
    }

    const account = result.rows[0];
    return NextResponse.json({
      ...account,
      connected: account.status === "connected",
    });
  } catch (error) {
    return NextResponse.json({
      status: "failed",
      connected: false,
      status_message: error instanceof Error ? error.message : "Erreur PostgreSQL",
    });
  }
}
