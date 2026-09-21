/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs/promises");
const path = require("node:path");
const { Pool } = require("pg");
const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const { NewMessage } = require("telegram/events");

const DATABASE_URL = process.env.DATABASE_URL;
const DOWNLOAD_DIR = process.env.SCRAPER_DOWNLOAD_DIR || "/app/storage/downloads";
const THUMBNAIL_DIR = process.env.SCRAPER_THUMBNAIL_DIR || "/app/storage/thumbnails";
const DISABLE_MEDIA_DOWNLOADS = process.env.SCRAPER_DISABLE_MEDIA_DOWNLOADS !== "false";
const POLL_GROUPS_MS = Number(process.env.SCRAPER_POLL_GROUPS_MS || 60000);
const POLL_BACKFILL_MS = Number(process.env.SCRAPER_POLL_BACKFILL_MS || 15000);

if (!DATABASE_URL) {
  throw new Error("DATABASE_URL manquant");
}

const pool = new Pool({ connectionString: DATABASE_URL });
let client;
let activeGroups = new Map();
let defaultStorageMode = "links";
let backfillRunning = false;

async function query(sql, params = []) {
  return pool.query(sql, params);
}

async function event(level, eventType, message, sourceGroupId = null) {
  await query(
    "insert into telegram_scraper_events(level, event_type, message, source_group_id) values ($1,$2,$3,$4)",
    [level, eventType, message, sourceGroupId],
  ).catch((error) => console.error("event_error", error.message));
}

function classify(title, text = "") {
  const source = `${title} ${text}`.toLowerCase();
  const ext = (title.match(/\.([a-z0-9]{2,5})$/i)?.[1] || "").toLowerCase();
  const quality = source.match(/(2160p|1080p|720p|480p|4k)/i)?.[1]?.toUpperCase() || null;
  const episodeMatch = source.match(/s(\d{1,2})e(\d{1,3})|(?:ep|episode)[ ._-]?(\d{1,3})/i);

  let type = "other";
  if (["pdf", "epub", "mobi", "azw3"].includes(ext) || source.includes("ebook")) type = "book";
  else if (source.includes("manga") || source.includes("scan") || source.includes("chapter") || source.includes("chapitre")) type = "manga";
  else if (source.includes("anime") || source.includes("vostfr") || source.includes("vf anime")) type = "anime";
  else if (episodeMatch || source.includes("saison") || source.includes("season")) type = "series";
  else if (["mp4", "mkv", "avi", "mov", "webm"].includes(ext)) type = "movie";

  return {
    title: title || text.slice(0, 80) || "Contenu Telegram",
    type,
    genre: "Non classé",
    language: source.includes("vostfr") || source.includes(" vf") ? "Français" : "Inconnu",
    season: episodeMatch?.[1] ? Number(episodeMatch[1]) : null,
    episode: episodeMatch?.[2] ? Number(episodeMatch[2]) : episodeMatch?.[3] ? Number(episodeMatch[3]) : null,
    format: ext ? ext.toUpperCase() : null,
    quality,
  };
}

function publicMessageUrl(group, messageId) {
  if (group.username) return `https://t.me/${group.username}/${messageId}`;
  const clean = String(group.telegram_id || "").replace(/^-100/, "");
  return clean ? `https://t.me/c/${clean}/${messageId}` : null;
}

async function refreshGroups() {
  const settings = await query("select value from app_settings where key='default_storage_mode'");
  defaultStorageMode = settings.rows[0]?.value || "links";
  const result = await query("select * from source_groups where enabled = true");
  activeGroups = new Map(result.rows.map((group) => [String(group.telegram_id), group]));
  console.log(`active_groups=${activeGroups.size}`);
}

async function syncDialogs() {
  const dialogs = await client.getDialogs({ limit: 500 });
  let count = 0;
  for (const dialog of dialogs) {
    const entity = dialog.entity;
    const title = entity?.title || entity?.username;
    const id = entity?.id?.toString();
    if (!title || !id) continue;
    const username = entity.username || null;
    const rowId = `tg-${id}`;
    await query(
      `insert into source_groups(id, telegram_id, title, username, enabled, storage_mode)
       values ($1,$2,$3,$4,false,$5)
       on conflict(id) do update set title=excluded.title, username=excluded.username`,
      [rowId, id, title, username, defaultStorageMode],
    );
    count += 1;
  }
  await event("info", "dialogs_synced", `${count} dialogues Telegram synchronisés`);
}

async function downloadIfNeeded(group, mode, message) {
  if (DISABLE_MEDIA_DOWNLOADS) return null;
  if (!["download", "both"].includes(mode) || !message.media) return null;
  try {
    const buffer = await client.downloadMedia(message.media, {});
    if (!buffer) return null;
    const groupDir = path.join(DOWNLOAD_DIR, group.id);
    await fs.mkdir(groupDir, { recursive: true });
    const fileName = `${message.id}-${Date.now()}.bin`;
    const filePath = path.join(groupDir, fileName);
    await fs.writeFile(filePath, buffer);
    return filePath;
  } catch (error) {
    await event("warning", "download_failed", error.message, group.id);
    return null;
  }
}

async function downloadThumbnail(group, message) {
  if (!message.media) return { path: null, status: "missing" };
  const thumbs = message.document?.thumbs || message.media?.document?.thumbs || message.photo?.sizes || message.media?.photo?.sizes || [];
  const thumb = thumbs.length ? thumbs[thumbs.length - 1] : null;
  if (!thumb) return { path: null, status: "missing" };
  try {
    const buffer = await client.downloadMedia(message.media, { thumb });
    if (!buffer || typeof buffer === "string" || !buffer.length) return { path: null, status: "missing" };
    if (buffer.length > 512 * 1024) {
      await event("warning", "thumbnail_too_large", `Miniature ignorée (${buffer.length} bytes)`, group.id);
      return { path: null, status: "failed" };
    }
    const groupDir = path.join(THUMBNAIL_DIR, group.id);
    await fs.mkdir(groupDir, { recursive: true });
    const filePath = path.join(groupDir, `${message.id}.jpg`);
    await fs.writeFile(filePath, buffer);
    return { path: filePath, status: "ready" };
  } catch (error) {
    await event("warning", "thumbnail_failed", error.message, group.id);
    return { path: null, status: "failed" };
  }
}

async function indexMessage(message, explicitGroup = null) {
  const chatId = String(message.chatId?.value ?? message.peerId?.channelId?.value ?? message.peerId?.chatId?.value ?? "");
  const group = explicitGroup || activeGroups.get(chatId) || activeGroups.get(`-100${chatId}`);
  if (!group) return;

  const mode = group.storage_mode || defaultStorageMode;
  const fileName = message.file?.name || message.document?.attributes?.find((attr) => attr.fileName)?.fileName || "";
  const text = message.message || "";
  if (!message.media && !fileName) return false;
  const data = classify(fileName, text);
  const localPath = await downloadIfNeeded(group, mode, message);
  const thumbnail = await downloadThumbnail(group, message);
  const telegramUrl = ["links", "both", "download"].includes(mode) ? publicMessageUrl(group, message.id) : null;

  await query(
    `insert into media_items(
      id, telegram_message_id, source_group_id, title, type, genre, language,
      season, episode, format, quality, size_bytes, storage_mode, file_path,
      thumbnail_path, thumbnail_status, telegram_url, description, tags, status, posted_at
    ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
    on conflict(source_group_id, telegram_message_id) do update set
      title=excluded.title, type=excluded.type, genre=excluded.genre, language=excluded.language,
      season=excluded.season, episode=excluded.episode, format=excluded.format, quality=excluded.quality,
      size_bytes=coalesce(excluded.size_bytes, media_items.size_bytes), storage_mode=excluded.storage_mode,
      file_path=coalesce(excluded.file_path, media_items.file_path),
      thumbnail_path=coalesce(excluded.thumbnail_path, media_items.thumbnail_path),
      thumbnail_status=case when coalesce(excluded.thumbnail_path, media_items.thumbnail_path) is not null then 'ready' else excluded.thumbnail_status end,
      telegram_url=excluded.telegram_url, description=excluded.description, tags=excluded.tags,
      status=case when coalesce(excluded.file_path, media_items.file_path) is not null then 'downloaded' else excluded.status end, posted_at=excluded.posted_at, updated_at=current_timestamp`,
    [
      `tg-${chatId}-${message.id}`,
      String(message.id),
      group.id,
      data.title,
      data.type,
      data.genre,
      data.language,
      data.season,
      data.episode,
      data.format,
      data.quality,
      message.file?.size ? Number(message.file.size) : null,
      mode,
      localPath,
      thumbnail.path,
      thumbnail.status,
      telegramUrl,
      text || "Contenu indexé depuis Telegram.",
      JSON.stringify([data.type, data.language]),
      localPath ? "downloaded" : "indexed",
      message.date ? new Date(message.date * 1000).toISOString() : new Date().toISOString(),
    ],
  );
  await event("info", "message_indexed", `${data.title} indexé`, group.id);
  return true;
}

async function entityForGroup(group) {
  if (group.username) return client.getEntity(group.username);
  if (String(group.telegram_id).startsWith("@")) return client.getEntity(group.telegram_id);
  return client.getEntity(group.telegram_id);
}

async function processBackfillJobs() {
  if (backfillRunning) return;
  backfillRunning = true;
  try {
    const jobs = await query(
      `select j.*, g.telegram_id, g.title, g.username, g.storage_mode
       from telegram_backfill_jobs j
       join source_groups g on g.id = j.source_group_id
       where j.status = 'queued'
       order by j.id asc
       limit 1`,
    );
    const job = jobs.rows[0];
    if (!job) return;

    await query("update telegram_backfill_jobs set status='running', started_at=current_timestamp, updated_at=current_timestamp where id=$1", [job.id]);
    const group = {
      id: job.source_group_id,
      telegram_id: job.telegram_id,
      title: job.title,
      username: job.username,
      storage_mode: job.storage_mode || defaultStorageMode,
    };

    let processed = 0;
    let imported = 0;
    try {
      const entity = await entityForGroup(group);
      for await (const message of client.iterMessages(entity, { limit: Number(job.requested_limit) || 100 })) {
        processed += 1;
        const ok = await indexMessage(message, group);
        if (ok) imported += 1;
        if (processed % 25 === 0) {
          await query("update telegram_backfill_jobs set processed_count=$1, imported_count=$2, updated_at=current_timestamp where id=$3", [processed, imported, job.id]);
        }
      }
      await query(
        "update telegram_backfill_jobs set status='completed', processed_count=$1, imported_count=$2, finished_at=current_timestamp, updated_at=current_timestamp where id=$3",
        [processed, imported, job.id],
      );
      await event("info", "backfill_completed", `Import historique terminé: ${imported}/${processed} messages`, group.id);
    } catch (error) {
      await query(
        "update telegram_backfill_jobs set status='failed', error_message=$1, processed_count=$2, imported_count=$3, finished_at=current_timestamp, updated_at=current_timestamp where id=$4",
        [error.message, processed, imported, job.id],
      );
      await event("error", "backfill_failed", error.message, group.id);
    }
  } finally {
    backfillRunning = false;
  }
}

async function main() {
  const accountResult = await query("select * from telegram_accounts where id='default'");
  const account = accountResult.rows[0];
  if (!account?.session_string || account.status !== "connected") {
    throw new Error("Compte Telegram non connecté dans /settings");
  }

  client = new TelegramClient(new StringSession(account.session_string), Number(account.api_id), account.api_hash, { connectionRetries: 5 });
  await client.connect();
  if (!(await client.isUserAuthorized())) {
    await query("update telegram_accounts set status='expired', status_message='Session Telegram expirée', updated_at=current_timestamp where id='default'");
    throw new Error("Session Telegram expirée");
  }

  await refreshGroups();
  await syncDialogs();
  await query("update telegram_backfill_jobs set status='queued', updated_at=current_timestamp where status='running'");
  await refreshGroups();
  client.addEventHandler((eventData) => indexMessage(eventData.message).catch((error) => event("error", "message_index_failed", error.message)), new NewMessage({}));
  await event("info", "worker_started", `Worker permanent actif sur ${activeGroups.size} groupe(s)`);
  setInterval(() => refreshGroups().catch((error) => event("error", "groups_refresh_failed", error.message)), POLL_GROUPS_MS);
  setInterval(() => processBackfillJobs().catch((error) => event("error", "backfill_loop_failed", error.message)), POLL_BACKFILL_MS);
  processBackfillJobs().catch((error) => event("error", "backfill_loop_failed", error.message));
  console.log("telegram_worker_started");
}

main().catch(async (error) => {
  console.error(error);
  await event("error", "worker_failed", error.message).catch(() => null);
  process.exit(1);
});
