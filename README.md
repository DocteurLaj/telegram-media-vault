# Telegram Media Vault

Telegram Media Vault est une application web open source qui transforme des groupes ou canaux Telegram autorisés en bibliothèque média privée, lisible depuis un navigateur comme une petite interface Netflix/Plex personnelle.

L’idée est simple : beaucoup de contenus utiles sont dispersés dans Telegram — vidéos, films, séries, animés, mangas, livres, documents, fichiers. Cette application connecte un compte Telegram, indexe les groupes choisis, classe les médias dans PostgreSQL, peut télécharger les fichiers sur un VPS, puis les affiche dans une interface web confortable avec recherche, filtres, lecture, téléchargement et liens Telegram.

> Le projet fournit l’outil de classement et de lecture. Il ne fournit aucun contenu média. Utilisez-le uniquement avec des groupes, fichiers et droits auxquels vous avez accès légalement.

## Pour qui ?

- **Utilisateur non développeur** : une interface web pour retrouver et regarder facilement les fichiers reçus dans Telegram.
- **Administrateur de groupe** : une façon d’organiser automatiquement les médias d’un ou plusieurs groupes.
- **Développeur** : une base Next.js + PostgreSQL + worker Telegram pour construire un media vault privé.
- **Contributeur open source** : un projet concret où améliorer UI, streaming, classification, sécurité, workers, recherche, performances et documentation.

## Ce que fait le projet

- Connexion à Telegram via API ID/API Hash et code/2FA dans l’interface `/settings`.
- Synchronisation des groupes/canaux disponibles sur le compte Telegram connecté.
- Activation/désactivation des groupes sources depuis `/groups`.
- Import historique/backfill des anciens messages Telegram.
- Worker permanent séparé qui indexe les nouveaux messages/fichiers.
- Catalogue média dans PostgreSQL : titre, type, groupe source, taille, format, saison/épisode, date, stockage.
- Bibliothèque web `/` avec recherche, filtres et cartes média.
- Page détail `/media/[id]` avec lecteur, informations, bouton télécharger et lien Telegram.
- Streaming de fichiers locaux via `/api/media/[id]/file` avec support HTTP Range.
- Lecture navigateur des formats compatibles et transcodage vidéo à la volée via `/api/media/[id]/watch` lorsque `ffmpeg` est disponible.
- Modes de stockage par défaut ou par groupe : lien seulement, téléchargement VPS, ou les deux.
- Interface responsive mobile/tablette/desktop.

## Ce que ce n’est pas

- Ce n’est pas un site de streaming public clé en main.
- Ce n’est pas un scraper de contenus illégaux.
- Ce n’est pas un remplacement officiel de Telegram.
- Ce dépôt ne contient aucun film, livre, manga, série ou média Telegram.

## Architecture

```text
Navigateur
  ↓
Next.js App Router + API routes
  ↓ lit/écrit
PostgreSQL
  ↑ écrit les médias, groupes, statuts, backfills
Worker Telegram permanent GramJS
  ↑ écoute/importe les groupes activés
Compte Telegram connecté via /settings
  ↓ télécharge si demandé
Stockage VPS /app/storage/downloads
```

## Pages principales

- `/` — bibliothèque média : recherche, filtres, cartes, actions rapides.
- `/media/[id]` — lecture, téléchargement, détails et lien source.
- `/groups` — gestion des groupes Telegram, activation, mode stockage, import historique.
- `/settings` — connexion Telegram, API ID/API Hash, téléphone, code, 2FA, mode global.

## Modes de stockage

- `links` : garde seulement le lien Telegram. Léger et recommandé pour commencer.
- `download` : télécharge le fichier sur le VPS et le sert depuis le site.
- `both` : garde le lien Telegram et télécharge aussi une copie locale.

Variables utiles :

```env
SCRAPER_STORAGE_MODE=links
SCRAPER_GROUP_STORAGE_MODES=books=links,-1001234567890=both,movies=download
SCRAPER_DOWNLOAD_DIR=./storage/downloads
```

## Stack technique

- Next.js App Router
- TypeScript
- React
- Tailwind CSS v4
- PostgreSQL
- GramJS (`telegram`) pour Telegram côté Node.js
- Worker Node.js séparé
- Docker
- `ffmpeg` pour le transcodage vidéo à la volée
- Vitest + ESLint

## Démarrage local

```bash
npm install
cp .env.example .env
npm run dev
```

Ouvrir ensuite :

```text
http://localhost:3000
```

Pour utiliser PostgreSQL, configurez `DATABASE_URL` dans `.env`, puis appliquez :

```bash
psql "$DATABASE_URL" -f database/schema.sql
```

## Connexion Telegram

1. Aller sur https://my.telegram.org.
2. Se connecter avec son numéro Telegram.
3. Ouvrir **API development tools**.
4. Créer une application.
5. Copier `api_id` et `api_hash`.
6. Dans le site, ouvrir `/settings`.
7. Entrer API ID, API Hash et téléphone.
8. Cliquer **Demander le code**.
9. Entrer le code directement dans le site, jamais dans un chat public.
10. Si Telegram demande la 2FA, entrer le mot de passe 2FA dans le site.

## Worker permanent

Le worker lit la session Telegram stockée en base, synchronise les groupes, écoute les nouveaux messages et traite les imports historiques.

```bash
DATABASE_URL="postgresql://..." \
SCRAPER_DOWNLOAD_DIR=./storage/downloads \
node scripts/telegram_worker.js
```

En production, lancez-le dans un container séparé du site Next.js, avec le même volume `storage` monté côté web et côté worker.

## Docker

```bash
docker build -t telegram-media-vault .
docker run -p 3000:3000 \
  -e DATABASE_URL="postgresql://..." \
  -v "$PWD/storage:/app/storage" \
  telegram-media-vault
```

Worker :

```bash
docker run \
  -e DATABASE_URL="postgresql://..." \
  -e SCRAPER_DOWNLOAD_DIR=/app/storage/downloads \
  -v "$PWD/storage:/app/storage" \
  telegram-media-vault \
  node scripts/telegram_worker.js
```

## Tests et qualité

```bash
npm run test
npm run lint
npm run build
node --check scripts/telegram_worker.js
```

## Sécurité et confidentialité

- Ne committez jamais `.env`, `DATABASE_URL`, API Hash Telegram, session Telegram ou codes Telegram.
- Le site doit idéalement être protégé par authentification avant exposition publique.
- Les fichiers téléchargés peuvent occuper beaucoup d’espace disque : surveillez le volume `storage`.
- Les imports historiques en mode `download` ou `both` peuvent télécharger plusieurs dizaines de Go.
- Respectez les droits d’auteur, la vie privée des groupes et les conditions d’utilisation de Telegram.

## État du projet

Fonctionnel :

- connexion Telegram via interface web ;
- gestion des groupes ;
- worker permanent ;
- import historique ;
- catalogue PostgreSQL ;
- pages bibliothèque et détail média ;
- streaming/download ;
- transcodage vidéo à la volée.

À améliorer :

- authentification du site ;
- thumbnails/posters automatiques ;
- meilleure détection film/série/saison/épisode ;
- regroupement par série/saison ;
- pagination et recherche full-text ;
- quotas disque et nettoyage automatique ;
- UX mobile plus riche ;
- documentation de déploiement plus détaillée.

## Contribuer

Les contributions sont bienvenues : UI, bugs, sécurité, documentation, tests, workers Telegram, classification média, performance, accessibilité.

Voir [CONTRIBUTING.md](./CONTRIBUTING.md).

## Licence

MIT — voir [LICENSE](./LICENSE).
