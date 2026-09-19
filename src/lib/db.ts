import { Pool } from "pg";
import type { MediaItem, MediaType, StorageMode } from "@/lib/media";

let pool: Pool | undefined;

function getPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return null;
  pool ??= new Pool({ connectionString, max: 5 });
  return pool;
}

type MediaRow = {
  id: string;
  title: string;
  type: MediaType;
  author: string | null;
  genre: string | null;
  language: string | null;
  year: number | null;
  season: number | null;
  episode: number | null;
  format: string | null;
  quality: string | null;
  size_bytes: number | null;
  file_path: string | null;
  telegram_url: string | null;
  description: string | null;
  tags: string | string[] | null;
  status: MediaItem["status"];
  storage_mode: StorageMode | null;
  posted_at: string | Date;
  source_group: string | null;
};

function formatBytes(value: number | null) {
  if (!value) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = value;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(size >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function parseTags(value: MediaRow["tags"]) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return value.split(",").map((tag) => tag.trim()).filter(Boolean);
  }
}

const mediaSelect = `
  select
    m.id,
    m.title,
    m.type,
    m.author,
    m.genre,
    m.language,
    m.year,
    m.season,
    m.episode,
    m.format,
    m.quality,
    m.size_bytes,
    m.file_path,
    m.telegram_url,
    m.description,
    m.tags,
    m.status,
    m.storage_mode,
    m.posted_at,
    coalesce(s.title, s.username, s.telegram_id) as source_group
  from media_items m
  left join source_groups s on s.id = m.source_group_id
`;

function mapMediaRow(row: MediaRow): MediaItem {
  return {
    id: row.id,
    title: row.title,
    type: row.type,
    author: row.author ?? undefined,
    genre: row.genre ?? "Non classé",
    language: row.language ?? "Inconnu",
    year: row.year ?? undefined,
    season: row.season ?? undefined,
    episode: row.episode ?? undefined,
    format: row.format ?? "—",
    quality: row.quality ?? undefined,
    size: formatBytes(row.size_bytes),
    sourceGroup: row.source_group ?? "Telegram",
    postedAt: row.posted_at instanceof Date ? row.posted_at.toISOString() : row.posted_at,
    telegramUrl: row.telegram_url ?? "",
    filePath: row.file_path ?? undefined,
    storageMode: row.storage_mode ?? "links",
    description: row.description ?? "Contenu indexé depuis Telegram.",
    tags: parseTags(row.tags),
    status: row.status,
  };
}

export async function fetchMediaFromDatabase(): Promise<MediaItem[] | null> {
  const db = getPool();
  if (!db) return null;

  const result = await db.query<MediaRow>(`
    ${mediaSelect}
    where m.file_path is not null or m.telegram_url is not null
    order by m.posted_at desc, m.created_at desc
    limit 300
  `);

  return result.rows.map(mapMediaRow);
}

export async function fetchMediaItemFromDatabase(id: string): Promise<MediaItem | null> {
  const db = getPool();
  if (!db) return null;

  const result = await db.query<MediaRow>(`${mediaSelect} where m.id = $1 limit 1`, [id]);
  return result.rows[0] ? mapMediaRow(result.rows[0]) : null;
}

export async function fetchMediaFilePath(id: string): Promise<{ path: string; title: string; format: string | null } | null> {
  const db = getPool();
  if (!db) return null;
  const result = await db.query<{ file_path: string | null; title: string; format: string | null }>(
    "select file_path, title, format from media_items where id=$1 limit 1",
    [id],
  );
  const row = result.rows[0];
  if (!row?.file_path) return null;
  return { path: row.file_path, title: row.title, format: row.format };
}
