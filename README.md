# MapInter

Cartes live et interactives pour les events (forums, salons, festivals…) : l'organisateur délimite son lieu, importe ou dessine son plan, place les points d'intérêt, et les visiteurs se repèrent depuis leur navigateur via un QR code.

## Stack

- **Next.js 16** (App Router, Cache Components) + TypeScript + Tailwind CSS 4
- **MapLibre GL** avec le fond OpenStreetMap d'[OpenFreeMap](https://openfreemap.org) (sans clé)
- **Supabase** : Postgres + PostGIS, Auth, Storage, Realtime

## Démarrage en local

Prérequis : Node 20+, Docker.

```bash
npm install
npx supabase start          # lance Supabase en local (Docker)
npx supabase status -o env  # affiche l'URL de l'API et les clés
```

Créer `.env.local` :

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<PUBLISHABLE_KEY affichée par supabase status>
# En production : URL publique encodée dans les QR codes imprimés
# NEXT_PUBLIC_SITE_URL=https://votre-domaine.fr
```

Puis :

```bash
npm run dev
```

- App : http://localhost:3000
- Supabase Studio : http://127.0.0.1:54323
- E-mails de test (Mailpit) : http://127.0.0.1:54324

## Design · « Signalétique »

MapInter se lit comme un panneau d'orientation. Les principes sont écrits en tête de
[src/app/globals.css](src/app/globals.css) ; les couleurs de la carte (MapLibre ne lit pas le CSS)
sont dans [src/lib/theme.ts](src/lib/theme.ts), à garder synchronisées.

- Un seul signal (vermillon) : position, sélection, direct. Rien d'autre.
- Papier et encre, filets plutôt que boîtes, 3 px de rayon.
- Catégories = pictogrammes ([src/lib/pictograms.ts](src/lib/pictograms.ts)), jamais une couleur.
- Statuts : forme + mot ([src/components/ui/status.tsx](src/components/ui/status.tsx)).
- Numéros sur plaques (`.plate`), police Overpass et Overpass Mono.

## Démo

```bash
SUPABASE_URL=… SUPABASE_SECRET_KEY=… npm run seed:demo -- <email-du-compte>
```

Crée (ou recrée) « Salon Tech & Carrières 2026 » sur `/e/demo-salon-tech-2026` : 56 stands,
scène, salles, services, 4 QR codes et 2 annonces. La clé secrète ne sort jamais de votre poste.

## Production

- App : https://mapinter.vercel.app (Vercel, déployée automatiquement à chaque push sur `mvp`)
- Base : projet Supabase `mapinter` (`xngqrjmplzlyqzftejkm`, région Paris)
- Variables Vercel : `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SITE_URL`

Mettre à jour la base en ligne :

```bash
npx supabase db push --linked                                  # nouvelles migrations
npx supabase config push --project-ref xngqrjmplzlyqzftejkm   # réglages auth ([remotes.production] dans config.toml)
```

`config push` affiche un diff et demande confirmation service par service : relire avant de valider.

**À faire avant d'ouvrir aux organisateurs** : brancher un SMTP (Resend, Brevo…) dans Supabase → Authentication → SMTP. Le serveur d'e-mails par défaut n'envoie qu'aux membres de l'équipe Supabase et quelques messages par heure.

## Base de données

Les migrations sont dans [supabase/migrations](supabase/migrations). Après modification du schéma :

```bash
npx supabase db reset                                              # rejoue les migrations
npx supabase gen types typescript --local > src/lib/database.types.ts
```

| Table | Rôle |
|---|---|
| `events` | Event et sa zone (bounding box, + colonne PostGIS générée) |
| `layers` | Calques : image uploadée calée par ses 4 coins, ou plan dessiné (GeoJSON) |
| `pois` | Points d'intérêt (stands, scènes, toilettes, sorties…) |
| `anchors` | Ancres QR « Vous êtes ici » |
| `announcements` | Annonces live |

La RLS garantit que seul le propriétaire modifie son event ; un event publié est lisible par tous.

## Feuille de route MVP

1. ✅ Compte organisateur, création d'event, délimitation de la zone
2. ✅ Calque : upload + calage (rigide ou coins libres), ou éditeur (rectangles, polygones, chemins, grilles de stands, import des bâtiments OSM via Overpass)
3. ✅ Points d'intérêt (catégories, numéros, état, génération depuis les stands dessinés)
4. ✅ Page visiteur publique `/e/[slug]` : recherche, filtres, fiche lieu, lien direct `?lieu=`, GPS, publication — reste : manifest PWA / hors-ligne
5. ✅ QR codes « Vous êtes ici » : placement dans l'éditeur, affiches A4 imprimables, guidage distance/direction à vol d'oiseau
6. ✅ Live : mises à jour en temps réel (Supabase Realtime, filtré par la RLS) et annonces avec niveau et durée
