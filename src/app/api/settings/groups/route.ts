import { NextResponse } from "next/server";
import { getDefaultStorageMode, querySettings, setDefaultStorageMode, type TelegramGroupRow } from "@/lib/settings-db";
import { normalizeDialogIdentifier, normalizeStorageMode } from "@/lib/telegram-settings";

export async function GET() {
  try {
    const [groups, defaultStorageMode] = await Promise.all([
      querySettings<TelegramGroupRow>(`
        select
          g.id, g.telegram_id, g.title, g.username, g.enabled, g.storage_mode, g.created_at,
          j.status as backfill_status,
          j.requested_limit as backfill_limit,
          j.processed_count as backfill_processed,
          j.imported_count as backfill_imported,
          j.error_message as backfill_error,
          j.created_at as backfill_created_at
        from source_groups g
        left join lateral (
          select * from telegram_backfill_jobs j
          where j.source_group_id = g.id
          order by j.id desc
          limit 1
        ) j on true
        order by g.created_at desc, g.title asc
      `),
      getDefaultStorageMode(),
    ]);

    return NextResponse.json({
      defaultStorageMode,
      groups: groups.rows,
    });
  } catch (error) {
    return NextResponse.json({
      defaultStorageMode: "links",
      groups: [],
      error: error instanceof Error ? error.message : "Erreur PostgreSQL",
    });
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const action = String(body?.action ?? "add_group");

  if (action === "default_storage_mode") {
    const mode = normalizeStorageMode(body?.storageMode);
    await setDefaultStorageMode(mode);
    return NextResponse.json({ ok: true, defaultStorageMode: mode });
  }

  const identifier = normalizeDialogIdentifier(String(body?.identifier ?? ""));
  const storageMode = normalizeStorageMode(body?.storageMode ?? "links");
  const telegramId = identifier.kind === "id" ? identifier.value : `@${identifier.value}`;
  const username = identifier.kind === "username" ? identifier.value : null;
  const title = String(body?.title ?? username ?? telegramId).trim();
  const id = `manual-${telegramId.replace(/[^A-Za-z0-9_-]/g, "")}`;

  const result = await querySettings<TelegramGroupRow>(
    `insert into source_groups(id, telegram_id, title, username, enabled, storage_mode)
     values ($1, $2, $3, $4, true, $5)
     on conflict(id) do update set
       telegram_id = excluded.telegram_id,
       title = excluded.title,
       username = excluded.username,
       enabled = true,
       storage_mode = excluded.storage_mode
     returning id, telegram_id, title, username, enabled, storage_mode, created_at`,
    [id, telegramId, title, username, storageMode],
  );

  await querySettings(
    `insert into telegram_scraper_events(level, event_type, message, source_group_id)
     values ('info', 'group_added', $1, $2)`,
    [`Groupe ajouté manuellement: ${title}`, id],
  );

  return NextResponse.json({ ok: true, group: result.rows[0] });
}
