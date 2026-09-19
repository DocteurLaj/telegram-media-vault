"""PostgreSQL-driven Telegram worker for Telegram Vault.

This worker is the production path for the Settings page:
- reads telegram_accounts for API ID/API hash/phone/status
- reads enabled source_groups and per-group storage_mode
- indexes new Telegram messages into media_items
- writes telegram_scraper_events for visibility in the UI

Install:
  python3 -m venv .venv
  . .venv/bin/activate
  pip install telethon python-dotenv psycopg[binary]

Run:
  DATABASE_URL=postgresql://... python scripts/telegram_worker.py

First login is interactive in the container terminal. The Settings UI records the
credentials and status, then this worker asks Telegram for the login code and
updates status to connected/code_required/password_required/failed.
"""

from __future__ import annotations

import asyncio
import json
import os
from pathlib import Path
from typing import Any

import psycopg
from psycopg.rows import dict_row
from telethon import TelegramClient, events
from telethon.errors import SessionPasswordNeededError

from scraper import classify, should_download_file, should_keep_telegram_link, telegram_message_url

DATABASE_URL = os.environ["DATABASE_URL"]
SESSION_DIR = Path(os.getenv("TELEGRAM_SESSION_DIR", "./storage/telegram"))
DOWNLOAD_DIR = Path(os.getenv("SCRAPER_DOWNLOAD_DIR", "./storage/downloads"))
SESSION_DIR.mkdir(parents=True, exist_ok=True)
DOWNLOAD_DIR.mkdir(parents=True, exist_ok=True)


def db_execute(sql: str, params: tuple[Any, ...] = ()) -> None:
    with psycopg.connect(DATABASE_URL) as conn:
        conn.execute(sql, params)
        conn.commit()


def db_fetchone(sql: str, params: tuple[Any, ...] = ()) -> dict[str, Any] | None:
    with psycopg.connect(DATABASE_URL, row_factory=dict_row) as conn:
        row = conn.execute(sql, params).fetchone()
        return dict(row) if row else None


def db_fetchall(sql: str, params: tuple[Any, ...] = ()) -> list[dict[str, Any]]:
    with psycopg.connect(DATABASE_URL, row_factory=dict_row) as conn:
        return [dict(row) for row in conn.execute(sql, params).fetchall()]


def event(level: str, event_type: str, message: str, source_group_id: str | None = None) -> None:
    db_execute(
        "insert into telegram_scraper_events(level, event_type, message, source_group_id) values (%s, %s, %s, %s)",
        (level, event_type, message, source_group_id),
    )


def update_account(status: str, message: str | None = None) -> None:
    db_execute(
        "update telegram_accounts set status=%s, status_message=%s, last_checked_at=current_timestamp, updated_at=current_timestamp where id='default'",
        (status, message),
    )


def upsert_dialogs(dialogs: list[Any]) -> None:
    for dialog in dialogs:
        entity = dialog.entity
        if not getattr(entity, "megagroup", False) and not getattr(entity, "broadcast", False):
            continue
        telegram_id = str(getattr(entity, "id", ""))
        title = getattr(entity, "title", None) or getattr(entity, "username", None) or telegram_id
        username = getattr(entity, "username", None)
        row_id = f"tg-{telegram_id}"
        db_execute(
            """
            insert into source_groups(id, telegram_id, title, username, enabled, storage_mode)
            values (%s, %s, %s, %s, false, (select value from app_settings where key='default_storage_mode'))
            on conflict(id) do update set title=excluded.title, username=excluded.username
            """,
            (row_id, telegram_id, title, username),
        )


async def main() -> None:
    account = db_fetchone("select * from telegram_accounts where id='default'")
    if not account:
        event("warning", "worker_waiting", "Aucun compte Telegram configuré")
        return

    session_path = SESSION_DIR / "telegram-vault"
    client = TelegramClient(str(session_path), int(account["api_id"]), account["api_hash"])

    try:
        await client.connect()
        if not await client.is_user_authorized():
            update_account("code_required", "Code Telegram requis dans le terminal du worker")
            event("warning", "telegram_code_required", "Le worker attend le code Telegram")
            await client.start(phone=account["phone"])
        update_account("connected", "Compte Telegram connecté")
    except SessionPasswordNeededError:
        update_account("password_required", "Mot de passe 2FA Telegram requis dans le terminal du worker")
        raise
    except Exception as exc:
        update_account("failed", str(exc))
        event("error", "telegram_connect_failed", str(exc))
        raise

    dialogs = await client.get_dialogs()
    upsert_dialogs(dialogs)
    event("info", "dialogs_synced", f"{len(dialogs)} dialogues lus depuis Telegram")

    groups = db_fetchall("select * from source_groups where enabled = true")
    chats = [group["username"] or group["telegram_id"] for group in groups]
    modes = {str(group["telegram_id"]): group["storage_mode"] for group in groups}
    id_by_telegram = {str(group["telegram_id"]): group["id"] for group in groups}

    if not chats:
        event("warning", "worker_idle", "Aucun groupe activé pour le scraping")
        await client.disconnect()
        return

    @client.on(events.NewMessage(chats=chats))
    async def handler(evt):
        message = evt.message
        chat_id = str(evt.chat_id).replace("-100", "")
        mode = modes.get(str(evt.chat_id), modes.get(chat_id, "links"))
        group_id = id_by_telegram.get(str(evt.chat_id), id_by_telegram.get(chat_id))
        filename = getattr(message.file, "name", None) if message.file else ""
        classified = classify(filename or message.raw_text[:80], message.raw_text or "")
        file_path = None
        if should_download_file(mode) and message.file:
            target_dir = DOWNLOAD_DIR / (group_id or chat_id)
            target_dir.mkdir(parents=True, exist_ok=True)
            file_path = await message.download_media(file=str(target_dir))

        db_execute(
            """
            insert into media_items(
              id, telegram_message_id, source_group_id, title, type, genre, language,
              season, episode, format, quality, size_bytes, storage_mode, file_path,
              telegram_url, description, tags, status, posted_at
            ) values (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            on conflict(source_group_id, telegram_message_id) do update set
              title=excluded.title, type=excluded.type, genre=excluded.genre, language=excluded.language,
              season=excluded.season, episode=excluded.episode, format=excluded.format, quality=excluded.quality,
              size_bytes=excluded.size_bytes, storage_mode=excluded.storage_mode, file_path=excluded.file_path,
              telegram_url=excluded.telegram_url, description=excluded.description, tags=excluded.tags,
              status=excluded.status, posted_at=excluded.posted_at, updated_at=current_timestamp
            """,
            (
                f"tg-{evt.chat_id}-{message.id}", str(message.id), group_id,
                classified.title, classified.type, classified.genre, classified.language,
                classified.season, classified.episode, classified.format, classified.quality,
                getattr(message.file, "size", None) if message.file else None,
                mode, file_path,
                telegram_message_url(evt.chat_id, message.id, should_keep_telegram_link(mode)),
                message.raw_text or "Contenu indexé depuis Telegram.",
                json.dumps([classified.type, classified.language]),
                "downloaded" if file_path else "indexed",
                message.date.isoformat(),
            ),
        )
        event("info", "message_indexed", f"{classified.title} indexé", group_id)

    event("info", "worker_started", f"Scraping actif sur {len(chats)} groupe(s)")
    await client.run_until_disconnected()


if __name__ == "__main__":
    asyncio.run(main())
