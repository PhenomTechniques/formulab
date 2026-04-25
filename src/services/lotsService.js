import { sb } from '../lib/supabase.js';
import { normalizeLotNumber } from '../utils/helpers.js';

export async function fetchLots(ingredientId, userId) {
  const { data, error } = await sb
    .from("inventory_lots")
    .select("*")
    .eq("ingredient_id", ingredientId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) { console.error("fetchLots:", error.message); return []; }
  return data;
}

export async function insertLot(record) {
  console.log("INSERT LOT CALLED", record);
  const { data, error } = await sb
    .from("inventory_lots")
    .insert([record])
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateLot(id, fields) {
  console.log("UPDATE LOT CALLED", id, fields);
  const { data, error } = await sb
    .from("inventory_lots")
    .update(fields)
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

// Fetch all lots for an ingredient (used by InventoryLotsSection)
export async function fetchLotsByReceivedDate(ingredientId, userId) {
  const { data, error } = await sb
    .from("inventory_lots")
    .select("*")
    .eq("ingredient_id", ingredientId)
    .eq("user_id", userId)
    .order("received_date", { ascending: false });
  if (error) return { data: null, error };
  return { data: data || [], error: null };
}

// Fetch lots for duplicate-validation when adding a new lot
export async function fetchLotsForValidation(ingredientId, userId) {
  const { data, error } = await sb
    .from("inventory_lots")
    .select("id, lot_number_normalized, supplier, supplier_lot_number, quantity, remaining_qty")
    .eq("ingredient_id", ingredientId)
    .eq("user_id", userId);
  return { data, error };
}

// Fetch lots for duplicate-validation when editing an existing lot
export async function fetchLotsForEditValidation(ingredientId, userId) {
  const { data, error } = await sb
    .from("inventory_lots")
    .select("id, lot_number, lot_number_normalized, supplier")
    .eq("ingredient_id", ingredientId)
    .eq("user_id", userId);
  return { data, error };
}

export async function upsertLot(record) {
  const normalizedSupplierLot = normalizeLotNumber(record.supplier_lot_number || "");

  // Check if supplier lot already exists for same user + ingredient
  const { data: existing, error: findError } = await sb
    .from("inventory_lots")
    .select("*")
    .eq("user_id", record.user_id)
    .eq("ingredient_id", record.ingredient_id)
    .eq("supplier_lot_number_normalized", normalizedSupplierLot)
    .maybeSingle();

  if (findError) throw new Error(findError.message);

  // If exists → add quantity to existing lot, keep same internal lot number
  if (existing) {
    const newQty = Math.round(((existing.quantity || 0) + (record.quantity || 0)) * 10000) / 10000;
    const newRemaining = Math.round(((existing.remaining_qty || 0) + (record.quantity || 0)) * 10000) / 10000;
    return await updateLot(existing.id, {
      quantity: newQty,
      remaining_qty: newRemaining,
    });
  }

  // If NOT exists → insert new row
  return await insertLot({
    ...record,
    lot_number_normalized: normalizeLotNumber(record.lot_number || ""),
    supplier_lot_number_normalized: normalizedSupplierLot,
  });
}
