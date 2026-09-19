import { NextResponse } from "next/server";
import { fetchMediaItemFromDatabase } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const item = await fetchMediaItemFromDatabase(id);
  if (!item) return NextResponse.json({ error: "Média introuvable" }, { status: 404 });
  return NextResponse.json({ item });
}
