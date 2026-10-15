export const THEMES = [
  { id: "green", label: "Phosphor" },
  { id: "amber", label: "Amber" },
  { id: "blue", label: "Blue" },
  { id: "sunburn", label: "Sunburn" },
  { id: "lilac", label: "Lilac" },
  { id: "violet", label: "Violet" },
  { id: "neon", label: "Neon" },
  { id: "frost", label: "Frost" },
  { id: "graphite", label: "Graphite" },
  { id: "grimdark", label: "Grimdark" },
  { id: "mist", label: "Mist" },
  { id: "slate", label: "Slate" },
];

export const DEFAULT_THEME = "green";

export const MODERN_THEMES = ["mist", "slate"];

export function isModern(id) {
  return MODERN_THEMES.includes(id);
}
