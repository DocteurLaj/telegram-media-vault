import type { MediaItem } from "./media";

export type SeriesSeason = {
  season: number;
  items: MediaItem[];
};

export type SeriesCollection = {
  key: string;
  title: string;
  episodeCount: number;
  latestAt: string;
  seasons: SeriesSeason[];
};

const noiseTokens = [
  /\b(2160p|1080p|720p|480p|4k|hdrip|bdrip|bluray|web[- ]?dl|xvid|x264|x265|h264|h265|french|vostfr|multi|truefrench|extreme|shar\.?club)\b/gi,
  /\[[^\]]+\]/g,
  /\([^)]*\d{4}[^)]*\)/g,
];

function cleanTitle(value: string) {
  let title = value.replace(/\.(mp4|mkv|avi|mov|webm|m4v|mpg|mpeg|wmv|pdf|epub|mobi|azw3|cbz|zip)$/i, "");
  title = title.replace(/[._-]+/g, " ");
  for (const pattern of noiseTokens) title = title.replace(pattern, " ");
  return title.replace(/\s+/g, " ").trim() || value;
}

export function detectSeriesTitle(title: string) {
  const beforeEpisode = title.match(/^(.*?)[ ._-]+s\d{1,2}e\d{1,3}/i)?.[1];
  const beforeEpisodeWord = title.match(/^(.*?)[ ._-]+(?:ep|episode)[ ._-]?\d{1,3}/i)?.[1];
  return cleanTitle(beforeEpisode || beforeEpisodeWord || title);
}

function collectionKey(title: string) {
  return title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function buildSeriesCollections(items: MediaItem[]): SeriesCollection[] {
  const map = new Map<string, { title: string; items: MediaItem[] }>();

  for (const item of items) {
    if (item.type !== "series" && item.type !== "anime") continue;
    const title = detectSeriesTitle(item.title);
    const key = collectionKey(title);
    const entry = map.get(key) ?? { title, items: [] };
    entry.items.push(item);
    map.set(key, entry);
  }

  return Array.from(map.entries()).map(([key, entry]) => {
    const seasonsMap = new Map<number, MediaItem[]>();
    for (const item of entry.items) {
      const season = item.season ?? 1;
      seasonsMap.set(season, [...(seasonsMap.get(season) ?? []), item]);
    }

    const seasons = Array.from(seasonsMap.entries())
      .map(([season, seasonItems]) => ({
        season,
        items: seasonItems.sort((a, b) => (a.episode ?? 9999) - (b.episode ?? 9999) || a.title.localeCompare(b.title)),
      }))
      .sort((a, b) => a.season - b.season);

    const latestAt = entry.items.map((item) => item.postedAt).sort().at(-1) ?? "";

    return {
      key,
      title: entry.title,
      episodeCount: entry.items.length,
      latestAt,
      seasons,
    };
  }).sort((a, b) => b.latestAt.localeCompare(a.latestAt));
}
