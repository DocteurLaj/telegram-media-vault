import { NextResponse } from "next/server";
import { querySettings } from "@/lib/settings-db";

export async function GET() {
  try {
    const account = await querySettings<{ status: string }>("select status from telegram_accounts where id = 'default'");
    if (account.rows[0]?.status !== "connected") {
      return NextResponse.json({
        ok: false,
        status: account.rows[0]?.status ?? "not_configured",
        dialogs: [],
        message: "Compte Telegram non connecté. Connecte API ID/API Hash puis valide la session Telethon.",
      });
    }

    // The Python worker will populate source_groups from Telethon dialogs once connected.
    const groups = await querySettings(`
      select id, telegram_id, title, username, enabled, storage_mode, created_at
      from source_groups
      order by title asc
    `);
    return NextResponse.json({ ok: true, status: "connected", dialogs: groups.rows });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      status: "failed",
      dialogs: [],
      message: error instanceof Error ? error.message : "Erreur PostgreSQL",
    });
  }
}
