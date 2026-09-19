"use client";

import { ArrowLeft, Download, ExternalLink, FileVideo, Play } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { type MediaItem, storageModeLabels, typeLabels } from "@/lib/media";
import { formatDate } from "@/lib/utils";

const browserVideoFormats = new Set(["MP4", "M4V", "WEBM"]);
const transcodableVideoFormats = new Set(["AVI", "MKV", "MOV", "MPG", "MPEG", "WMV"]);
const videoTypes = new Set(["movie", "series", "anime"]);

export function MediaDetail({ id }: { id: string }) {
  const [item, setItem] = useState<MediaItem | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    window.setTimeout(() => {
      fetch(`/api/media/${encodeURIComponent(id)}`, { cache: "no-store" })
        .then((response) => response.ok ? response.json() : Promise.reject(new Error("Média introuvable")))
        .then((data) => setItem(data.item))
        .catch((err) => setError(err instanceof Error ? err.message : "Erreur média"));
    }, 0);
  }, [id]);

  const playback = useMemo(() => {
    if (!item?.filePath || !videoTypes.has(item.type)) return null;
    const format = (item.format || "").toUpperCase();
    if (browserVideoFormats.has(format)) return { src: `/api/media/${encodeURIComponent(item.id)}/file`, transcoded: false };
    if (transcodableVideoFormats.has(format)) return { src: `/api/media/${encodeURIComponent(item.id)}/watch`, transcoded: true };
    return null;
  }, [item]);

  return (
    <AppShell active="library">
      <div className="space-y-5">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-[#8a8f98] hover:text-[#d0d6e0]"><ArrowLeft className="h-4 w-4" /> Retour à la bibliothèque</Link>

        {error && <div className="rounded-xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-200">{error}</div>}
        {!item && !error && <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-6 text-sm text-[#8a8f98]">Chargement du média…</div>}

        {item && (
          <>
            <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#050505]">
              {playback ? (
                <div className="bg-black">
                  <video className="aspect-video w-full bg-black" controls playsInline preload="metadata" src={playback.src} />
                  {playback.transcoded && <p className="border-t border-white/[0.08] px-4 py-2 text-xs text-[#8a8f98]">Lecture directe activée par transcodage MP4 à la volée. Si le réseau est lent, utilise Télécharger.</p>}
                </div>
              ) : (
                <div className="flex aspect-video flex-col items-center justify-center gap-3 bg-[radial-gradient(circle_at_30%_20%,rgba(113,112,255,.35),transparent_35%),linear-gradient(135deg,#191a1b,#050505)] px-4 text-center">
                  <FileVideo className="h-12 w-12 text-[#8a8f98]" />
                  <div>
                    <h1 className="text-xl font-medium">{item.title}</h1>
                    <p className="mt-1 text-sm text-[#8a8f98]">{item.filePath ? `${item.format} n’est pas toujours lisible directement par le navigateur. Télécharge ou ouvre dans Telegram.` : "Ce média est en lien Telegram uniquement."}</p>
                  </div>
                </div>
              )}
            </section>

            <section className="grid gap-5 lg:grid-cols-[1fr_320px]">
              <div className="space-y-4">
                <div>
                  <div className="mb-2 flex flex-wrap gap-2 text-xs text-[#8a8f98]"><span>{typeLabels[item.type]}</span><span>·</span><span>{item.sourceGroup}</span><span>·</span><span>{formatDate(item.postedAt)}</span></div>
                  <h1 className="text-2xl font-medium tracking-[-0.03em]">{item.title}</h1>
                  <p className="mt-2 text-sm leading-6 text-[#8a8f98]">{item.description}</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {playback && <a href={playback.src} className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#5e6ad2] px-4 text-sm font-medium text-white"><Play className="h-4 w-4" /> Lire ici</a>}
                  {item.filePath && <a href={`/api/media/${encodeURIComponent(item.id)}/file?download=1`} className="inline-flex h-10 items-center gap-2 rounded-lg border border-white/[0.08] px-4 text-sm text-[#d0d6e0]"><Download className="h-4 w-4" /> Télécharger</a>}
                  {item.telegramUrl && <a href={item.telegramUrl} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-2 rounded-lg border border-white/[0.08] px-4 text-sm text-[#d0d6e0]"><ExternalLink className="h-4 w-4" /> Ouvrir Telegram</a>}
                </div>
              </div>

              <aside className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 text-sm">
                <h2 className="mb-3 font-medium">Informations</h2>
                <Info label="Stockage" value={storageModeLabels[item.storageMode]} />
                <Info label="Format" value={item.format} />
                <Info label="Qualité" value={item.quality || "—"} />
                <Info label="Taille" value={item.size} />
                <Info label="Langue" value={item.language} />
                <Info label="Genre" value={item.genre} />
                {(item.season || item.episode) && <Info label="Épisode" value={`S${item.season ?? "?"} E${item.episode ?? "?"}`} />}
              </aside>
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between gap-3 border-b border-white/[0.06] py-2 last:border-0"><span className="text-[#8a8f98]">{label}</span><span className="text-right text-[#d0d6e0]">{value}</span></div>;
}
