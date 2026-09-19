import { NextResponse } from "next/server";
import { querySettings } from "@/lib/settings-db";
import { normalizeStorageMode } from "@/lib/telegram-settings";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const fields: string[] = [];
  const values: unknown[] = [];

  if (typeof body?.enabled === "boolean") {
    values.push(body.enabled);
    fields.push(`enabled = $${values.length}`);
  }
  if (body?.storageMode) {
    values.push(normalizeStorageMode(body.storageMode));
    fields.push(`storage_mode = $${values.length}`);
  }
  if (body?.title) {
    values.push(String(body.title).trim());
    fields.push(`title = $${values.length}`);
  }

  if (!fields.length) return NextResponse.json({ ok: false, error: "Aucun changement" }, { status: 400 });

  values.push(id);
  const result = await querySettings(
    `update source_groups set ${fields.join(", ")} where id = $${values.length}
     returning id, telegram_id, title, username, enabled, storage_mode, created_at`,
    values,
  );

  return NextResponse.json({ ok: true, group: result.rows[0] ?? null });
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  await querySettings("delete from source_groups where id = $1", [id]);
  return NextResponse.json({ ok: true });
}
