export type MediaType = "book" | "manga" | "movie" | "series" | "anime" | "other";
export type StorageMode = "links" | "download" | "both";

export type MediaItem = {
  id: string;
  title: string;
  type: MediaType;
  author?: string;
  genre: string;
  language: string;
  year?: number;
  season?: number;
  episode?: number;
  format: string;
  quality?: string;
  size: string;
  sourceGroup: string;
  postedAt: string;
  telegramUrl: string;
  filePath?: string;
  thumbnailPath?: string;
  storageMode: StorageMode;
  description: string;
  tags: string[];
  status: "indexed" | "downloaded" | "needs-review";
};

export const typeLabels: Record<MediaType, string> = {
  book: "Livres",
  manga: "Mangas",
  movie: "Films",
  series: "Séries",
  anime: "Animés",
  other: "Autres",
};

export const storageModeLabels: Record<StorageMode, string> = {
  links: "Lien Telegram",
  download: "Fichier VPS",
  both: "Lien + fichier",
};

export const mediaItems: MediaItem[] = [];

export const categories = Object.entries(typeLabels).map(([type, label]) => ({
  type: type as MediaType,
  label,
  count: 0,
  latest: "Aucun contenu",
}));
