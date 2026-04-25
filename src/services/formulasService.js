import { sb } from '../lib/supabase.js';

export async function fetchFormulas(userId) {
  const { data, error } = await sb
    .from("formulas")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) { console.error("fetchFormulas:", error.message); return []; }
  return data;
}

export async function fetchFormulaItems(formulaId) {
  const { data, error } = await sb
    .from("formula_items")
    .select("*")
    .eq("formula_id", formulaId);
  if (error) { console.error("fetchFormulaItems:", error.message); return []; }
  return data;
}

export async function fetchAllFormulaItems(userId) {
  const { data, error } = await sb
    .from("formula_items")
    .select("*, formulas!inner(user_id, name)")
    .eq("formulas.user_id", userId);
  if (error) { console.error("fetchAllFormulaItems:", error.message); return []; }
  return data;
}

export async function insertFormula(record) {
  const { data, error } = await sb
    .from("formulas")
    .insert([record])
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function insertFormulaItems(items) {
  if (!items.length) return [];
  const { data, error } = await sb
    .from("formula_items")
    .insert(items)
    .select();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteFormula(id) {
  // formula_items cascade delete via FK
  const { error } = await sb
    .from("formulas")
    .delete()
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteFormulaItems(formulaId) {
  const { error } = await sb
    .from("formula_items")
    .delete()
    .eq("formula_id", formulaId);
  if (error) throw new Error(error.message);
}

// Update a formula_item's ingredient (used when replacing an ingredient across formulas)
export async function updateFormulaItemIngredient(formulaItemId, newIngredientId) {
  const { error } = await sb
    .from("formula_items")
    .update({ ingredient_id: newIngredientId })
    .eq("id", formulaItemId);
  if (error) throw new Error(error.message);
}

// Formula consumption (inventory deduction via Postgres RPC)
export async function executeFormulaConsumption(formulaId, userId) {
  const { data, error } = await sb.rpc("execute_formula_consumption", {
    p_formula_id: formulaId,
  });
  if (error) {
    const msg = error.message || "";
    if (msg.includes("Not enough inventory")) throw new Error(msg);
    if (msg.includes("Formula not found")) throw new Error("Formula not found.");
    if (msg.includes("Formula has no ingredients")) throw new Error("Formula has no ingredients.");
    throw new Error(msg);
  }
  return data;
}
