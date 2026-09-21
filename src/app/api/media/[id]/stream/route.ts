import bigInt from "big-integer";
import { fetchTelegramMediaRef } from "@/lib/db";
import { parseByteRange } from "@/lib/http-range";
import { getTelegramMessage } from "@/lib/telegram-session";

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

function contentType(format: string | null) {
  return mimeByExt[(format || "").toLowerCase()] || "application/octet-stream";
}

function filename(title: string, format: string | null) {
  if (!format || title.toLowerCase().endsWith(`.${format.toLowerCase()}`)) return title;
  return `${title}.${format.toLowerCase()}`;
}

export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  const ref = await fetchTelegramMediaRef(id);
  if (!ref) return Response.json({ error: "Média introuvable" }, { status: 404 });
  if (!ref.sizeBytes) return Response.json({ error: "Taille Telegram inconnue, streaming impossible" }, { status: 409 });

  const range = parseByteRange(request.headers.get("range"), Number(ref.sizeBytes));
  if (!range) return new Response(null, { status: 416, headers: { "content-range": `bytes */${ref.sizeBytes}` } });

  const { client, entity, message } = await getTelegramMessage(ref);
  const length = range.end - range.start + 1;
  const chunkSize = 512 * 1024;
  const limit = Math.ceil(length / chunkSize);
  const iterator = client.iterDownload({
    file: message.media,
    offset: bigInt(range.start),
    limit,
    chunkSize,
    requestSize: chunkSize,
    fileSize: bigInt(ref.sizeBytes),
    msgData: [entity, Number(ref.telegramMessageId)],
  });

  let sent = 0;
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of iterator as AsyncIterable<Buffer>) {
          if (sent >= length) break;
          const remaining = length - sent;
          const slice = chunk.length > remaining ? chunk.subarray(0, remaining) : chunk;
          sent += slice.length;
          controller.enqueue(new Uint8Array(slice));
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
    async cancel() {
      await iterator.close?.().catch(() => null);
    },
  });

  const headers = new Headers({
    "accept-ranges": "bytes",
    "content-type": contentType(ref.format),
    "content-length": String(length),
    "content-disposition": `inline; filename*=UTF-8''${encodeURIComponent(filename(ref.title, ref.format))}`,
    "cache-control": "no-store",
  });

  if (range.partial) {
    headers.set("content-range", `bytes ${range.start}-${range.end}/${ref.sizeBytes}`);
    return new Response(stream, { status: 206, headers });
  }

  return new Response(stream, { headers });
}
