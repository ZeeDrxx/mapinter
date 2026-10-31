/**
 * Crée (ou recrée) l'event de démonstration « Salon Tech & Carrières 2026 ».
 *
 *   SUPABASE_URL=… SUPABASE_SECRET_KEY=… node scripts/seed-demo.ts <email-organisateur>
 *
 * La clé secrète contourne la RLS : ne l'utilisez que depuis votre poste, jamais dans l'app.
 * Idempotent : l'event portant le même slug est supprimé (avec tout son contenu) puis recréé.
 * Toutes les entreprises sont fictives.
 */
import { createClient } from "@supabase/supabase-js";
import {
  fromLocal,
  gridFrom3,
  pathFeature,
  polygonFeature,
  rectFrom3,
  ringCentroid,
  type PlanFeature,
  type XY,
} from "../src/lib/plan.ts";

type LngLat = [number, number];

const SLUG = "demo-salon-tech-2026";
// Coin sud-ouest du hall (Paris Expo, Porte de Versailles)
const ORIGIN: LngLat = [2.28635, 48.83085];

const url = process.env.SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
const ownerEmail = process.argv[2];
if (!url || !secret || !ownerEmail) {
  console.error("Usage : SUPABASE_URL=… SUPABASE_SECRET_KEY=… node scripts/seed-demo.ts <email>");
  process.exit(1);
}

const db = createClient(url, secret, { auth: { persistSession: false } });
const at = (x: number, y: number): LngLat => fromLocal(ORIGIN, [x, y] as XY);
const id = () => crypto.randomUUID();

/** Rectangle aligné sur le hall, en mètres depuis le coin sud-ouest. */
function rect(x: number, y: number, w: number, h: number): LngLat[] {
  return rectFrom3(at(x, y), at(x + w, y), at(x + w, y + h));
}

// ---------------------------------------------------------------------------
// Plan dessiné
// ---------------------------------------------------------------------------

const stage = polygonFeature(id(), rect(118, 95, 52, 13), "stage", "Grande scène");
const features: PlanFeature[] = [
  polygonFeature(id(), rect(0, 0, 180, 110), "hall", "Hall 1"),
  polygonFeature(id(), rect(10, 6, 52, 22), "zone", "Espace restauration"),
  polygonFeature(id(), rect(118, 6, 25, 22), "zone", "Salle Ada"),
  polygonFeature(id(), rect(145, 6, 25, 22), "zone", "Salle Turing"),
  stage,
  polygonFeature(id(), rect(0, 104, 8, 6), "obstacle", ""),
  polygonFeature(id(), rect(172, 104, 8, 6), "obstacle", ""),
];

// Deux blocs de stands (A au nord, B au sud), chacun coupé par l'allée centrale
const STAND_W = 9;
const STAND_D = 6;
const blocks = [
  { prefix: "A", y: 72 },
  { prefix: "B", y: 44 },
];
const standFeatures: { feature: PlanFeature; code: string }[] = [];
for (const { prefix, y } of blocks) {
  let n = 1;
  for (const x0 of [20, 97]) {
    // Grille tracée depuis son bord nord : la numérotation se lit de haut en bas, comme un plan imprimé
    const top = y + 2 * STAND_D;
    const cells = gridFrom3(at(x0, top), at(x0 + 7 * STAND_W, top), at(x0 + 7 * STAND_W, y), 2, 7);
    for (const ring of cells) {
      const code = `${prefix}${n++}`;
      const feature = polygonFeature(id(), ring, "stand", code);
      features.push(feature);
      standFeatures.push({ feature, code });
    }
  }
}

// Allées
const aisle = (label: string, ...pts: [number, number][]) => features.push(pathFeature(id(), pts.map(([x, y]) => at(x, y)), label));
aisle("Allée centrale", [90, 2], [90, 100]);
aisle("Allée nord", [12, 90], [168, 90]);
aisle("Allée du milieu", [12, 64], [168, 64]);
aisle("Allée sud", [12, 36], [168, 36]);

// ---------------------------------------------------------------------------
// Lieux
// ---------------------------------------------------------------------------

const exhibitors: Record<string, { name: string; description: string; status?: "busy" | "closed" }> = {
  A1: { name: "Nébula Robotique", description: "Bras robotisés collaboratifs pour l'industrie.\nDémo en continu." },
  A2: { name: "Atelier Pixel", description: "Studio de design produit et d'interfaces." },
  A3: { name: "Cobalt Data", description: "Plateforme de données temps réel.\nOn recrute 12 ingénieurs data.", status: "busy" },
  A5: { name: "Verdure Énergie", description: "Stockage solaire pour bâtiments tertiaires." },
  A8: { name: "Kinetik Labs", description: "Capteurs de mouvement pour le sport de haut niveau." },
  A9: { name: "Orbe Studio", description: "Réalité mixte pour la formation." },
  A12: { name: "Lumen Cyber", description: "Audit et formation en cybersécurité.\nAtelier CTF à 15h." },
  A14: { name: "Quanta École", description: "École d'ingénieurs en alternance. Admissions 2027 ouvertes." },
  B1: { name: "Sillage Mobilité", description: "Vélos-cargos électriques pour la logistique urbaine." },
  B3: { name: "Mosaïk RH", description: "Recrutement tech : venez avec votre CV !", status: "busy" },
  B4: { name: "Ferment Food Tech", description: "Protéines par fermentation de précision." },
  B7: { name: "Halo Santé", description: "Télésuivi des patients chroniques." },
  B9: { name: "Brique Cloud", description: "Hébergement souverain pour les PME." },
  B11: { name: "Ondine Audio", description: "Casques à réduction de bruit adaptative.", status: "closed" },
  B12: { name: "Tangram Jeux", description: "Studio de jeux vidéo indépendant. Testez notre prochain titre." },
  B14: { name: "Prisme Formation", description: "Bootcamps développement web et data." },
};

type PoiRow = {
  event_id: string;
  category: string;
  name: string;
  code?: string | null;
  description?: string | null;
  lng: number;
  lat: number;
  status: string;
  metadata: Record<string, string>;
};

function servicePoi(eventId: string, category: string, name: string, x: number, y: number, description: string | null = null): PoiRow {
  const [lng, lat] = at(x, y);
  return { event_id: eventId, category, name, code: null, description, lng, lat, status: "open", metadata: {} };
}

// ---------------------------------------------------------------------------

async function main() {
  const { data: users, error: usersError } = await db.auth.admin.listUsers({ perPage: 1000 });
  if (usersError) throw usersError;
  const owner = users.users.find((u) => u.email?.toLowerCase() === ownerEmail.toLowerCase());
  if (!owner) throw new Error(`Aucun compte pour ${ownerEmail} : inscrivez-vous d'abord sur le site.`);

  await db.from("events").delete().eq("slug", SLUG);

  const [w, s] = at(-40, -40);
  const [e, n] = at(220, 150);
  const { data: event, error: eventError } = await db
    .from("events")
    .insert({
      owner_id: owner.id,
      name: "Salon Tech & Carrières 2026",
      slug: SLUG,
      description:
        "Exemple de démonstration : 56 exposants (fictifs), une grande scène, deux salles de conférence et un espace restauration.",
      starts_at: "2026-11-14T08:00:00.000Z",
      ends_at: "2026-11-14T17:00:00.000Z",
      min_lng: w,
      min_lat: s,
      max_lng: e,
      max_lat: n,
      is_published: true,
    })
    .select("id")
    .single();
  if (eventError) throw eventError;

  const { error: layerError } = await db.from("layers").insert({
    event_id: event.id,
    kind: "drawn",
    name: "Dessin",
    features: { type: "FeatureCollection", features },
    sort_order: 1,
  });
  if (layerError) throw layerError;

  const pois: PoiRow[] = standFeatures.map(({ feature, code }) => {
    const [lng, lat] = ringCentroid((feature.geometry.coordinates as LngLat[][])[0].slice(0, -1));
    const ex = exhibitors[code];
    return {
      event_id: event.id,
      category: "stand",
      name: ex?.name ?? `Stand ${code}`,
      code,
      description: ex?.description ?? null,
      lng,
      lat,
      status: ex?.status ?? "open",
      metadata: { featureId: feature.properties.id },
    };
  });
  const [sx, sy] = [144, 101];
  pois.push(
    // Reliée à sa forme dessinée : un clic sur la scène ouvre sa fiche
    {
      ...servicePoi(event.id, "stage", "Grande scène", sx, sy, "10h00 — Ouverture\n11h30 — Table ronde : l'IA au travail\n14h00 — Pitchs des startups\n17h30 — Remise des prix"),
      metadata: { featureId: stage.properties.id },
    },
    servicePoi(event.id, "room", "Salle Ada", 130, 17, "Ateliers pratiques, 20 places."),
    { ...servicePoi(event.id, "room", "Salle Turing", 157, 17, "Atelier IA générative à 14h : complet."), status: "busy" },
    servicePoi(event.id, "food", "Espace restauration", 36, 17, "Food trucks et café de 9h à 18h."),
    servicePoi(event.id, "info", "Accueil & badges", 90, 6, "Retrait des badges, vestiaire, objets trouvés."),
    servicePoi(event.id, "entrance", "Entrée principale", 90, 1),
    servicePoi(event.id, "exit", "Sortie de secours ouest", 1, 55),
    servicePoi(event.id, "exit", "Sortie de secours est", 179, 55),
    servicePoi(event.id, "toilet", "Toilettes nord-ouest", 4, 107),
    servicePoi(event.id, "toilet", "Toilettes nord-est", 176, 107),
    servicePoi(event.id, "toilet", "Toilettes restauration", 64, 8),
    servicePoi(event.id, "first_aid", "Poste de secours", 112, 8, "Secouristes présents toute la journée."),
  );
  const { error: poiError } = await db.from("pois").insert(pois, { defaultToNull: false });
  if (poiError) throw poiError;

  const anchors = [
    // Affiche collée à côté de l'accueil, pas dessus : les plaques restent lisibles
    ["Entrée principale", 100, 12],
    ["Allée centrale, croisement B", 90, 36],
    ["Allée centrale, croisement A", 90, 64],
    ["Devant la Grande scène", 144, 92],
  ] as const;
  const { error: anchorError } = await db
    .from("anchors")
    .insert(anchors.map(([label, x, y]) => ({ event_id: event.id, label, lng: at(x, y)[0], lat: at(x, y)[1] })));
  if (anchorError) throw anchorError;

  const { error: annError } = await db.from("announcements").insert([
    { event_id: event.id, message: "Bienvenue ! Conférence d'ouverture à 10h sur la Grande scène.", level: "info" },
    { event_id: event.id, message: "Salle Turing complète pour l'atelier IA de 14h.", level: "warning" },
  ]);
  if (annError) throw annError;

  console.log(`Event de démo créé pour ${ownerEmail} : /e/${SLUG}`);
  console.log(`${pois.length} lieux, ${features.length} éléments de plan, ${anchors.length} QR codes.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
