import { spawn } from "node:child_process";
import { Readable } from "node:stream";
import path from "node:path";
import { NextResponse } from "next/server";
import { fetchMediaFilePath } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safePath(filePath: string) {
  const normalized = path.resolve(filePath);
  const allowedRoots = ["/app/storage", "/opt/data/telegram-media-vault/storage"];
  if (!allowedRoots.some((root) => normalized.startsWith(path.resolve(root)))) {
    throw new Error("Chemin fichier interdit");
  }
  return normalized;
}

function canTranscode(format: string | null) {
  const ext = (format || "").toLowerCase();
  return ["avi", "mkv", "mpg", "mpeg", "wmv", "mov", "mp4", "m4v", "webm"].includes(ext);
}

export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  const file = await fetchMediaFilePath(id);
  if (!file) return NextResponse.json({ error: "Fichier local introuvable" }, { status: 404 });
  if (!canTranscode(file.format)) return NextResponse.json({ error: "Format non vidéo" }, { status: 415 });

  let filePath: string;
  try {
    filePath = safePath(file.path);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Chemin invalide" }, { status: 403 });
  }

  const ffmpeg = spawn("ffmpeg", [
    "-hide_banner",
    "-loglevel",
    "error",
    "-i",
    filePath,
    "-map",
    "0:v:0",
    "-map",
    "0:a?",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-tune",
    "zerolatency",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-movflags",
    "frag_keyframe+empty_moov+default_base_moof",
    "-f",
    "mp4",
    "pipe:1",
  ], { stdio: ["ignore", "pipe", "pipe"] });

  request.signal.addEventListener("abort", () => ffmpeg.kill("SIGTERM"), { once: true });

  ffmpeg.stderr.on("data", () => {
    // Keep stderr drained; do not log file paths or Telegram metadata.
  });

  return new Response(Readable.toWeb(ffmpeg.stdout) as ReadableStream, {
    headers: {
      "content-type": "video/mp4",
      "cache-control": "no-store",
      "content-disposition": `inline; filename*=UTF-8''${encodeURIComponent(file.title.replace(/\.[^.]+$/, ".mp4"))}`,
    },
  });
}
