"""Telegram Vault scraper.

Install when ready:
  python3 -m venv .venv
  . .venv/bin/activate
  pip install telethon python-dotenv

Run:
  python scripts/scraper.py

Storage modes:
  links    Keep only the Telegram URL/reference.
  download Download the file to the VPS and store only the local path.
  both     Keep the Telegram URL and also download the file.

Use SCRAPER_STORAGE_MODE as the global default, and optionally override per group
with SCRAPER_GROUP_STORAGE_MODES, e.g.:
  SCRAPER_GROUP_STORAGE_MODES=books=links,-1001234567890=both,movies=download
"""

from __future__ import annotations

import asyncio
import os
import re
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Literal

try:
    from dotenv import load_dotenv
    from telethon import TelegramClient, events
except ImportError as exc:  # pragma: no cover
    raise SystemExit(
        "Missing dependencies. Run: python3 -m venv .venv && "
        ". .venv/bin/activate && pip install telethon python-dotenv"
    ) from exc

StorageMode = Literal["links", "download", "both"]
VALID_STORAGE_MODES = {"links", "download", "both"}


@dataclass
class ClassifiedMedia:
    title: str
    type: str
    genre: str
    language: str
    season: int | None = None
    episode: int | None = None
    quality: str | None = None
    format: str | None = None


def normalize_storage_mode(value: str | None, default: StorageMode = "links") -> StorageMode:
    mode = (value or default).strip().lower()
    if mode not in VALID_STORAGE_MODES:
        raise ValueError(f"Invalid storage mode {value!r}. Use: links, download, both")
    return mode  # type: ignore[return-value]


def parse_group_storage_modes(raw: str) -> dict[str, StorageMode]:
    overrides: dict[str, StorageMode] = {}
    for chunk in [part.strip() for part in raw.split(",") if part.strip()]:
        if "=" not in chunk:
            raise ValueError(f"Invalid SCRAPER_GROUP_STORAGE_MODES entry {chunk!r}; expected group=mode")
        group, mode = chunk.split("=", 1)
        overrides[group.strip()] = normalize_storage_mode(mode)
    return overrides


def mode_for_group(group_key: str, default_mode: StorageMode, overrides: dict[str, StorageMode]) -> StorageMode:
    return overrides.get(group_key, overrides.get(str(group_key).replace("-100", ""), default_mode))


def should_keep_telegram_link(storage_mode: StorageMode) -> bool:
    return storage_mode in {"links", "both"}


def should_download_file(storage_mode: StorageMode) -> bool:
    return storage_mode in {"download", "both"}


def classify(filename: str, message_text: str = "") -> ClassifiedMedia:
    source = f"{filename} {message_text}".strip()
    lower = source.lower()
    suffix = Path(filename).suffix.replace(".", "").upper() or None

    media_type = "other"
    if suffix in {"PDF", "EPUB", "MOBI"}:
        media_type = "book"
    elif suffix in {"CBZ", "CBR"} or any(word in lower for word in ["chapitre", "scan", "manga"]):
        media_type = "manga"
    elif any(word in lower for word in ["anime", "vostfr", "saison finale"]):
        media_type = "anime"
    elif re.search(r"s\d{1,2}e\d{1,2}", lower):
        media_type = "series"
    elif suffix in {"MP4", "MKV", "AVI", "MOV"}:
        media_type = "movie"

    episode_match = re.search(r"s(?P<season>\d{1,2})e(?P<episode>\d{1,2})", lower)
    quality_match = re.search(r"(2160p|1080p|720p|480p|hdr|web[- .]?dl|bluray)", lower)
    lang = "VOSTFR" if "vostfr" in lower else "VF" if " vf" in f" {lower}" else "Inconnu"

    title = re.sub(r"[._]", " ", Path(filename).stem).strip()
    title = re.sub(r"\bs\d{1,2}e\d{1,2}\b", "", title, flags=re.IGNORECASE).strip(" -")

    return ClassifiedMedia(
        title=title or "Sans titre",
        type=media_type,
        genre="Non classé",
        language=lang,
        season=int(episode_match.group("season")) if episode_match else None,
        episode=int(episode_match.group("episode")) if episode_match else None,
        quality=quality_match.group(0) if quality_match else None,
        format=suffix,
    )


def telegram_message_url(chat_id: int | str, message_id: int, keep_link: bool) -> str | None:
    if not keep_link:
        return None
    return f"https://t.me/c/{str(chat_id).replace('-100', '')}/{message_id}"


async def main() -> None:
    load_dotenv()
    api_id = os.environ["TELEGRAM_API_ID"]
    api_hash = os.environ["TELEGRAM_API_HASH"]
    session_name = os.getenv("TELEGRAM_SESSION_NAME", "telegram-vault")
    groups = [group.strip() for group in os.getenv("TELEGRAM_SOURCE_GROUPS", "").split(",") if group.strip()]
    default_storage_mode = normalize_storage_mode(os.getenv("SCRAPER_STORAGE_MODE", "links"))
    group_storage_modes = parse_group_storage_modes(os.getenv("SCRAPER_GROUP_STORAGE_MODES", ""))
    download_dir = Path(os.getenv("SCRAPER_DOWNLOAD_DIR", "./storage/downloads"))
    download_dir.mkdir(parents=True, exist_ok=True)

    if not groups:
        raise SystemExit("Set TELEGRAM_SOURCE_GROUPS in .env")

    client = TelegramClient(session_name, int(api_id), api_hash)

    @client.on(events.NewMessage(chats=groups))
    async def handler(event):
        message = event.message
        group_key = str(event.chat_id)
        storage_mode = mode_for_group(group_key, default_storage_mode, group_storage_modes)
        filename = getattr(message.file, "name", None) if message.file else ""
        classified = classify(filename or message.raw_text[:80], message.raw_text or "")
        file_path = None

        if should_download_file(storage_mode) and message.file:
            target_dir = download_dir / group_key.replace("-", "")
            target_dir.mkdir(parents=True, exist_ok=True)
            file_path = await message.download_media(file=str(target_dir))

        payload = {
            **asdict(classified),
            "telegram_message_id": str(message.id),
            "source_group": group_key,
            "storage_mode": storage_mode,
            "telegram_url": telegram_message_url(event.chat_id, message.id, should_keep_telegram_link(storage_mode)),
            "file_path": file_path,
            "text": message.raw_text,
        }
        print(payload)
        # TODO: persist payload into PostgreSQL/SQLite and expose through /api/media.

    print(
        f"Listening to {len(groups)} Telegram source group(s); "
        f"default storage mode={default_storage_mode}; overrides={group_storage_modes}"
    )
    await client.start()
    await client.run_until_disconnected()


if __name__ == "__main__":
    asyncio.run(main())
