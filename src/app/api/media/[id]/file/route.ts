import { Readable } from "node:stream";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { fetchMediaFilePath } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const mimeByExt: Record<string, string> = {
  mp4: "video/mp4",
  m4v: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  mkv: "video/x-matroska",
  avi: "video/x-msvideo",
  pdf: "application/pdf",
  epub: "application/epub+zip",
  cbz: "application/vnd.comicbook+zip",
  zip: "application/zip",
};

function safePath(filePath: string) {
  const normalized = path.resolve(filePath);
  const allowedRoots = ["/app/storage", "/opt/data/telegram-media-vault/storage"];
  if (!allowedRoots.some((root) => normalized.startsWith(path.resolve(root)))) {
    throw new Error("Chemin fichier interdit");
  }
  return normalized;
}

function contentType(filePath: string, format: string | null) {
  const ext = (format || path.extname(filePath).slice(1)).toLowerCase();
  return mimeByExt[ext] || "application/octet-stream";
}

export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  const file = await fetchMediaFilePath(id);
  if (!file) return NextResponse.json({ error: "Fichier local introuvable" }, { status: 404 });

  let filePath: string;
  try {
    filePath = safePath(file.path);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Chemin invalide" }, { status: 403 });
  }

  const fileStat = await stat(filePath).catch(() => null);
  if (!fileStat?.isFile()) return NextResponse.json({ error: "Fichier absent sur le VPS" }, { status: 404 });

  const range = request.headers.get("range");
  const url = new URL(request.url);
  const download = url.searchParams.get("download") === "1";
  const headers = new Headers({
    "accept-ranges": "bytes",
    "content-type": contentType(filePath, file.format),
    "content-disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(file.title)}`,
  });

  if (range) {
    const match = range.match(/bytes=(\d+)-(\d*)/);
    const start = match ? Number(match[1]) : 0;
    const end = match?.[2] ? Number(match[2]) : fileStat.size - 1;
    if (start >= fileStat.size || end >= fileStat.size) {
      return new Response(null, { status: 416, headers: { "content-range": `bytes */${fileStat.size}` } });
    }
    headers.set("content-range", `bytes ${start}-${end}/${fileStat.size}`);
    headers.set("content-length", String(end - start + 1));
    return new Response(Readable.toWeb(createReadStream(filePath, { start, end })) as ReadableStream, { status: 206, headers });
  }

  headers.set("content-length", String(fileStat.size));
  return new Response(Readable.toWeb(createReadStream(filePath)) as ReadableStream, { headers });
}
