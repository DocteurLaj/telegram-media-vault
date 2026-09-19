# Telegram Media Vault

Site Next.js privé pour indexer des groupes Telegram et retrouver livres, mangas, films, séries et animés avec recherche et filtres.

## Stack

- Next.js App Router + TypeScript
- Tailwind CSS v4
- UI dark moderne inspirée Linear/shadcn
- API route `/api/media`
- Schéma SQL prêt dans `database/schema.sql`
- Scraper Telethon préparé dans `scripts/scraper.py`

## Lancer le site

```bash
npm install
npm run dev
```

Puis ouvrir http://localhost:3000.

## Configurer Telegram

1. Créer une app sur https://my.telegram.org
2. Copier `.env.example` vers `.env`
3. Remplir `TELEGRAM_API_ID`, `TELEGRAM_API_HASH`, `TELEGRAM_SOURCE_GROUPS`
4. Installer le scraper :

```bash
python3 -m venv .venv
. .venv/bin/activate
pip install telethon python-dotenv
python scripts/scraper.py
```

## Modes de stockage

Le scraper supporte trois modes :

- `links` : garde seulement le lien Telegram, mode léger recommandé au début.
- `download` : télécharge le fichier sur le VPS et garde le chemin local.
- `both` : garde le lien Telegram et télécharge aussi le fichier sur le VPS.

Configuration globale :

```env
SCRAPER_STORAGE_MODE=links
```

Overrides par groupe :

```env
SCRAPER_GROUP_STORAGE_MODES=books=links,-1001234567890=both,movies=download
```

## Prochaine étape de production

Créer PostgreSQL dans Dokploy, appliquer `database/schema.sql`, puis remplacer les données seed `src/lib/media.ts` par des requêtes PostgreSQL. Pour un usage public, garder le site privé avec login et respecter les droits des contenus indexés.
