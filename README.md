# Hợp Gu (working name)

A personal dish diary: remember which dishes you loved and which to never order
again, across GrabFood, ShopeeFood, beFood and dine-in. Later phases match
people with the same taste on specific dishes.

This is the **Phase 1 web prototype**. It runs in demo mode: there is no login
and no server database yet, and everything you enter is saved only in your own
browser.

## Run it

```bash
npm install
```

```bash
npm run dev
```

Then open http://localhost:3000.

Other commands: `npm test` (logic tests), `npm run typecheck`, `npm run lint`,
`npm run build`.

## What is in it

| Screen | What it does |
| --- | --- |
| Diary (`/`) | Every dish logged, as a table or a board grouped by verdict |
| Places (`/places`) | Each place with its per-dish verdict counts |
| Wishlist (`/wishlist`) | Places to try later |
| Nearby (`/map`) | Map of your own pins, with layers |
| My taste (`/taste`) | Taste profile per dish type, computed from your logs |
| Settings (`/settings`) | Language (Vietnamese / English), light or dark, export and delete data |

Press **Ctrl K** (or **Cmd K**) anywhere for "Have I eaten here?".

## Where things live

- `src/lib/` holds the logic, with no screen code: types, Vietnamese text
  matching (`text.ts`), share-link reading (`links.ts`), dish types and taste
  descriptors (`dishTypes.ts`), taste profile maths (`taste.ts`), the saved-data
  store (`store.ts`) and translations (`i18n.ts`).
- `src/components/` holds shared interface pieces (sidebar, quick search,
  logging panel, place panel, map).
- `src/app/` holds one folder per page.

## Safety notes for this prototype

- Pasted links are only recognised from a fixed list of hosts (`links.ts`).
  Anything else is ignored and never stored. Short links are not followed,
  because that needs a server that fetches URLs and must be built with care.
- Data read back from browser storage is checked against a schema before use.
- Map tiles come from OpenStreetMap's public servers, which are for light use
  only. Set `NEXT_PUBLIC_MAP_STYLE_URL` to a Goong or MapTiler style before any
  public launch.
- Location is read only when "My location" is pressed and is never saved.

## Not built yet

Login (Google, phone, Zalo), the server database with per-user access rules,
sharing, taste twins and suggestions. See the product plan for the phases.
