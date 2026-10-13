# API TOUT∞SUITE — Cloudflare Workers + D1

Rien n'est déployé automatiquement. La base **existe déjà** : `toutsuite-annonces-db`
(ID `5ec829c9-4e94-4ec7-92e1-41e1173bc239`), liée au Worker par le binding `DB`
dans `wrangler.toml`. **Ne créez pas de nouvelle base.**

## Tables (migrations/0001_init.sql)
users, sessions, user_profiles, stores, store_members, categories, products,
product_images, product_variants, announcements, announcement_images, favorites.

## Commandes — VS Code sous Windows (terminal PowerShell)
```powershell
cd cloudflare\api
npm install
npx wrangler login
npx wrangler d1 list                                   # la base doit apparaître
npx wrangler d1 migrations list toutsuite-annonces-db --remote
npm run migrate:remote                                 # applique 0001_init.sql
npx wrangler d1 execute toutsuite-annonces-db --remote --command "SELECT name FROM sqlite_master WHERE type='table'"
npm run deploy                                         # note l'adresse *.workers.dev
```
Test réel : ouvrez `https://toutsuite-api.<compte>.workers.dev/health`.
Résultat attendu : `{"ok":true,"database":"connected","tables":[...7 tables],"migrated":true}`.
Tant que ce test n'a pas réussi, la base n'est **pas** considérée comme connectée.

Test local (optionnel) : `npm run migrate:local` puis `npm run dev` → http://localhost:8787/health

## Premier administrateur (après `POST /auth/register`)
```powershell
npx wrangler d1 execute toutsuite-annonces-db --remote --command "UPDATE users SET role='admin' WHERE email='VOTRE_EMAIL'"
```

Sécurité : mots de passe PBKDF2-SHA256 salés ; sessions par jeton aléatoire dont seule l'empreinte est stockée.
