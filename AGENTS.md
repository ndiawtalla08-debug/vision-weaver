<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture
- Keep the initial marketplace in a shared frontend shell with leaf routes for content pages, so navigation and cart state remain consistent.
- Keep marketplace context and its consumer hook in a UI-independent module so hot reloads cannot split provider and consumer context identities.
- Isolate demonstration catalog and pricing calculations in a browser-safe module; production data and authoritative order totals must replace it after backend approval.
- Never turn demonstration checkout or tracking into a real success state without a verified provider or stored order.
- Pre-optimize the marketplace UI dependencies and reject outdated optimization requests so preview reloads cannot mix different React module instances.
- AI-generated product sheets remain in public.products and merge with the live D1 products via useSavedProducts; never move them implicitly.
- Public D1 catalog reads use a fixed-endpoint server function and a shared cached root query, so preview CORS restrictions do not block browsing; demo fixtures are for tests only.
- D1 account sessions use a same-origin HttpOnly cookie; favorites server functions validate the token through /me and never accept a user ID, while D1 scopes every operation to the authenticated owner.
- D1 signup must obtain a verified session before reporting sign-in success; support older Workers by exchanging newly registered credentials through /auth/login without exposing tokens to JavaScript.
