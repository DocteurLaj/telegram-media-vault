import { describe, expect, it } from "vitest";
import type { MediaItem } from "./media";
import { buildSeriesCollections, detectSeriesTitle } from "./series";

const base = (partial: Partial<MediaItem>): MediaItem => ({
  id: partial.id ?? "id",
  title: partial.title ?? "Unknown",
  type: partial.type ?? "series",
  genre: "Non classé",
  language: "Français",
  format: "MP4",
  size: "1 GB",
  sourceGroup: "Telegram",
  postedAt: "2026-01-01T00:00:00Z",
  telegramUrl: "",
  storageMode: "download",
  description: "",
  tags: [],
  status: "downloaded",
  ...partial,
});

describe("series helpers", () => {
  it("detects a clean collection title from SxxExx filenames", () => {
    expect(detectSeriesTitle("Narcos.S01E08 Shar.Club.avi")).toBe("Narcos");
    expect(detectSeriesTitle("The.Last.of.Us.S02E03.1080p.mkv")).toBe("The Last of Us");
  });

  it("groups series items into collections and seasons", () => {
    const collections = buildSeriesCollections([
      base({ id: "e8", title: "Narcos.S01E08 Shar.Club.avi", season: 1, episode: 8 }),
      base({ id: "e7", title: "Narcos.S01E07 Shar.Club.avi", season: 1, episode: 7 }),
      base({ id: "other", title: "Film.mp4", type: "movie" }),
    ]);

    expect(collections).toHaveLength(1);
    expect(collections[0].title).toBe("Narcos");
    expect(collections[0].episodeCount).toBe(2);
    expect(collections[0].seasons).toHaveLength(1);
    expect(collections[0].seasons[0].season).toBe(1);
    expect(collections[0].seasons[0].items.map((item) => item.id)).toEqual(["e7", "e8"]);
  });
});
