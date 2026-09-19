import { NextResponse } from "next/server";
import { normalizeBackfillLimit } from "@/lib/backfill";
import { querySettings } from "@/lib/settings-db";

type Params = { params: Promise<{ id: string }> };

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const limit = normalizeBackfillLimit(body?.limit);

  const group = await querySettings<{ id: string; title: string }>("select id, title from source_groups where id=$1", [id]);
  if (!group.rows[0]) {
    return NextResponse.json({ ok: false, error: "Groupe introuvable" }, { status: 404 });
  }

  const existing = await querySettings<{ id: number }>(
    "select id from telegram_backfill_jobs where source_group_id=$1 and status in ('queued','running') order by id desc limit 1",
    [id],
  );
  if (existing.rows[0]) {
    return NextResponse.json({ ok: true, queued: true, jobId: existing.rows[0].id, message: "Import historique déjà en attente ou en cours" });
  }

  const job = await querySettings<{ id: number }>(
    `insert into telegram_backfill_jobs(source_group_id, requested_limit, status)
     values ($1, $2, 'queued') returning id`,
    [id, limit],
  );

  await querySettings(
    `insert into telegram_scraper_events(level, event_type, message, source_group_id)
     values ('info', 'backfill_queued', $1, $2)`,
    [`Import historique demandé (${limit} messages): ${group.rows[0].title}`, id],
  );

  return NextResponse.json({ ok: true, queued: true, jobId: job.rows[0].id, limit, message: "Import historique ajouté à la file" });
}
