# Contribuer à Telegram Media Vault

Merci de vouloir contribuer. Le projet veut rester compréhensible pour les développeurs et les non-développeurs.

## Types de contributions utiles

- Corriger un bug visible dans l’interface.
- Améliorer le responsive mobile/tablette/desktop.
- Ajouter ou améliorer des tests.
- Améliorer la documentation et les guides d’installation.
- Améliorer la classification média : films, séries, animés, mangas, livres, autres.
- Ajouter thumbnails, posters, previews, regroupement par série/saison.
- Optimiser PostgreSQL, worker Telegram, streaming ou transcodage.
- Renforcer la sécurité : authentification, permissions, quotas, validation des chemins.
- Traduire ou clarifier l’interface.

## Règles importantes

- Ne jamais ajouter de vrais secrets dans le dépôt : `.env`, token GitHub, Telegram API Hash, session Telegram, `DATABASE_URL`, code Telegram, mot de passe.
- Ne jamais ajouter de fichiers média téléchargés dans le dépôt.
- Ne pas ajouter de contenu protégé par droits d’auteur.
- Garder les changements petits et lisibles quand possible.
- Expliquer clairement le problème corrigé ou la fonctionnalité ajoutée.

## Préparer le projet

```bash
npm install
cp .env.example .env
npm run dev
```

Pour PostgreSQL :

```bash
psql "$DATABASE_URL" -f database/schema.sql
```

## Avant de proposer une contribution

Exécuter :

```bash
npm run test
npm run lint
npm run build
node --check scripts/telegram_worker.js
```

Si une commande échoue, indiquez l’erreur dans la Pull Request.

## Style de Pull Request

Votre PR doit expliquer :

1. Ce qui change.
2. Pourquoi c’est utile.
3. Comment tester.
4. Les risques éventuels : migration DB, stockage disque, sécurité, compatibilité Telegram.

Exemple :

```text
## Changement
Ajoute une page détail média avec bouton télécharger.

## Pourquoi
Les utilisateurs ne pouvaient pas consommer les fichiers depuis le site.

## Tests
- npm run test
- npm run lint
- npm run build
- test manuel /media/[id]
```

## Issues recommandées

Avant une grosse fonctionnalité, ouvrez une issue pour discuter :

- authentification du site ;
- thumbnails/posters ;
- recherche full-text ;
- regroupement séries/saisons ;
- stockage objet S3/MinIO ;
- quotas et nettoyage disque ;
- support multi-utilisateur.
