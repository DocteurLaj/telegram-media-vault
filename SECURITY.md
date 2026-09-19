# Sécurité

Telegram Media Vault manipule des données sensibles : comptes Telegram, groupes privés, chemins de fichiers, médias téléchargés et base PostgreSQL.

## Ne jamais publier

- `.env`
- `DATABASE_URL`
- Telegram API Hash
- session Telegram ou `session_string`
- code Telegram reçu par SMS/app
- mot de passe 2FA Telegram
- fichiers médias téléchargés
- sauvegardes PostgreSQL contenant des données privées

## Recommandations de production

- Protéger le site par authentification avant exposition publique.
- Limiter l’accès aux routes `/settings` et `/groups`.
- Utiliser HTTPS.
- Monter `storage` comme volume persistant, non commité.
- Surveiller l’espace disque avant les imports historiques.
- Faire tourner le worker avec le minimum de privilèges nécessaires.
- Restreindre les chemins servis par `/api/media/[id]/file` à un dossier autorisé.

## Signaler une faille

Ouvrez une issue GitHub si la faille ne révèle pas de secret réel. Pour une faille sensible, contactez d’abord le mainteneur sans publier le détail exploitable publiquement.
