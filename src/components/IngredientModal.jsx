import React, { useState } from 'react';
import { Icon } from './Icon.jsx';
import { INGREDIENT_TYPES, PURCHASE_UNITS, TO_GRAMS } from '../utils/constants.js';
import { INGREDIENT_LIBRARY } from '../utils/ingredientLibrary.js';
import { costPerGram, normalizeLotNumber } from '../utils/helpers.js';
import { insertIngredient, updateIngredient } from '../services/ingredientsService.js';
import { upsertLot } from '../services/lotsService.js';

export default function IngredientModal({ user, ingredient, ingredients = [], onClose, onSave }) {
  const initCost = () => {
    if (ingredient?.purchase_price) return { price: ingredient.purchase_price, qty: ingredient.purchase_qty, unit: ingredient.purchase_unit || "oz" };
    if (ingredient?.cost_per_unit) return { price: String(ingredient.cost_per_unit), qty: "100", unit: "g" };
    return { price: "", qty: "", unit: "oz" };
  };
  const [form, setForm] = useState({ name: ingredient?.name || "", inci_name: ingredient?.inci_name || "", type: ingredient?.type || "Oil", supplier: ingredient?.supplier || "", notes: ingredient?.notes || "", supplier_lot_number: "" });
  const [inciLocked, setInciLocked] = useState(false);
  const [cost, setCost] = useState(initCost());
  const [err, setErr] = useState("");

  const cpg = costPerGram(cost.price, cost.qty, cost.unit);

  async function save() {
    if (!form.name.trim()) { setErr("Name required."); return; }
    if (!form.supplier.trim()) { setErr("Supplier is required."); return; }

    // Supplier lot requires quantity
    const qty = parseFloat(cost.qty);
    if (form.supplier_lot_number && form.supplier_lot_number.trim()) {
      if (!cost.qty || isNaN(qty) || qty <= 0) {
        setErr("Quantity must be a valid number greater than 0 when entering a supplier lot number.");
        return;
      }
    }

    const nameLower = form.name.trim().toLowerCase();
    const supplierLower = form.supplier.trim().toLowerCase();
    const duplicate = ingredients.find(i =>
      i.name.trim().toLowerCase() === nameLower &&
      (i.supplier || "").trim().toLowerCase() === supplierLower &&
      i.id !== (ingredient?.id)
    );
    if (duplicate) { setErr("This ingredient already exists for this supplier."); return; }

    const record = {
      name: form.name.trim(),
      inci_name: form.inci_name || null,
      type: form.type || null,
      supplier: form.supplier.trim(),
      notes: form.notes || null,
      purchase_price: cost.price ? parseFloat(cost.price) : null,
      purchase_qty: cost.qty ? parseFloat(cost.qty) : null,
      purchase_unit: cost.unit || null,
      cost_per_gram: cpg || 0,
    };
    if (ingredient) {
      updateIngredient(ingredient.id, record)
        .then(() => onSave())
        .catch(e => setErr(e.message));
    } else {
      insertIngredient({ ...record, user_id: user.id })
        .then(async (newIng) => {
          // Auto-create inventory lot if purchase data exists
          if (newIng && cost.qty && parseFloat(cost.qty) > 0) {
            try {
              const factor = TO_GRAMS[cost.unit] || 1;
              const qtyInGrams = Math.round(parseFloat(cost.qty) * factor * 10000) / 10000;
              const today = new Date();
              const datePart = today.toISOString().slice(0,10).replace(/-/g,'');
              const seq = Math.floor(Math.random()*1000).toString().padStart(3,'0');
              const lotNum = `${datePart}-${seq}`;
              const supplierLotNorm = normalizeLotNumber(form.supplier_lot_number) || null;
              await upsertLot({
                user_id: user.id,
                ingredient_id: newIng.id,
                lot_number: lotNum,
                lot_number_normalized: normalizeLotNumber(lotNum),
                supplier: form.supplier.trim() || null,
                supplier_lot_number: supplierLotNorm,
                supplier_lot_number_normalized: supplierLotNorm,
                quantity: qtyInGrams,
                unit: "g",
                remaining_qty: qtyInGrams,
                received_date: today.toISOString().slice(0,10),
              });
            } catch(e) { console.error("Auto-lot error:", e); }
          }
          onSave(newIng?.id);
        })
        .catch(e => setErr(e.message));
    }
  }

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">{ingredient ? "Edit Ingredient" : "New Ingredient"}</div>
          <button className="close-btn" onClick={onClose}>{Icon.x}</button>
        </div>
        <div className="modal-body">
          {err && <div className="alert alert-danger">{err}</div>}
          <div className="grid-2">
            <div className="form-group">
              <label>Name *</label>
              <select value={form.name} onChange={e => {
                const name = e.target.value;
                if (INGREDIENT_LIBRARY.hasOwnProperty(name)) {
                  const lookup = INGREDIENT_LIBRARY[name];
                  setForm(prev => ({
                    ...prev,
                    name,
                    inci_name: inciLocked ? prev.inci_name : lookup.inci,
                    type: lookup.type || prev.type
                  }));
                } else {
                  setForm(prev => ({ ...prev, name }));
                }
              }}>
                <option value="">Select ingredient…</option>
                {Object.keys(INGREDIENT_LIBRARY).sort().map(k => (
                  <option key={k} value={k}>{k}</option>
                ))}
                {form.name && !INGREDIENT_LIBRARY.hasOwnProperty(form.name) && (
                  <option value={form.name}>{form.name}</option>
                )}
              </select>
            </div>
            <div className="form-group">
              <label>INCI Name</label>
              <input value={form.inci_name} onChange={e => {
                setForm({ ...form, inci_name: e.target.value });
                setInciLocked(true);
              }} placeholder="Butyrospermum Parkii" />
              {form.name && INGREDIENT_LIBRARY[form.name] && !inciLocked && form.inci_name === INGREDIENT_LIBRARY[form.name].inci
                ? <div style={{ fontSize: 11, color: "var(--accent)", marginTop: 3 }}>✓ Auto-populated from ingredient library</div>
                : inciLocked
                  ? <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 3 }}>Manual override</div>
                  : null
              }
            </div>
          </div>
          <div className="grid-2">
            <div className="form-group"><label>Type</label>
              <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                {INGREDIENT_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
              {form.name && INGREDIENT_LIBRARY[form.name] && form.type === INGREDIENT_LIBRARY[form.name].type && (
                <div style={{ fontSize: 11, color: "var(--accent)", marginTop: 3 }}>✓ Auto-populated from ingredient library</div>
              )}
            </div>
            <div className="form-group"><label>Supplier</label><input value={form.supplier} onChange={e => setForm({ ...form, supplier: e.target.value })} placeholder="Supplier name" /></div>
          <div className="form-group"><label>Supplier Lot # <span style={{ fontWeight: 400, color: "var(--muted)", fontSize: 11 }}>(optional)</span></label><input value={form.supplier_lot_number} onChange={e => setForm({ ...form, supplier_lot_number: e.target.value })} placeholder="e.g. SL-2024-001" /></div>
          </div>

          <div className="form-group">
            <label>Purchase Cost</label>
            <div className="cost-row">
              <div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>Price paid ($)</div>
                <input type="number" min="0" step="0.01" value={cost.price} onChange={e => setCost({ ...cost, price: e.target.value })} placeholder="e.g. 12.50" />
              </div>
              <div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>Amount purchased</div>
                <div style={{ display: "flex", gap: 6 }}>
                  <input type="number" min="0" step="any" value={cost.qty} onChange={e => setCost({ ...cost, qty: e.target.value })} placeholder="e.g. 16" style={{ flex: 1 }} />
                  <select value={cost.unit} onChange={e => setCost({ ...cost, unit: e.target.value })} style={{ width: 58 }}>
                    {PURCHASE_UNITS.map(u => <option key={u}>{u}</option>)}
                  </select>
                </div>
              </div>
              <div className="cost-preview">
                <small>Cost per gram</small>
                {cpg > 0 ? `$${cpg.toFixed(4)}/g` : "—"}
              </div>
            </div>
            {cpg > 0 && <div className="cost-hint">= ${(cpg * 100).toFixed(4)}/100g · ${(cpg * 1000).toFixed(4)}/kg</div>}
          </div>

          <div className="form-group"><label>Notes</label><textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Additional notes..." /></div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save}>Save Ingredient</button>
        </div>
      </div>
    </div>
  );
}

