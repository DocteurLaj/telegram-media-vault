import { NextResponse } from "next/server";
import { validateTelegramPasswordInput } from "@/lib/telegram-login";
import { verifyTelegramPassword } from "@/lib/telegram-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const validation = validateTelegramPasswordInput(body ?? {});
  if (!validation.ok) {
    return NextResponse.json({ ok: false, status: "password_required", error: validation.error }, { status: 400 });
  }

  try {
    const result = await verifyTelegramPassword(validation.password);
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Impossible de vérifier le mot de passe 2FA";
    return NextResponse.json({ ok: false, status: "failed", error: message }, { status: 400 });
  }
}
