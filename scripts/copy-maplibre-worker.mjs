// MapLibre 6 charge son worker depuis l'URL de son propre module : une fois regroupé par Next,
// ce fichier n'existe plus à côté. On le sert donc depuis public/ (voir components/map/use-maplibre.ts).
// Lancé automatiquement avant `dev` et `build`.
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const target = join(root, "public", "vendor", "maplibre-gl-worker.mjs");
mkdirSync(dirname(target), { recursive: true });
copyFileSync(join(root, "node_modules", "maplibre-gl", "dist", "maplibre-gl-worker.mjs"), target);
console.log("maplibre-gl-worker.mjs → public/vendor/");
