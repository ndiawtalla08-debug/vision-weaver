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

## Inscription et connexion
Le site appelle `POST /auth/register`, puis utilise le jeton retourné. Pour rester compatible
avec le Worker déjà déployé qui ne retourne pas de jeton à l'inscription, le site appelle
automatiquement `POST /auth/login` après création du compte. Le jeton reste dans un cookie
HttpOnly du site ; `GET /me` vérifie la session et récupère `user_profiles`.

La version source de `/auth/register` crée désormais utilisateur, profil et session dans
un même lot D1 et retourne `{ token, expires_at, user }`. Elle n'a pas été déployée automatiquement.
Pour mettre à jour uniquement le Worker existant depuis PowerShell :
```powershell
cd cloudflare\api
npm install
npx wrangler login
npm run deploy
```
Aucune nouvelle base ni migration n'est nécessaire pour cette correction.

## Gestion des produits vendeurs
Le site conserve les fiches IA existantes ; les nouveaux produits du formulaire « Mes produits » sont écrits uniquement dans D1.
Déployer le Worker existant avec `npm run deploy` pour activer ces nouveaux endpoints (aucune migration nécessaire) :
- `GET /me/stores` : boutiques dont la session est propriétaire ou gérant.
- `GET /me/products?store=ID` : tous les produits, brouillons inclus, après contrôle de la boutique.
- `POST /products` : `store_id`, `category_id`, `name`, `description`, `price`, `old_price`, `stock`, `status` (`draft` ou `published`), `image`.
- `PATCH /products/ID` : les mêmes champs ; `store_id` ne peut pas changer.
- `DELETE /products/ID` : contrôle de la boutique réelle du produit avant suppression.
- `GET /products?store=ID` : uniquement les produits publiés d’une boutique active, accessible au public.

Les identifiants sont vérifiés avant toute écriture. Le propriétaire ou gérant est lu depuis `stores`/`store_members`, jamais depuis un identifiant utilisateur fourni par le navigateur. Les photos HTTPS ou JPG/PNG/WebP intégrées sont conservées dans `product_images` dans le même lot que l’écriture du produit ; le formulaire limite les fichiers à 500 Ko. Les boutiques en attente ne deviennent pas publiques lors de la publication d’un produit.

### Vérification après déploiement
Se connecter avec deux comptes ayant chacun leur propre boutique ; relever les IDs retournés par `/me/stores`.
Créer un brouillon avec une photo, confirmer sa présence dans `/me/products?store=ID` et son absence dans `/products?store=ID`.
Modifier le produit, le publier, contrôler tous les champs et la photo via la lecture publique ; tenter sa modification et sa suppression avec la session de l’autre vendeur (403 attendu), puis supprimer le produit avec la session propriétaire et confirmer son absence.
Ne jamais utiliser ni modifier les produits existants pour ces essais : créer un produit temporaire explicitement identifié comme test.

### Résultats vérifiés le 8 novembre 2026
Sur `https://toutsuite-api.ndiawtalla08.workers.dev` : connexion et profil, création d’un produit temporaire dans une boutique de test, brouillon absent du catalogue public, refus 403 de création et suppression entre deux vendeurs, suppression propriétaire puis 404 sur le produit supprimé. Les produits de test ont été supprimés ; les comptes de test et deux boutiques en attente restent enregistrés et ne sont pas publics.
La page boutique lit réellement `/products?store=ID` et affiche les données ; le compte connecté accède à « Mes produits » avec un avertissement honnête de mise à jour requise.
`GET /me/stores`, `GET /me/products` et `PATCH /products/ID` ne sont pas disponibles sur la version déployée (404). Le parcours complet du nouveau formulaire, les photos et la publication ne sont donc pas encore vérifiés en production. Aucun accès de déploiement Cloudflare n’est disponible dans cet environnement.

**Attention à la différence de version :** l’API déployée exige aussi `category` et `contact_email` lors de `POST /stores`, contrairement à la source locale. Comparer et fusionner la source réellement déployée avant de lancer `npm run deploy` ; ne pas remplacer aveuglément les fonctions boutiques existantes. Ne pas recréer la base ni réappliquer la migration initiale.
