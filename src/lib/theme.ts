// Palette de la carte : jumelle des tokens de globals.css (MapLibre ne lit pas les variables CSS).

export type MapPalette = {
  basemap: string;
  paper: string;
  sheet: string;
  ink: string;
  onInk: string;
  signal: string;
  onSignal: string;
  /** L'encre à une opacité donnée (0–1). */
  inkAlpha: (a: number) => string;
};

const light: MapPalette = {
  basemap: "https://tiles.openfreemap.org/styles/positron",
  paper: "#f4f3ef",
  sheet: "#ffffff",
  ink: "#15171a",
  onInk: "#f4f3ef",
  signal: "#d63b22",
  onSignal: "#ffffff",
  inkAlpha: (a) => `rgba(21, 23, 26, ${a})`,
};

const dark: MapPalette = {
  basemap: "https://tiles.openfreemap.org/styles/dark",
  paper: "#0e0f11",
  sheet: "#1b1d20",
  ink: "#ecebe6",
  onInk: "#15171a",
  signal: "#ff5a3c",
  onSignal: "#15171a",
  inkAlpha: (a) => `rgba(236, 235, 230, ${a})`,
};

export function mapPalette(): MapPalette {
  if (typeof window === "undefined") return light;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? dark : light;
}
