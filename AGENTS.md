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
- Isolate demonstration catalog and pricing calculations in a browser-safe module; production data and authoritative order totals must replace it after backend approval.
- Never turn demonstration checkout or tracking into a real success state without a verified provider or stored order.
- Pre-optimize the marketplace UI dependencies and reject outdated optimization requests so preview reloads cannot mix different React module instances.
- AI-generated product sheets persist in the public.products table (image stored as a data URL in image_data) and are merged into the demo catalog via useSavedProducts; demo products stay in src/lib/catalog.ts until seller accounts exist.
