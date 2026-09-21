import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import path from "node:path";
import { fetchTelegramMediaRef } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safePath(filePath: string) {
  const normalized = path.resolve(filePath);
  const roots = ["/app/storage/thumbnails", "/opt/data/telegram-media-vault/storage/thumbnails"];
  if (!roots.some((root) => normalized.startsWith(path.resolve(root)))) throw new Error("Chemin miniature interdit");
  return normalized;
}

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const ref = await fetchTelegramMediaRef(id);
  if (!ref?.thumbnailPath) return Response.json({ error: "Miniature absente" }, { status: 404 });

  let filePath: string;
  try {
    filePath = safePath(ref.thumbnailPath);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Chemin invalide" }, { status: 403 });
  }

  const info = await stat(filePath).catch(() => null);
  if (!info?.isFile()) return Response.json({ error: "Miniature absente" }, { status: 404 });
  return new Response(Readable.toWeb(createReadStream(filePath)) as ReadableStream, {
    headers: {
      "content-type": "image/jpeg",
      "content-length": String(info.size),
      "cache-control": "public, max-age=3600",
    },
  });
}
