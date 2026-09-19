import { NextResponse } from "next/server";
import { requestTelegramCode } from "@/lib/telegram-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const result = await requestTelegramCode();
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Impossible de demander le code";
    return NextResponse.json({ ok: false, status: "failed", error: message }, { status: 400 });
  }
}
