"use client";

import { Download, ExternalLink, FolderKanban, Play, Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { type MediaItem, type MediaType, storageModeLabels, typeLabels } from "@/lib/media";
import { buildSeriesCollections } from "@/lib/series";
import { formatDate } from "@/lib/utils";

const filters: Array<MediaType | "all"> = ["all", "movie", "series", "anime", "manga", "book", "other"];

export function MediaVaultDashboard({ initialItems = [], initialSource = "loading" }: { initialItems?: MediaItem[]; initialSource?: string }) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState<MediaType | "all">("all");
  const [items, setItems] = useState<MediaItem[]>(initialItems);
  const [source, setSource] = useState(initialSource);

  async function loadMedia() {
    const response = await fetch("/api/media", { cache: "no-store" });
    const data = await response.json();
    setItems(Array.isArray(data.items) ? data.items : []);
    setSource(data.meta?.source ?? "api");
  }

  useEffect(() => {
    window.setTimeout(() => loadMedia().catch(() => setSource("offline")), 0);
    const timer = window.setInterval(() => loadMedia().catch(() => setSource("offline")), 30000);
    return () => window.clearInterval(timer);
  }, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items.filter((item) => {
      const matchesType = type === "all" || item.type === type;
      const text = [item.title, item.author, item.genre, item.language, item.format, item.quality, item.sourceGroup, ...item.tags].filter(Boolean).join(" ").toLowerCase();
      return matchesType && (!needle || text.includes(needle));
    });
  }, [items, query, type]);

  const counts = useMemo(() => {
    const map = new Map<MediaType | "all", number>([["all", items.length]]);
    for (const item of items) map.set(item.type, (map.get(item.type) ?? 0) + 1);
    return map;
  }, [items]);

  const collections = useMemo(() => buildSeriesCollections(filtered), [filtered]);
  const gridItems = useMemo(() => {
    if (type === "series") return filtered.filter((item) => item.type !== "series");
    if (type === "anime") return filtered.filter((item) => item.type !== "anime");
    return filtered;
  }, [filtered, type]);

  function downloadItemsToDevice(episodes: MediaItem[]) {
    for (const [index, episode] of episodes.entries()) {
      window.setTimeout(() => {
        const link = document.createElement("a");
        link.href = episode.filePath ? `/api/media/${encodeURIComponent(episode.id)}/file?download=1` : `/api/media/${encodeURIComponent(episode.id)}/telegram-download`;
        link.download = episode.title;
        link.rel = "noreferrer";
        document.body.appendChild(link);
        link.click();
        link.remove();
      }, index * 700);
    }
  }

  return (
    <AppShell active="library">
      <div className="space-y-5">
        <header className="flex flex-col gap-3 border-b border-white/[0.06] pb-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-medium tracking-[-0.03em] text-[#f7f8f8]">Médiathèque</h1>
            <p className="mt-1 text-sm text-[#8a8f98]">Regarder depuis Telegram via le lecteur du site ou télécharger sur l’appareil ouvert.</p>
          </div>
          <div className="text-xs text-[#62666d]">{source} · {items.length} médias</div>
        </header>

        <section className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <label className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#62666d]" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Chercher film, série, livre, groupe…" className="h-11 w-full rounded-lg border border-white/[0.08] bg-[#0f1011] pl-10 pr-3 text-sm outline-none placeholder:text-[#62666d] focus:border-[#7170ff]/60" />
            </label>
            <div className="flex gap-2 overflow-x-auto pb-1 lg:pb-0">
              {filters.map((filter) => (
                <button key={filter} onClick={() => setType(filter)} className={`min-h-11 shrink-0 rounded-lg border px-3 py-2 text-sm ${type === filter ? "border-[#7170ff]/60 bg-[#5e6ad2]/20 text-[#f7f8f8]" : "border-white/[0.08] text-[#8a8f98] hover:bg-white/[0.04]"}`}>
                  {filter === "all" ? "Tout" : typeLabels[filter]} <span className="text-[#62666d]">{counts.get(filter) ?? 0}</span>
                </button>
              ))}
            </div>
          </div>
        </section>

        {filtered.length === 0 ? (
          <section className="flex min-h-72 flex-col items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 text-center">
            <h2 className="text-base font-medium">Aucun média lisible</h2>
            <p className="mt-1 max-w-md text-sm text-[#8a8f98]">Active une source dans “Sources”, puis lance Import historique. Les vidéos/fichiers apparaîtront ici.</p>
          </section>
        ) : (
          <>
            {collections.length > 0 && (type === "all" || type === "series" || type === "anime") && (
              <section className="space-y-3 rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-medium">Collections séries</h2>
                    <p className="text-xs text-[#8a8f98]">Les épisodes sont rangés par série, puis par saison.</p>
                  </div>
                  <span className="text-xs text-[#62666d]">{collections.length} collections</span>
                </div>
                <div className="grid gap-3 xl:grid-cols-2">
                  {collections.map((collection) => {
                    const collectionItems = collection.seasons.flatMap((season) => season.items);
                    const posterItem = collectionItems.find((item) => item.thumbnailPath) ?? collectionItems[0];
                    return (
                    <article key={collection.key} className="overflow-hidden rounded-xl border border-white/[0.08] bg-[#0f1011]">
                      <PosterFrame item={posterItem} title={collection.title} subtitle={`${collection.episodeCount} épisodes · ${collection.seasons.length} saison(s)`} badge="Collection" />
                      <div className="p-3">
                        <div className="mb-3 flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h3 className="truncate text-sm font-medium">{collection.title}</h3>
                            <p className="mt-1 text-xs text-[#8a8f98]">{collection.episodeCount} épisodes · {collection.seasons.length} saison(s)</p>
                          </div>
                          <FolderKanban className="h-5 w-5 shrink-0 text-[#7170ff]" />
                        </div>
                      <button onClick={() => downloadItemsToDevice(collectionItems)} className="mb-3 inline-flex h-9 items-center gap-2 rounded-lg border border-white/[0.08] px-3 text-xs text-[#d0d6e0]"><Download className="h-3.5 w-3.5" /> Télécharger la collection sur mon appareil</button>
                      <div className="space-y-3">
                        {collection.seasons.map((season) => (
                          <div key={season.season} className="rounded-lg border border-white/[0.06] p-2">
                            <div className="mb-2 text-xs font-medium text-[#d0d6e0]">Saison {season.season}</div>
                            <div className="space-y-1">
                              {season.items.slice(0, 8).map((episode) => (
                                <div key={episode.id} className="grid grid-cols-[1fr_auto] items-center gap-2 rounded-md px-2 py-1.5 hover:bg-white/[0.04]">
                                  <Link href={`/media/${encodeURIComponent(episode.id)}`} className="min-w-0 truncate text-xs text-[#d0d6e0]">E{episode.episode ?? "?"} · {episode.title}</Link>
                                  <div className="flex gap-1">
                                    <Link href={`/media/${encodeURIComponent(episode.id)}`} className="rounded-md bg-[#5e6ad2] px-2 py-1 text-[11px] text-white">Lire</Link>
                                    <a href={episode.filePath ? `/api/media/${encodeURIComponent(episode.id)}/file?download=1` : `/api/media/${encodeURIComponent(episode.id)}/telegram-download`} download className="rounded-md border border-white/[0.08] px-2 py-1 text-[11px] text-[#d0d6e0]">Télécharger</a>
                                  </div>
                                </div>
                              ))}
                              {season.items.length > 8 && <div className="px-2 py-1 text-xs text-[#62666d]">+ {season.items.length - 8} épisode(s) de plus</div>}
                            </div>
                          </div>
                        ))}
                      </div>
                      </div>
                    </article>
                    );
                  })}
                </div>
              </section>
            )}

            {gridItems.length > 0 && (
              <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {gridItems.map((item) => <MediaCard key={item.id} item={item} />)}
              </section>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}

function MediaCard({ item }: { item: MediaItem }) {
  return (
    <article className="overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.02] transition hover:border-[#7170ff]/40 hover:bg-white/[0.04]">
      <Link href={`/media/${encodeURIComponent(item.id)}`} className="block">
        <PosterFrame item={item} title={item.title} subtitle={`${item.sourceGroup} · ${item.quality || item.format || item.size}`} badge={typeLabels[item.type]} />
      </Link>
      <div className="space-y-3 p-3">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-medium">{item.title}</h2>
          <p className="mt-1 truncate text-xs text-[#8a8f98]">{item.sourceGroup} · {item.quality || item.format} · {item.size}</p>
          <p className="mt-1 text-xs text-[#62666d]">{storageModeLabels[item.storageMode]} · {formatDate(item.postedAt)}</p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Link href={`/media/${encodeURIComponent(item.id)}`} className="inline-flex h-10 items-center justify-center gap-1 rounded-lg bg-[#5e6ad2] px-2 text-xs font-medium text-white"><Play className="h-3.5 w-3.5" /> Lire</Link>
          <a href={item.filePath ? `/api/media/${encodeURIComponent(item.id)}/file?download=1` : `/api/media/${encodeURIComponent(item.id)}/telegram-download`} download className="inline-flex h-10 items-center justify-center gap-1 rounded-lg border border-white/[0.08] px-2 text-xs text-[#d0d6e0]"><Download className="h-3.5 w-3.5" /> Télécharger</a>
          {item.telegramUrl ? <a href={item.telegramUrl} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center justify-center gap-1 rounded-lg border border-white/[0.08] px-2 text-xs text-[#d0d6e0]"><ExternalLink className="h-3.5 w-3.5" /> TG</a> : <span className="inline-flex h-10 items-center justify-center rounded-lg border border-white/[0.04] px-2 text-xs text-[#62666d]">TG</span>}
        </div>
      </div>
    </article>
  );
}

function PosterFrame({ item, title, subtitle, badge }: { item?: MediaItem; title: string; subtitle?: string; badge: string }) {
  return (
    <div className="relative flex aspect-video overflow-hidden bg-[radial-gradient(circle_at_18%_10%,rgba(113,112,255,.45),transparent_30%),radial-gradient(circle_at_85%_30%,rgba(15,174,201,.22),transparent_34%),linear-gradient(135deg,#191a1b,#060708)]">
      {item?.thumbnailPath ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/api/media/${encodeURIComponent(item.id)}/thumbnail`} alt={title} className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
      ) : (
        <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,.10),transparent_35%),radial-gradient(circle_at_65%_30%,rgba(113,112,255,.35),transparent_30%)]" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-black/25" />
      <span className="absolute left-3 top-3 rounded-full bg-black/55 px-2 py-1 text-xs text-[#d0d6e0] backdrop-blur">{badge}</span>
      <div className="absolute bottom-0 left-0 right-0 p-3">
        <h3 className="line-clamp-2 text-sm font-semibold leading-tight text-white drop-shadow">{title}</h3>
        {subtitle && <p className="mt-1 truncate text-xs text-[#d0d6e0]">{subtitle}</p>}
      </div>
      <div className="absolute right-3 top-3 rounded-full bg-black/45 p-2 text-white backdrop-blur"><Play className="h-4 w-4" /></div>
    </div>
  );
}
