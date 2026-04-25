import { sb } from '../lib/supabase.js';

export async function fetchIngredients(userId) {
  const [{ data: ings, error: ingErr }, { data: summary, error: sumErr }] = await Promise.all([
    sb.from("ingredients").select("*").eq("user_id", userId).order("name"),
    sb.from("ingredient_inventory_summary").select("id, available_qty, inventory_status").eq("user_id", userId)
  ]);
  if (ingErr) { console.error("fetchIngredients:", ingErr.message); return []; }
  const qtyMap = {};
  (summary || []).forEach(r => { qtyMap[r.id] = { available_qty: r.available_qty, inventory_status: r.inventory_status }; });
  return (ings || []).map(i => ({ ...i, available_qty: qtyMap[i.id]?.available_qty ?? 0, inventory_status: qtyMap[i.id]?.inventory_status ?? null }));
}

export async function insertIngredient(record) {
  const { data, error } = await sb
    .from("ingredients")
    .insert([record])
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateIngredient(id, fields) {
  const { data, error } = await sb
    .from("ingredients")
    .update(fields)
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteIngredient(id) {
  const { error } = await sb
    .from("ingredients")
    .delete()
    .eq("id", id);
  if (error) throw new Error(error.message);
}
