# API TOUT∞SUITE — Cloudflare Workers + D1

Rien n'est déployé automatiquement. Étapes à faire depuis votre compte :

1. Cloudflare → **Storage & Databases → D1 SQL Database → Create**, nom : `toutsuite-db`.
2. Copiez le **Database ID** affiché sur la page de la base dans `wrangler.toml` (`database_id`).
3. Dans ce dossier : `npm install`, `npx wrangler login`.
4. Migrations : `npm run migrate:remote`.
5. Déploiement : `npm run deploy` → notez l'adresse `https://toutsuite-api.<compte>.workers.dev`.
6. Test : ouvrez `<adresse>/health` → doit répondre `{"ok":true,"database":"connected"}`.

Premier administrateur (après inscription via `POST /auth/register`) :
`npx wrangler d1 execute toutsuite-db --remote --command "UPDATE users SET role='admin' WHERE email='VOTRE_EMAIL'"`

Modules : auth, utilisateurs (`/me`, `/admin/users`), catégories, boutiques, produits, annonces, favoris.
Mots de passe : PBKDF2-SHA256 salé. Sessions : jeton aléatoire, seule son empreinte est stockée.
