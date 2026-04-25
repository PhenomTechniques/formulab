import { TO_GRAMS } from './constants.js';

export function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function normalizeLotNumber(value) {
  return (value || "").trim().toLowerCase().replace(/[-_\s]+/g, "");
}

export function costPerGram(price, qty, unit) {
  const p = parseFloat(price), q = parseFloat(qty);
  if (!p || !q || q <= 0) return 0;
  // Full precision — never round here
  return p / (q * TO_GRAMS[unit]);
}

export function ingLabel(i) {
  const supplier = i.supplier ? ` — ${i.supplier}` : "";
  const cost = i.cost_per_gram > 0 ? ` ($${i.cost_per_gram.toFixed(4)}/g)` : "";
  const inci = i.inci_name ? ` · ${i.inci_name}` : "";
  return `${i.name}${inci}${supplier}${cost}`;
}

export function sortIngredients(arr) {
  return [...arr].sort((a, b) => {
    const n = a.name.toLowerCase().localeCompare(b.name.toLowerCase());
    if (n !== 0) return n;
    return (a.supplier || "").toLowerCase().localeCompare((b.supplier || "").toLowerCase());
  });
}

// Extract base name and version number from a formula name
export function parseFormulaName(name) {
  const match = name.match(/^(.*?)\s+v(\d+)$/i);
  if (match) return { baseName: match[1].trim(), version: parseInt(match[2]) };
  return { baseName: name.trim(), version: 1 };
}

// Get the next version number for a base name within a user's formulas
export function nextVersionFor(baseName, userId, formulas) {
  const siblings = formulas.filter(f =>
    f.user_id === userId &&
    (f.base_name === baseName || parseFormulaName(f.name).baseName === baseName)
  );
  const versions = siblings.map(f => f.version || parseFormulaName(f.name).version);
  return versions.length > 0 ? Math.max(...versions) + 1 : 2;
}
