import bigInt from "big-integer";
import { fetchTelegramMediaRef } from "@/lib/db";
import { getTelegramMessage } from "@/lib/telegram-session";

type Params = { params: Promise<{ id: string }> };

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function filename(title: string, format: string | null) {
  if (!format || title.toLowerCase().endsWith(`.${format.toLowerCase()}`)) return title;
  return `${title}.${format.toLowerCase()}`;
}

function contentTypeFor(format: string | null | undefined) {
  switch ((format || "").toUpperCase()) {
    case "MP4":
    case "M4V":
      return "video/mp4";
    case "WEBM":
      return "video/webm";
    case "MKV":
      return "video/x-matroska";
    case "AVI":
      return "video/x-msvideo";
    case "MOV":
      return "video/quicktime";
    default:
      return "application/octet-stream";
  }
}

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const ref = await fetchTelegramMediaRef(id);
  if (!ref) return Response.json({ error: "Média introuvable" }, { status: 404 });
  if (!ref.sizeBytes) return Response.json({ error: "Taille Telegram inconnue" }, { status: 409 });

  const { client, entity, message } = await getTelegramMessage(ref);
  const chunkSize = 512 * 1024;
  const iterator = client.iterDownload({
    file: message.media,
    offset: bigInt.zero,
    chunkSize,
    requestSize: chunkSize,
    fileSize: bigInt(ref.sizeBytes),
    msgData: [entity, Number(ref.telegramMessageId)],
  });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of iterator as AsyncIterable<Buffer>) controller.enqueue(new Uint8Array(chunk));
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
    async cancel() {
      await iterator.close?.().catch(() => null);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": contentTypeFor(ref.format),
      "content-length": String(ref.sizeBytes),
      "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename(ref.title, ref.format))}`,
      "cache-control": "no-store",
    },
  });
}
