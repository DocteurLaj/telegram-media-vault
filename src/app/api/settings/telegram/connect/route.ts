import { NextResponse } from "next/server";
import { querySettings } from "@/lib/settings-db";
import { validateTelegramConnectInput } from "@/lib/telegram-settings";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const validation = validateTelegramConnectInput(body ?? {});

  if (!validation.ok) {
    await querySettings(
      `insert into telegram_scraper_events(level, event_type, message)
       values ('error', 'telegram_connect_validation', $1)`,
      [validation.errors.join(", ")],
    ).catch(() => null);
    return NextResponse.json({ ok: false, status: "failed", errors: validation.errors }, { status: 400 });
  }

  await querySettings(
    `insert into telegram_accounts(id, api_id, api_hash, phone, status, status_message, updated_at)
     values ('default', $1, $2, $3, 'code_required', 'Identifiants enregistrés. Le worker doit demander le code Telegram.', current_timestamp)
     on conflict(id) do update set
       api_id = excluded.api_id,
       api_hash = excluded.api_hash,
       phone = excluded.phone,
       status = 'code_required',
       session_string = null,
       phone_code_hash = null,
       code_requested_at = null,
       status_message = excluded.status_message,
       updated_at = current_timestamp`,
    [validation.apiId, validation.apiHash, validation.phone],
  );

  await querySettings(
    `insert into telegram_scraper_events(level, event_type, message)
     values ('info', 'telegram_connect_requested', 'Configuration Telegram enregistrée; code requis')`,
  );

  return NextResponse.json({
    ok: true,
    status: "code_required",
    message: "Configuration enregistrée. La prochaine étape demandera le code reçu sur Telegram.",
  });
}
