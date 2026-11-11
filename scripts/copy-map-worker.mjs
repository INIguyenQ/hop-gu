// The map library runs part of its work in a separate background file.
// Copying it into public/ lets the app serve it from its own address
// instead of depending on how the bundler packages it.
import { copyFileSync, mkdirSync } from "node:fs";

mkdirSync("public/vendor", { recursive: true });
copyFileSync("node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs", "public/vendor/maplibre-gl-worker.mjs");
