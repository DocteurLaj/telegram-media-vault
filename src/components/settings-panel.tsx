"use client";

import { CheckCircle2, Loader2, Save, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import type { StorageMode } from "@/lib/media";
import { storageModeLabels } from "@/lib/media";

type TelegramStatus = { status: string; connected: boolean; phone?: string; api_id?: number; status_message?: string };
const modes: StorageMode[] = ["links", "download", "both"];

export function SettingsPanel() {
  const [status, setStatus] = useState<TelegramStatus>({ status: "loading", connected: false });
  const [defaultStorageMode, setDefaultStorageMode] = useState<StorageMode>("links");
  const [apiId, setApiId] = useState("");
  const [apiHash, setApiHash] = useState("");
  const [phone, setPhone] = useState("");
  const [telegramCode, setTelegramCode] = useState("");
  const [telegramPassword, setTelegramPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const [statusResponse, groupsResponse] = await Promise.all([
      fetch("/api/settings/telegram/status", { cache: "no-store" }),
      fetch("/api/settings/groups", { cache: "no-store" }),
    ]);
    setStatus(await statusResponse.json());
    const groups = await groupsResponse.json();
    setDefaultStorageMode(groups.defaultStorageMode ?? "links");
  }

  useEffect(() => { window.setTimeout(() => refresh().catch(() => setMessage("Impossible de charger le compte")), 0); }, []);

  async function connectTelegram() {
    setBusy(true);
    const response = await fetch("/api/settings/telegram/connect", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ apiId, apiHash, phone }) });
    const data = await response.json();
    setMessage(data.message ?? data.errors?.join(" · ") ?? "Configuration enregistrée");
    setBusy(false);
    await refresh();
  }

  async function requestTelegramCode() {
    setBusy(true);
    const response = await fetch("/api/settings/telegram/request-code", { method: "POST" });
    const data = await response.json();
    setMessage(data.message ?? data.error ?? "Code demandé");
    setBusy(false);
    await refresh();
  }

  async function verifyTelegramCode() {
    setBusy(true);
    const response = await fetch("/api/settings/telegram/verify-code", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code: telegramCode }) });
    const data = await response.json();
    setMessage(data.message ?? data.error ?? "Code vérifié");
    if (data.ok) setTelegramCode("");
    setBusy(false);
    await refresh();
  }

  async function verifyTelegramPassword() {
    setBusy(true);
    const response = await fetch("/api/settings/telegram/verify-password", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password: telegramPassword }) });
    const data = await response.json();
    setMessage(data.message ?? data.error ?? "Mot de passe vérifié");
    if (data.ok) setTelegramPassword("");
    setBusy(false);
    await refresh();
  }

  async function saveDefaultMode(mode: StorageMode) {
    setDefaultStorageMode(mode);
    await fetch("/api/settings/groups", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "default_storage_mode", storageMode: mode }) });
    setMessage(`Mode global enregistré : ${storageModeLabels[mode]}`);
  }

  return (
    <AppShell active="settings">
      <div className="space-y-5">
        <header className="border-b border-white/[0.06] pb-5">
          <h1 className="text-2xl font-medium tracking-[-0.03em]">Compte Telegram</h1>
          <p className="mt-1 text-sm text-[#8a8f98]">Connexion du compte scraper et préférences globales.</p>
        </header>
        {message && <div className="rounded-lg border border-[#7170ff]/30 bg-[#5e6ad2]/15 px-3 py-2 text-sm text-[#d0d6e0]">{message}</div>}

        <section className="grid gap-5 xl:grid-cols-[1fr_360px]">
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div><h2 className="font-medium">Connexion</h2><p className="text-sm text-[#8a8f98]">API ID, API Hash, téléphone et validation du code.</p></div>
              <StatusBadge status={status.status} connected={status.connected} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="API ID" value={apiId} onChange={setApiId} placeholder={status.api_id ? String(status.api_id) : "123456"} />
              <PasswordField label="API Hash" value={apiHash} onChange={setApiHash} placeholder="32 caractères" />
              <Field label="Téléphone" value={phone} onChange={setPhone} placeholder={status.phone ?? "+243..."} />
              <button onClick={connectTelegram} disabled={busy} className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#5e6ad2] px-4 text-sm font-medium text-white disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Enregistrer</button>
            </div>
            <p className="mt-3 text-xs text-[#8a8f98]">Statut : <span className="text-[#d0d6e0]">{status.status}</span>{status.status_message ? ` — ${status.status_message}` : ""}</p>

            <div className="mt-5 grid gap-3 rounded-xl border border-white/[0.06] bg-[#0f1011] p-3 md:grid-cols-[auto_1fr_auto] md:items-end">
              <button onClick={requestTelegramCode} disabled={busy || status.connected} className="inline-flex h-11 items-center justify-center rounded-lg border border-white/[0.08] px-4 text-sm text-[#d0d6e0] disabled:opacity-50">Demander le code</button>
              <Field label="Code reçu" value={telegramCode} onChange={setTelegramCode} placeholder="12345" />
              <button onClick={verifyTelegramCode} disabled={busy || !telegramCode.trim() || status.connected} className="inline-flex h-11 items-center justify-center rounded-lg bg-[#5e6ad2] px-4 text-sm font-medium text-white disabled:opacity-50">Vérifier</button>
            </div>

            {status.status === "password_required" && <div className="mt-3 grid gap-3 rounded-xl border border-amber-400/20 bg-amber-400/5 p-3 md:grid-cols-[1fr_auto] md:items-end"><PasswordField label="Mot de passe 2FA" value={telegramPassword} onChange={setTelegramPassword} placeholder="Mot de passe" /><button onClick={verifyTelegramPassword} disabled={busy || !telegramPassword.trim()} className="h-11 rounded-lg bg-emerald-500 px-4 text-sm font-medium text-white disabled:opacity-50">Vérifier 2FA</button></div>}
          </div>

          <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
            <h2 className="font-medium">Mode global</h2>
            <p className="mb-4 text-sm text-[#8a8f98]">Mode par défaut pour les nouvelles sources.</p>
            <div className="grid gap-2">
              {modes.map((mode) => <button key={mode} onClick={() => saveDefaultMode(mode)} className={`rounded-lg border px-3 py-3 text-left text-sm ${defaultStorageMode === mode ? "border-[#7170ff]/60 bg-[#5e6ad2]/20" : "border-white/[0.08] bg-[#0f1011]"}`}><span className="block font-medium">{storageModeLabels[mode]}</span><span className="text-xs text-[#8a8f98]">{mode}</span></button>)}
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return <label className="text-sm text-[#8a8f98]">{label}<input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="mt-2 h-11 w-full rounded-lg border border-white/[0.08] bg-[#0f1011] px-3 text-[#f7f8f8] outline-none placeholder:text-[#62666d]" /></label>;
}
function PasswordField(props: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return <label className="text-sm text-[#8a8f98]">{props.label}<input type="password" value={props.value} onChange={(event) => props.onChange(event.target.value)} placeholder={props.placeholder} className="mt-2 h-11 w-full rounded-lg border border-white/[0.08] bg-[#0f1011] px-3 text-[#f7f8f8] outline-none placeholder:text-[#62666d]" /></label>;
}
function StatusBadge({ status, connected }: { status: string; connected: boolean }) {
  return <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs ${connected ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300" : "border-amber-400/20 bg-amber-400/10 text-amber-200"}`}>{connected ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}{connected ? "Connecté" : status}</span>;
}
