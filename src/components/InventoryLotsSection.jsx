import React, { useState, useEffect } from 'react';
import { Icon } from './Icon.jsx';
import { normalizeLotNumber } from '../utils/helpers.js';
import { upsertLot, updateLot, fetchLotsByReceivedDate, fetchLotsForValidation, fetchLotsForEditValidation } from '../services/lotsService.js';

export function generateLotNumber(ingredient, date, existingLots) {
  // Build prefix from ingredient name: take first word, strip non-alphanum, uppercase, max 6 chars
  const prefix = (ingredient.name || "ING")
    .split(/[^a-zA-Z0-9]/)[0]
    .toUpperCase()
    .slice(0, 6);

  // Date part: YYYYMMDD
  const d = date ? new Date(date) : new Date();
  const datePart = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}`;

  // Sequence: count existing lots for this ingredient today + 1
  const todayPrefix = `${prefix}-${datePart}-`;
  const existing = (existingLots || []).filter(l => (l.lot_number || "").startsWith(todayPrefix.toLowerCase()));
  const seq = String(existing.length + 1).padStart(3, "0");

  return `${prefix}-${datePart}-${seq}`.toLowerCase();
}

export default function InventoryLotsSection({ user, ingredient }) {
  const [lots, setLots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");
  const [supplierLotWarning, setSupplierLotWarning] = useState(false);
  const [existingSupplierLot, setExistingSupplierLot] = useState(null); // stores the existing lot to increment

  const [form, setForm] = useState({
    lot_number: "",
    supplier_lot_number: "",
    quantity: "",
    unit: "g",
    received_date: "",
    expiration_date: ""
  });

  const TO_GRAMS_LOT = { g: 1, kg: 1000, oz: 28.3495, lb: 453.592, ml: 1, L: 1000 };

  function normalizeLot(value) {
    return (value || "").trim().toLowerCase().replace(/[-_\s]+/g, "");
  }

  async function fetchLotsLocal() {
    if (!ingredient) return;
    const { data, error } = await fetchLotsByReceivedDate(ingredient.id, user.id);
    if (!error) setLots(data || []);
  }

  useEffect(() => {
    fetchLotsLocal();
    setForm({
      lot_number: "",
      supplier_lot_number: "",
      quantity: ingredient.purchase_qty ? String(ingredient.purchase_qty) : "",
      unit: ingredient.purchase_unit || "g",
      received_date: new Date().toISOString().slice(0, 10),
      expiration_date: ""
    });
    setShowForm(false);
    setError("");
  }, [ingredient.id]);

  async function doSaveLot(finalLotNumber, normalized, qty) {
    const factor = TO_GRAMS_LOT[form.unit] || 1;
    const qtyInGrams = Math.round(qty * factor * 10000) / 10000;
    setLoading(true);
    try {
      await upsertLot({
        user_id: user.id,
        ingredient_id: ingredient.id,
        lot_number: finalLotNumber,
        lot_number_normalized: normalized,
        supplier_lot_number: normalizeLotNumber(form.supplier_lot_number) || null,
        supplier_lot_number_normalized: normalizeLotNumber(form.supplier_lot_number) || null,
        supplier: ingredient.supplier || null,
        quantity: qtyInGrams,
        unit: "g",
        remaining_qty: qtyInGrams,
        received_date: form.received_date || null,
      });
    } catch(e) {
      setError(e.message);
      setLoading(false); return;
    }
    await fetchLotsLocal();
    setForm({
      lot_number: "",
      supplier_lot_number: "",
      quantity: ingredient.purchase_qty ? String(ingredient.purchase_qty) : "",
      unit: ingredient.purchase_unit || "g",
      received_date: new Date().toISOString().slice(0, 10),
      expiration_date: ""
    });
    setLoading(false);
  }

  async function addToExistingLot() {
    if (!existingSupplierLot) return;
    const factor = TO_GRAMS_LOT[form.unit] || 1;
    const addQty = Math.round(parseFloat(form.quantity) * factor * 10000) / 10000;
    const newQty = Math.round(((existingSupplierLot.quantity || 0) + addQty) * 10000) / 10000;
    const newRemaining = Math.round(((existingSupplierLot.remaining_qty || 0) + addQty) * 10000) / 10000;
    setLoading(true);
    try {
      await updateLot(existingSupplierLot.id, {
        quantity: newQty,
        remaining_qty: newRemaining,
      });
      await fetchLotsLocal();
      setForm({
        lot_number: "",
        supplier_lot_number: "",
        quantity: ingredient.purchase_qty ? String(ingredient.purchase_qty) : "",
        unit: ingredient.purchase_unit || "g",
        received_date: new Date().toISOString().slice(0, 10),
        expiration_date: ""
      });
      setSupplierLotWarning(false);
      setExistingSupplierLot(null);
      setShowForm(false);
    } catch(e) { setError(e.message); }
    setLoading(false);
  }

  async function saveLot() {
    setError("");
    if (!form.quantity) { setError("Quantity is required."); return; }
    const qty = parseFloat(form.quantity);
    if (isNaN(qty) || qty <= 0) { setError("Invalid quantity."); return; }

    const today = new Date();
    const datePart = today.toISOString().slice(0, 10).replace(/-/g, '');
    const seq = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    const generatedLot = `${datePart}-${seq}`;
    const finalLotNumber = form.lot_number?.trim() ? form.lot_number.trim() : generatedLot;

    const normalized = normalizeLotNumber(finalLotNumber);
    const supplierNorm = normalizeLotNumber(ingredient.supplier || "");

    // Layer 1: UI-level check against current lots state
    const uiDuplicate = lots.find(l =>
      (l.lot_number_normalized || normalizeLotNumber(l.lot_number || "")) === normalized &&
      normalizeLotNumber(l.supplier || "") === supplierNorm
    );
    if (uiDuplicate) {
      setError("This lot number has already been assigned to this ingredient for this supplier.");
      return;
    }

    // Layer 2: DB-level check using lot_number_normalized
    const { data: freshLots, error: fetchErr } = await fetchLotsForValidation(ingredient.id, user.id);

    if (fetchErr) { setError("Could not validate lot number. Please try again."); return; }

    const dbDuplicate = (freshLots || []).find(l =>
      (l.lot_number_normalized || "") === normalized &&
      normalizeLotNumber(l.supplier || "") === supplierNorm
    );
    if (dbDuplicate) {
      setError("This lot number has already been assigned to this ingredient for this supplier.");
      return;
    }

    // Supplier lot number — find existing lot and prompt to add to it
    if (form.supplier_lot_number && form.supplier_lot_number.trim()) {
      const normSupplierLot = normalizeLotNumber(form.supplier_lot_number);
      const supplierLotExists = (freshLots || []).find(l =>
        normalizeLotNumber(l.supplier_lot_number || "") === normSupplierLot &&
        normalizeLotNumber(l.supplier || "") === supplierNorm
      );
      if (supplierLotExists && !supplierLotWarning) {
        setExistingSupplierLot(supplierLotExists);
        setSupplierLotWarning(true);
        return;
      }
    }

    setSupplierLotWarning(false);
    setExistingSupplierLot(null);
    await doSaveLot(finalLotNumber, normalized, qty);
    setShowForm(false);
    setLoading(false);
  }

  const [editLotId, setEditLotId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [editErr, setEditErr] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  function startEdit(lot) {
    setEditLotId(lot.id);
    setEditForm({
      lot_number: lot.lot_number ?? "",
      supplier_lot_number: lot.supplier_lot_number ?? "",
      supplier: lot.supplier ?? "",
      quantity: lot.quantity ?? "",
      remaining_qty: lot.remaining_qty ?? "",
      received_date: lot.received_date ?? "",
    });
    setEditErr("");
  }

  async function saveEdit() {
    setEditErr("");

    const remaining = parseFloat(editForm.remaining_qty);
    const qty = parseFloat(editForm.quantity);
    if (isNaN(remaining) || remaining < 0) { setEditErr("Remaining must be 0 or more."); return; }
    if (isNaN(qty) || qty <= 0) { setEditErr("Quantity must be greater than 0."); return; }

    const rawLot = (editForm.lot_number || "").trim();
    const normalizedLot = normalizeLotNumber(rawLot);
    const supplierNorm = normalizeLotNumber((editForm.supplier || "").trim());

    // Fetch all lots for this ingredient fresh from DB
    const { data: allLots, error: fetchErr } = await fetchLotsForEditValidation(ingredient.id, user.id);

    if (fetchErr) { setEditErr("Could not validate. Please try again."); return; }

    // Duplicate check — exclude the lot being edited
    const duplicate = (allLots || []).find(l => {
      if (String(l.id) === String(editLotId)) return false;
      const lotNorm = l.lot_number_normalized || normalizeLotNumber(l.lot_number || "");
      const sup = normalizeLotNumber((l.supplier || "").trim());
      return lotNorm === normalizedLot && sup === supplierNorm;
    });

    if (duplicate) {
      setEditErr("This lot number already exists for this ingredient and supplier.");
      return;
    }

    // Supplier lot number warning — warn but don't block
    if (editForm.supplier_lot_number && editForm.supplier_lot_number.trim()) {
      const normSupplierLot = normalizeLotNumber(editForm.supplier_lot_number);
      const supplierLotExists = (allLots || []).find(l => {
        if (String(l.id) === String(editLotId)) return false;
        return normalizeLotNumber(l.supplier_lot_number || "") === normSupplierLot &&
               normalizeLotNumber((l.supplier || "").trim()) === supplierNorm;
      });
      // In edit mode, allow same supplier lot — user is modifying existing record
    }

    setSupplierLotWarning(false);
    setExistingSupplierLot(null);
    setEditSaving(true);
    try {
      await updateLot(editLotId, {
        lot_number: rawLot,
        lot_number_normalized: normalizedLot,
        supplier_lot_number: normalizeLotNumber(editForm.supplier_lot_number) || null,
        supplier_lot_number_normalized: normalizeLotNumber(editForm.supplier_lot_number) || null,
        supplier: (editForm.supplier || "").trim() || null,
        quantity: qty,
        remaining_qty: remaining,
        received_date: editForm.received_date || null,
      });
      setEditLotId(null);
      await fetchLotsLocal();
    } catch(e) {
      setEditErr(e.message);
    }
    setEditSaving(false);
  }

  return (
    <div className="card" style={{ marginTop: 0 }}>
      <div className="section-head">
        <div className="section-title">
          Inventory Lots
          {lots.length > 0 && <span style={{ fontStyle: "normal", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 10, padding: "1px 8px", fontSize: 11, marginLeft: 8, fontWeight: 400 }}>{lots.length}</span>}
        </div>
        {!showForm && <button className="btn btn-sm btn-outline" onClick={() => setShowForm(true)}>+ Receive Inventory</button>}
      </div>

      {showForm && (
        <div style={{ marginBottom: 14 }}>
          {error && <div className="alert alert-danger" style={{ marginBottom: 8 }}>{error}</div>}
          {supplierLotWarning && (
            <div style={{ background: "#FFF8E7", border: "1px solid #F0C040", borderRadius: "var(--radius)", padding: "12px 14px", marginBottom: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#7A5C00", marginBottom: 6 }}>⚠ Supplier Lot Already Exists</div>
              <div style={{ fontSize: 13, color: "#7A5C00", marginBottom: 10 }}>
                This supplier lot already exists for this ingredient. This appears to be an additional receipt. Do you want to add to the existing lot?
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-sm btn-primary" onClick={addToExistingLot}>Add to Existing Lot</button>
                <button className="btn btn-sm btn-outline" onClick={() => { setSupplierLotWarning(false); setExistingSupplierLot(null); }}>Cancel</button>
              </div>
            </div>
          )}
          <div className="grid-2" style={{ marginBottom: 10 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Internal Lot # <span style={{ fontWeight: 400, color: "var(--muted)", fontSize: 11 }}>(optional)</span></label>
              <input value={form.lot_number} onChange={e => setForm({ ...form, lot_number: e.target.value })} placeholder="Auto-generated if blank" autoComplete="off" />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Supplier Lot # <span style={{ fontWeight: 400, color: "var(--muted)", fontSize: 11 }}>(optional)</span></label>
              <input value={form.supplier_lot_number} onChange={e => setForm({ ...form, supplier_lot_number: e.target.value })} placeholder="As printed on label" autoComplete="off" />
            </div>
          </div>
          <div className="grid-2" style={{ marginBottom: 10 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Quantity *</label>
              <div style={{ display: "flex", gap: 6 }}>
                <input type="number" min="0" step="any" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} placeholder="e.g. 500" style={{ flex: 1 }} />
                <select value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} style={{ width: 64 }}>
                  {["g","kg","oz","lb","ml","L"].map(u => <option key={u}>{u}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Received Date</label>
              <input type="date" value={form.received_date} onChange={e => setForm({ ...form, received_date: e.target.value })} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-primary" onClick={saveLot} disabled={loading}>{loading ? "Saving…" : "Save Lot"}</button>
            <button className="btn btn-outline" onClick={() => { setShowForm(false); setError(""); }}>Cancel</button>
          </div>
        </div>
      )}

      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Internal Lot</th><th>Supplier Lot</th><th>Supplier</th><th>Qty (g)</th><th>Remaining (g)</th><th>Received</th><th style={{ width: 60 }}></th></tr>
          </thead>
          <tbody>
            {lots.length === 0 ? (
              <tr><td colSpan={7} style={{ color: "var(--muted)", fontStyle: "italic", fontSize: 13, padding: "12px 8px" }}>No inventory yet</td></tr>
            ) : lots.map(lot => {
              if (editLotId === lot.id) return (
                <tr key={lot.id} style={{ background: "var(--bg)" }}>
                  <td><input value={editForm.lot_number} onChange={e => setEditForm(f => ({ ...f, lot_number: e.target.value }))} style={{ width: "100%", fontSize: 12, fontFamily: "var(--font-mono)" }} autoComplete="off" /></td>
                  <td><input value={editForm.supplier_lot_number} onChange={e => setEditForm(f => ({ ...f, supplier_lot_number: e.target.value }))} style={{ width: "100%", fontSize: 12 }} autoComplete="off" /></td>
                  <td><input value={editForm.supplier} onChange={e => setEditForm(f => ({ ...f, supplier: e.target.value }))} style={{ width: "100%", fontSize: 12 }} autoComplete="off" /></td>
                  <td><input type="number" min="0" step="any" value={editForm.quantity} onChange={e => setEditForm(f => ({ ...f, quantity: e.target.value }))} style={{ width: 80, fontSize: 12, fontFamily: "var(--font-mono)" }} /></td>
                  <td><input type="number" min="0" step="any" value={editForm.remaining_qty} onChange={e => setEditForm(f => ({ ...f, remaining_qty: e.target.value }))} style={{ width: 80, fontSize: 12, fontFamily: "var(--font-mono)" }} /></td>
                  <td><input type="date" value={editForm.received_date} onChange={e => setEditForm(f => ({ ...f, received_date: e.target.value }))} style={{ fontSize: 12 }} /></td>
                  <td>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {editErr && <div style={{ fontSize: 11, color: "var(--danger)" }}>{editErr}</div>}
                      {supplierLotWarning && (
                        <div style={{ background: "#FFF8E7", border: "1px solid #F0C040", borderRadius: 4, padding: "8px 10px", fontSize: 12, color: "#7A5C00", marginBottom: 4 }}>
                          ⚠ Supplier lot exists on another lot for this ingredient.
                          <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
                            <button className="btn btn-sm btn-outline" onClick={() => { setSupplierLotWarning(false); setExistingSupplierLot(null); }}>OK</button>
                          </div>
                        </div>
                      )}
                      <div style={{ display: "flex", gap: 4 }}>
                        <button className="btn btn-sm btn-primary" onClick={saveEdit} disabled={editSaving}>{editSaving ? "…" : "Save"}</button>
                        <button className="btn btn-sm btn-outline" onClick={() => { setEditLotId(null); setEditErr(""); }}>Cancel</button>
                      </div>
                    </div>
                  </td>
                </tr>
              );
              return (
                <tr key={lot.id}>
                  <td style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>{lot.lot_number || "—"}</td>
                  <td style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted)" }}>{lot.supplier_lot_number || "—"}</td>
                  <td style={{ color: "var(--muted)", fontSize: 13 }}>{lot.supplier || "—"}</td>
                  <td style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>{lot.quantity}g</td>
                  <td style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: lot.remaining_qty < lot.quantity * 0.2 ? "var(--danger)" : "var(--text)" }}>{lot.remaining_qty}g</td>
                  <td style={{ color: "var(--muted)", fontSize: 12 }}>{lot.received_date ? new Date(lot.received_date).toLocaleDateString() : "—"}</td>
                  <td><button className="btn btn-sm btn-outline" onClick={() => startEdit(lot)}>{Icon.edit} Edit</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}


