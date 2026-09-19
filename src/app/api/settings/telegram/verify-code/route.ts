import { NextResponse } from "next/server";
import { validateTelegramCodeInput } from "@/lib/telegram-login";
import { verifyTelegramCode } from "@/lib/telegram-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const validation = validateTelegramCodeInput(body ?? {});
  if (!validation.ok) {
    return NextResponse.json({ ok: false, status: "code_required", error: validation.error }, { status: 400 });
  }

  try {
    const result = await verifyTelegramCode(validation.code);
    return NextResponse.json(result, { status: result.ok || result.status === "password_required" ? 200 : 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Impossible de vérifier le code";
    return NextResponse.json({ ok: false, status: "failed", error: message }, { status: 400 });
  }
}
