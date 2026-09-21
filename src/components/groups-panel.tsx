"use client";

import { History, Plus, Power, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import type { StorageMode } from "@/lib/media";
import { storageModeLabels } from "@/lib/media";

type SourceGroup = {
  id: string;
  telegram_id: string;
  title: string;
  username: string | null;
  enabled: boolean;
  storage_mode: StorageMode;
  backfill_status?: string | null;
  backfill_processed?: number | null;
  backfill_imported?: number | null;
  backfill_error?: string | null;
};

const modes: StorageMode[] = ["links"];

export function GroupsPanel() {
  const [groups, setGroups] = useState<SourceGroup[]>([]);
  const [identifier, setIdentifier] = useState("");
  const [mode, setMode] = useState<StorageMode>("links");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const response = await fetch("/api/settings/groups", { cache: "no-store" });
    const data = await response.json();
    setGroups(data.groups ?? []);
  }

  useEffect(() => {
    window.setTimeout(() => refresh().catch(() => setMessage("Impossible de charger les sources")), 0);
    const timer = window.setInterval(() => refresh().catch(() => null), 10000);
    return () => window.clearInterval(timer);
  }, []);

  async function addGroup() {
    setBusy(true);
    const response = await fetch("/api/settings/groups", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ identifier, storageMode: mode }),
    });
    const data = await response.json();
    setMessage(data.ok ? "Source ajoutée" : data.error ?? "Impossible d’ajouter la source");
    setIdentifier("");
    setBusy(false);
    await refresh();
  }

  async function updateGroup(id: string, patch: Partial<Pick<SourceGroup, "enabled" | "storage_mode">>) {
    await fetch(`/api/settings/groups/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ enabled: patch.enabled, storageMode: patch.storage_mode }),
    });
    await refresh();
  }

  async function deleteGroup(id: string) {
    await fetch(`/api/settings/groups/${id}`, { method: "DELETE" });
    await refresh();
  }

  async function backfill(group: SourceGroup) {
    setBusy(true);
    const response = await fetch(`/api/settings/groups/${group.id}/backfill`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ limit: 500 }),
    });
    const data = await response.json();
    setMessage(data.message ?? data.error ?? "Import historique demandé");
    setBusy(false);
    await refresh();
  }

  return (
    <AppShell active="groups">
      <div className="space-y-5">
        <header className="border-b border-white/[0.06] pb-5">
          <h1 className="text-2xl font-medium tracking-[-0.03em]">Sources Telegram</h1>
          <p className="mt-1 text-sm text-[#8a8f98]">Groupes Telegram, indexation sans téléchargement VPS, import historique et streaming direct.</p>
        </header>
        {message && <div className="rounded-lg border border-[#7170ff]/30 bg-[#5e6ad2]/15 px-3 py-2 text-sm text-[#d0d6e0]">{message}</div>}

        <section className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
          <div className="grid gap-3 lg:grid-cols-[1fr_180px_auto] lg:items-end">
            <Field label="Ajouter une source" value={identifier} onChange={setIdentifier} placeholder="@groupe, https://t.me/groupe, -100..." />
            <label className="text-sm text-[#8a8f98]">Mode
              <select value={mode} onChange={(event) => setMode(event.target.value as StorageMode)} className="mt-2 h-11 w-full rounded-lg border border-white/[0.08] bg-[#0f1011] px-3 text-[#f7f8f8] outline-none">
                {modes.map((item) => <option key={item} value={item}>{storageModeLabels[item]}</option>)}
              </select>
            </label>
            <button onClick={addGroup} disabled={busy || !identifier.trim()} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#5e6ad2] px-4 text-sm font-medium text-white disabled:opacity-50"><Plus className="h-4 w-4" /> Ajouter</button>
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.02]">
          {groups.map((group) => (
            <article key={group.id} className="grid gap-3 border-b border-white/[0.06] px-4 py-3 last:border-0 xl:grid-cols-[1fr_170px_auto_auto_auto] xl:items-center">
              <div className="min-w-0">
                <h2 className="truncate text-sm font-medium">{group.title}</h2>
                <p className="truncate text-xs text-[#8a8f98]">{group.username ? `@${group.username}` : group.telegram_id}</p>
                {group.backfill_status && <p className="mt-1 truncate text-xs text-[#8a8f98]">Import {group.backfill_status} · {group.backfill_imported ?? 0}/{group.backfill_processed ?? 0}{group.backfill_error ? ` · ${group.backfill_error}` : ""}</p>}
              </div>
              <select value={group.storage_mode} onChange={(event) => updateGroup(group.id, { storage_mode: event.target.value as StorageMode })} className="h-10 rounded-lg border border-white/[0.08] bg-[#0f1011] px-3 text-sm outline-none">
                {modes.map((item) => <option key={item} value={item}>{storageModeLabels[item]}</option>)}
              </select>
              <button onClick={() => updateGroup(group.id, { enabled: !group.enabled })} className={`inline-flex h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm ${group.enabled ? "bg-emerald-400/10 text-emerald-300" : "bg-white/[0.04] text-[#8a8f98]"}`}><Power className="h-4 w-4" />{group.enabled ? "Actif" : "Pause"}</button>
              <button onClick={() => backfill(group)} disabled={busy || group.backfill_status === "queued" || group.backfill_status === "running"} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[#7170ff]/30 px-3 text-sm text-[#cdd2ff] disabled:opacity-50"><History className="h-4 w-4" /> Import historique</button>
              <button onClick={() => deleteGroup(group.id)} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-red-400/20 px-3 text-sm text-red-300"><Trash2 className="h-4 w-4" /> Retirer</button>
            </article>
          ))}
        </section>
      </div>
    </AppShell>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return <label className="text-sm text-[#8a8f98]">{label}<input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="mt-2 h-11 w-full rounded-lg border border-white/[0.08] bg-[#0f1011] px-3 text-[#f7f8f8] outline-none placeholder:text-[#62666d]" /></label>;
}
