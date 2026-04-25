import React, { useState, useEffect } from 'react';
import { Icon } from './Icon.jsx';
import ConfirmModal from './ConfirmModal.jsx';
import IngredientModal from './IngredientModal.jsx';
import InventoryLotsSection from './InventoryLotsSection.jsx';
import { INGREDIENT_TYPES } from '../utils/constants.js';
import { ingLabel, normalizeLotNumber, parseFormulaName, sortIngredients } from '../utils/helpers.js';
import { fetchIngredients, deleteIngredient } from '../services/ingredientsService.js';
import { fetchLots, updateLot } from '../services/lotsService.js';
import { fetchAllFormulaItems, updateFormulaItemIngredient } from '../services/formulasService.js';

export default function IngredientsPage({ user, openNew, openIngredientId, nav, ingredients = [], onIngredientsChange, formulas = [], formulaItems = [] }) {
  const [modal, setModal] = useState(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [confirmDel, setConfirmDel] = useState(null);
  const [blockedDel, setBlockedDel] = useState(null);
  const [blockedDelFormulas, setBlockedDelFormulas] = useState([]);
  const [viewIng, setViewIng] = useState(null);
  const [replaceIng, setReplaceIng] = useState(null);
  const [replacementId, setReplacementId] = useState("");
  const [replaceStep, setReplaceStep] = useState(1);
  const [selectedFormulas, setSelectedFormulas] = useState([]);
  const [replacedFormulaIds, setReplacedFormulaIds] = useState([]);
  const [replaceRemaining, setReplaceRemaining] = useState(0);
  const [lots, setLots] = useState([]);
  const [showReceiveForm, setShowReceiveForm] = useState(false);
  const [editLot, setEditLot] = useState(null);
  const [editLotForm, setEditLotForm] = useState({});
  const [editLotErr, setEditLotErr] = useState("");

  function load() {
    if (onIngredientsChange) onIngredientsChange();
  }
  useEffect(() => { if (openNew) setModal("new"); }, [openNew]);
  useEffect(() => {
    if (openIngredientId && ingredients.length > 0) {
      const found = ingredients.find(i => i.id === openIngredientId);
      if (found) setViewIng(found);
    }
  }, [openIngredientId, ingredients]);
  useEffect(() => {
    if (viewIng && ingredients.length > 0) {
      const fresh = ingredients.find(i => i.id === viewIng.id);
      if (fresh) setViewIng(fresh);
    }
  }, [ingredients]);
  useEffect(() => {
    if (viewIng) {
      fetchLots(viewIng.id, user.id).then(setLots);
    } else {
      setLots([]);
      setShowReceiveForm(false);
    }
  }, [viewIng]);

  async function handleDeleteIngredient(ingredient) {
    try {
      const allItems = await fetchAllFormulaItems(user.id);
      const usedIn = allItems.filter(i => i.ingredient_id === ingredient.id);

      if (usedIn.length > 0) {
        const usedFormulaIds = [...new Set(usedIn.map(i => i.formula_id))];
        const usedFormulas = formulas.filter(f => usedFormulaIds.includes(f.id));
        setBlockedDelFormulas(usedFormulas);
        setBlockedDel(ingredient);
        return;
      }

      await deleteIngredient(ingredient.id);
      const updated = await fetchIngredients(user.id);
      onIngredientsChange(updated);

    } catch(err) {
      console.error("Delete failed:", err);
      alert("Failed to delete ingredient.");
    }
  }

  function doDelete() {
    const toDelete = confirmDel;
    setConfirmDel(null);
    handleDeleteIngredient(toDelete);
  }

  const filtered = ingredients.filter(i =>
    (!search || i.name.toLowerCase().includes(search.toLowerCase()) || (i.inci_name || "").toLowerCase().includes(search.toLowerCase())) &&
    (!typeFilter || i.type === typeFilter)
  );

  const typeCounts = INGREDIENT_TYPES.reduce((a, t) => ({ ...a, [t]: ingredients.filter(i => i.type === t).length }), {});

  // Ingredient Detail View
  if (viewIng) {
    const ing = viewIng;
    const cpg = ing.cost_per_gram || 0;
    const cpoz = cpg * 28.3495;

    // Find all formulas using this ingredient — from props
    const usedInFormulaIds = [...new Set(
      formulaItems.filter(fi => fi.ingredient_id === ing.id).map(fi => fi.formula_id)
    )];
    const usedInFormulas = formulas
      .filter(f => usedInFormulaIds.includes(f.id) && f.user_id === user.id)
      .sort((a, b) => (b.version || 1) - (a.version || 1));

    // Latest version only — deduplicate by base name for Impact calculations
    const latestByBase2 = {};
    usedInFormulas.forEach(f => {
      const bn = f.base_name || parseFormulaName(f.name).baseName;
      const v = f.version || parseFormulaName(f.name).version;
      if (!latestByBase2[bn] || v > (latestByBase2[bn].version || parseFormulaName(latestByBase2[bn].name).version)) {
        latestByBase2[bn] = f;
      }
    });
    const latestFormulaIds = new Set(Object.values(latestByBase2).map(f => f.id));

    const muted = { color: "var(--muted)" };
    const fieldLabel = { fontSize: 12, color: "var(--muted)", marginBottom: 2 };
    const emptyVal = <span style={{ color: "var(--muted)", fontStyle: "italic" }}>—</span>;

    return (
      <>
        <div className="page-header">
          <div className="page-title">{ing.name}</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-outline" onClick={() => setViewIng(null)}>← Back</button>
            <button className="btn btn-outline" onClick={() => { setModal(ing); }}>{Icon.edit} Edit</button>
          </div>
        </div>
        <div className="content">
          <div className="grid-3" style={{ marginBottom: 20 }}>
            <div className="card">
              <div style={{ fontSize: 11, ...muted, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 12, fontWeight: 500 }}>Identity</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div><div style={fieldLabel}>INCI Name</div><div style={{ fontStyle: ing.inci_name ? "normal" : "italic" }}>{ing.inci_name || emptyVal}</div></div>
                <div><div style={fieldLabel}>Type</div><div>{ing.type}</div></div>
                <div><div style={fieldLabel}>Supplier</div><div>{ing.supplier || emptyVal}</div></div>
              </div>
            </div>
            <div className="card">
              <div style={{ fontSize: 11, ...muted, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 12, fontWeight: 500 }}>Cost</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div>
                  <div style={fieldLabel}>Purchase</div>
                  <div>{ing.purchase_price && ing.purchase_qty ? `$${parseFloat(ing.purchase_price).toFixed(2)} / ${ing.purchase_qty}${ing.purchase_unit}` : emptyVal}</div>
                </div>
                <div>
                  <div style={fieldLabel}>Cost per gram</div>
                  <div style={{ fontWeight: 600, color: cpg > 0 ? "var(--accent)" : "var(--muted)", fontStyle: cpg > 0 ? "normal" : "italic" }}>{cpg > 0 ? `$${cpg.toFixed(4)}/g` : "—"}</div>
                </div>
                <div>
                  <div style={fieldLabel}>Cost per oz</div>
                  <div style={{ fontWeight: 600, color: cpoz > 0 ? "var(--accent)" : "var(--muted)", fontStyle: cpoz > 0 ? "normal" : "italic" }}>{cpoz > 0 ? `$${cpoz.toFixed(2)}/oz` : "—"}</div>
                </div>
              </div>
            </div>
            <div className="card">
              <div style={{ fontSize: 11, ...muted, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 12, fontWeight: 500 }}>Impact</div>
              {(() => {
                const latestUsages = formulaItems.filter(fi =>
                  fi.ingredient_id === ing.id && latestFormulaIds.has(fi.formula_id)
                );
                const pcts = latestUsages.map(fi => parseFloat(fi.percentage) || 0);
                const avg = pcts.length > 0 ? pcts.reduce((s, p) => s + p, 0) / pcts.length : 0;
                const maxPct = pcts.length > 0 ? Math.max(...pcts) : 0;
                const minPct = pcts.length > 0 ? Math.min(...pcts) : 0;
                const hasData = pcts.length > 0;

                // Build enriched rows for latest formulas only
                const formulaRows = Object.values(latestByBase2).map(f => {
                  const fi = formulaItems.find(x => x.formula_id === f.id && x.ingredient_id === ing.id);
                  if (!fi) return null;
                  const ingPct = parseFloat(fi.percentage) || 0;
                  const ingGrams = (ingPct / 100) * (parseFloat(f.batch_size) || 0);
                  const ingCost = ingGrams * cpg;
                  const allItems = formulaItems.filter(x => x.formula_id === f.id);
                  const totalFormulaCost = allItems.reduce((s, x) => {
                    const xIng = ingredients.find(i => i.id === x.ingredient_id);
                    return s + (parseFloat(x.percentage) / 100) * (parseFloat(f.batch_size) || 0) * (xIng?.cost_per_gram || 0);
                  }, 0);
                  const pctOfCost = totalFormulaCost > 0 ? (ingCost / totalFormulaCost) * 100 : 0;
                  const v = f.version || parseFormulaName(f.name).version;
                  const bn = f.base_name || parseFormulaName(f.name).baseName;
                  return { f, fi, bn, v, ingPct, ingCost, pctOfCost, totalFormulaCost };
                }).filter(Boolean);

                // Top cost driver = formula with highest pctOfCost
                const topDriver = [...formulaRows].sort((a, b) => b.pctOfCost - a.pctOfCost)[0];

                // Color for % of usage
                const pctColor = (p) => p > 50 ? "#7A3020" : p >= 20 ? "var(--text)" : "var(--muted)";

                return (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

                    {/* Top Cost Driver */}
                    {topDriver && cpg > 0 && (
                      <div style={{ background: "var(--bg)", borderRadius: "var(--radius)", padding: "8px 12px" }}>
                        <div style={fieldLabel}>Top Cost Driver</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
                          {topDriver.bn} <span style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--font-mono)" }}>v{topDriver.v}</span>
                          <span style={{ fontWeight: 400, color: "var(--muted)", marginLeft: 6, fontSize: 12 }}>({topDriver.pctOfCost.toFixed(0)}% of batch cost)</span>
                        </div>
                      </div>
                    )}

                    {/* Cost Impact by Formula */}
                    <div>
                      <div style={{ ...fieldLabel, marginBottom: 6 }}>Cost Impact by Formula</div>
                      {!hasData || cpg === 0 ? (
                        <div style={{ fontSize: 13, color: "var(--muted)", fontStyle: "italic" }}>No cost impact data available.</div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                          {formulaRows.map(({ f, bn, v, ingPct, ingCost, pctOfCost, totalFormulaCost }) => (
                            <div key={f.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: 13 }}>
                              <span style={{ color: "var(--text)" }}>
                                {bn} <span style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--font-mono)" }}>v{v}</span>
                              </span>
                              <span style={{ fontFamily: "var(--font-mono)", fontSize: 13 }}>
                                <span style={{ fontWeight: 700, color: "var(--text)" }}>${ingCost.toFixed(2)}</span>
                                {totalFormulaCost > 0 && (
                                  <span style={{ fontSize: 11, color: pctColor(pctOfCost), marginLeft: 5, fontWeight: pctOfCost > 50 ? 600 : 400 }}>
                                    ({pctOfCost.toFixed(0)}%)
                                  </span>
                                )}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Usage Stats */}
                    <div style={{ borderTop: "1px solid var(--border)", paddingTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                        <span style={fieldLabel}>Average usage</span>
                        <span style={{ fontWeight: 600, color: pctColor(avg) }}>{hasData ? `${avg.toFixed(1)}%` : "—"}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                        <span style={fieldLabel}>Highest</span>
                        <span style={{ fontWeight: 600, color: pctColor(maxPct) }}>{hasData ? `${maxPct.toFixed(1)}%` : "—"}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                        <span style={fieldLabel}>Lowest</span>
                        <span style={{ fontWeight: 600, color: pctColor(minPct) }}>{hasData ? `${minPct.toFixed(1)}%` : "—"}</span>
                      </div>
                      {cpg > 0 && hasData && (
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginTop: 2, paddingTop: 6, borderTop: "1px solid var(--border)" }}>
                          <span style={fieldLabel}>+5% usage adds</span>
                          <span style={{ fontWeight: 600, color: "var(--muted)", fontFamily: "var(--font-mono)", fontSize: 12 }}>
                            +${(0.05 * (Object.values(latestByBase2)[0]?.batch_size || 100) * cpg).toFixed(2)}/batch
                          </span>
                        </div>
                      )}
                    </div>

                  </div>
                );
              })()}
            </div>
          </div>

          {ing.notes && (
            <div className="card" style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, ...muted, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8, fontWeight: 500 }}>Notes</div>
              <p style={{ fontSize: 14, lineHeight: 1.6 }}>{ing.notes}</p>
            </div>
          )}

          <div className="card">
            {(() => {
              // Build groups
              const groups = {};
              usedInFormulas.forEach(f => {
                const bn = f.base_name || parseFormulaName(f.name).baseName;
                if (!groups[bn]) groups[bn] = [];
                groups[bn].push(f);
              });
              Object.values(groups).forEach(arr => arr.sort((a, b) =>
                (b.version || parseFormulaName(b.name).version) - (a.version || parseFormulaName(a.name).version)
              ));
              const currentCount = Object.keys(groups).length;
              const previousCount = usedInFormulas.length - currentCount;
              const countLabel = usedInFormulas.length === 0 ? "" :
                previousCount > 0
                  ? `${currentCount} current, ${previousCount} previous`
                  : `${currentCount} current`;

              return (
                <>
                  <div style={{ fontSize: 11, ...muted, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 12, fontWeight: 500 }}>
                    Used In Formulas
                    {usedInFormulas.length > 0 && (
                      <span style={{ fontStyle: "normal", textTransform: "none", letterSpacing: 0, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 10, padding: "1px 8px", fontSize: 11, marginLeft: 8, fontWeight: 400 }}>{countLabel}</span>
                    )}
                  </div>

                  {usedInFormulas.length === 0 ? (
                    <div style={{ fontSize: 13, ...muted, fontStyle: "italic" }}>Not used in any formulas yet.</div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                      {Object.entries(groups).map(([bn, versions], gi) => {
                        const currentVer = versions[0];
                        const prevVers = versions.slice(1);
                        const currentV = currentVer.version || parseFormulaName(currentVer.name).version;
                        return (
                          <div key={bn} style={{ paddingTop: gi > 0 ? 20 : 0, borderTop: gi > 0 ? "1px solid var(--border)" : "none" }}>

                            {/* Current Formula */}
                            <div style={{ fontSize: 10, ...muted, textTransform: "uppercase", letterSpacing: "0.8px", fontWeight: 500, marginBottom: 5 }}>Current</div>
                            <div
                              onClick={() => nav("formulas", currentVer.id)}
                              style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "6px 10px", borderRadius: "var(--radius)", cursor: "pointer", background: "#F2EBE6", border: "1px solid var(--border2)", marginBottom: prevVers.length > 0 ? 10 : 0, transition: "background 0.12s" }}
                              onMouseEnter={e => e.currentTarget.style.background = "#EBE0D8"}
                              onMouseLeave={e => e.currentTarget.style.background = "#F2EBE6"}
                            >
                              <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>{bn}</span>
                              <span style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--muted)" }}>v{currentV}</span>
                              <span style={{ fontSize: 10, background: "#EDF3EE", color: "#3D6B44", borderRadius: 4, padding: "2px 7px", fontWeight: 600 }}>Current</span>
                            </div>

                            {/* Version History */}
                            {prevVers.length > 0 && (
                              <div>
                                <div style={{ fontSize: 10, ...muted, textTransform: "uppercase", letterSpacing: "0.8px", fontWeight: 500, marginBottom: 4 }}>Version History</div>
                                <div style={{ display: "inline-flex", flexDirection: "column", gap: 2, opacity: 0.7 }}>
                                  {prevVers.map(f => {
                                    const v = f.version || parseFormulaName(f.name).version;
                                    return (
                                      <div key={f.id}
                                        onClick={() => nav("formulas", f.id)}
                                        style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "4px 10px", borderRadius: "var(--radius)", cursor: "pointer", background: "transparent", transition: "background 0.12s" }}
                                        onMouseEnter={e => e.currentTarget.style.background = "#EBE0D8"}
                                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                                      >
                                        <span style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--muted)", minWidth: 28 }}>v{v}</span>
                                        <span style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.2px" }}>Previous</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
          {/* Inventory Lots */}
          <InventoryLotsSection user={user} ingredient={viewIng} />
        </div>

        {modal && (
          <IngredientModal
            user={user}
            ingredient={modal === "new" ? null : modal}
            ingredients={ingredients}
            onClose={() => setModal(null)}
            onSave={async (newIngId) => {
              setModal(null);
              await load();
              if (newIngId) {
                const fresh = await fetchLots(newIngId, user.id);
                setLots(fresh);
              }
            }}
          />
        )}

        {editLot && (
          <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setEditLot(null)}>
            <div className="modal" style={{ maxWidth: 420 }}>
              <div className="modal-header">
                <div className="modal-title">Edit Lot</div>
                <button className="close-btn" onClick={() => setEditLot(null)}>{Icon.x}</button>
              </div>
              <div className="modal-body">
                {editLotErr && <div className="alert alert-danger" style={{ marginBottom: 12 }}>{editLotErr}</div>}
                <div className="form-group">
                  <label>Lot Number</label>
                  <input
                    value={editLotForm.lot_number ?? ""}
                    onChange={e => setEditLotForm(f => ({ ...f, lot_number: e.target.value }))}
                    placeholder="e.g. LOT-2024-001"
                  />
                </div>
                <div className="form-group">
                  <label>Supplier</label>
                  <input
                    value={editLotForm.supplier || ""}
                    onChange={e => setEditLotForm(f => ({ ...f, supplier: e.target.value }))}
                    placeholder="Supplier name"
                  />
                </div>
                <div className="grid-2" style={{ marginBottom: 12 }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Remaining Qty (g) *</label>
                    <input
                      type="number" min="0" step="any"
                      value={editLotForm.remaining_qty}
                      onChange={e => setEditLotForm(f => ({ ...f, remaining_qty: e.target.value }))}
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Total Qty (g)</label>
                    <input
                      type="number" min="0" step="any"
                      value={editLotForm.quantity}
                      onChange={e => setEditLotForm(f => ({ ...f, quantity: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>Received Date</label>
                  <input
                    type="date"
                    value={editLotForm.received_date || ""}
                    onChange={e => setEditLotForm(f => ({ ...f, received_date: e.target.value }))}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-outline" onClick={() => { setEditLot(null); setEditLotErr(""); }}>Cancel</button>
                <button className="btn btn-primary" onClick={async () => {
                  setEditLotErr("");
                  const remaining = parseFloat(editLotForm.remaining_qty);
                  const qty = parseFloat(editLotForm.quantity);
                  if (isNaN(remaining) || remaining < 0) { setEditLotErr("Remaining quantity must be 0 or greater."); return; }
                  if (isNaN(qty) || qty <= 0) { setEditLotErr("Total quantity must be greater than 0."); return; }

                  const rawLot = (editLotForm.lot_number || "").trim();
                  const normalizedLot = normalizeLotNumber(rawLot);
                  const supplierNorm = normalizeLotNumber((editLotForm.supplier || "").trim());

                  // Fetch all lots fresh and check for duplicates excluding self
                  const { data: allLots, error: fetchErr } = await sb
                    .from("inventory_lots")
                    .select("id, lot_number, lot_number_normalized, supplier")
                    .eq("ingredient_id", editLot.ingredient_id)
                    .eq("user_id", user.id);

                  if (fetchErr) { setEditLotErr("Could not validate. Please try again."); return; }

                  const duplicate = (allLots || []).find(l => {
                    if (String(l.id) === String(editLot.id)) return false;
                    const lotNorm = l.lot_number_normalized || normalizeLotNumber(l.lot_number || "");
                    const sup = normalizeLotNumber((l.supplier || "").trim());
                    return lotNorm === normalizedLot && sup === supplierNorm;
                  });

                  if (duplicate) { setEditLotErr("This lot number already exists for this ingredient and supplier."); return; }

                  try {
                    console.log("UPDATE LOT CALLED", editLot.id, { lot_number: rawLot, lot_number_normalized: normalizedLot, supplier: editLotForm.supplier || null, remaining_qty: remaining, quantity: qty, received_date: editLotForm.received_date || null });
                    await updateLot(editLot.id, {
                      lot_number: rawLot,
                      lot_number_normalized: normalizedLot,
                      supplier_lot_number_normalized: normalizeLotNumber(editLotForm.supplier_lot_number || "") || null,
                      supplier: editLotForm.supplier || null,
                      remaining_qty: remaining,
                      quantity: qty,
                      received_date: editLotForm.received_date || null,
                    });
                    const fresh = await fetchLots(viewIng.id, user.id);
                    setLots(fresh);
                    setEditLot(null);
                  } catch(e) { setEditLotErr(e.message); }
                }}>Save Changes</button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Ingredients</div>
          <div className="page-sub">{ingredients.length} ingredient{ingredients.length !== 1 ? "s" : ""} in your library</div>
        </div>
        <button className="btn btn-primary" onClick={() => setModal("new")}>{Icon.plus} Add Ingredient</button>
      </div>
      <div className="content">
        <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
          <input style={{ maxWidth: 280 }} placeholder="Search by name or INCI..." value={search} onChange={e => setSearch(e.target.value)} />
          <select style={{ width: 160 }} value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
            <option value="">All types</option>
            {INGREDIENT_TYPES.filter(t => typeCounts[t] > 0).map(t => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div className="table-wrap">
          {filtered.length === 0 ? (
            <div className="empty-state"><div className="icon">🌿</div><p>{ingredients.length === 0 ? "Add your first ingredient to get started" : "No ingredients match your search"}</p></div>
          ) : (
            <table>
              <thead><tr><th>Name</th><th>INCI Name</th><th>Type</th><th>Purchase</th><th>Cost/g</th><th>Cost/oz</th><th>Supplier</th><th>Available (g)</th><th></th><th style={{ width: 80 }}></th></tr></thead>
              <tbody>
                {filtered.map(ing => {
                  return (
                  <tr key={ing.id}
                    onClick={() => setViewIng(ing)}
                    style={{ cursor: "pointer" }}
                  >
                    <td style={{ fontWeight: 500 }}>{ing.name}</td>
                    <td style={{ color: "var(--muted)", fontStyle: "italic", fontSize: 12 }}>{ing.inci_name || "—"}</td>
                    <td><span className="tag">{ing.type}</span></td>
                    <td className="mono" style={{ fontSize: 12 }}>{ing.purchase_price && ing.purchase_qty ? `$${parseFloat(ing.purchase_price).toFixed(2)} / ${ing.purchase_qty}${ing.purchase_unit}` : "—"}</td>
                    <td className="mono">{ing.cost_per_gram > 0 ? `$${ing.cost_per_gram.toFixed(4)}` : "—"}</td>
                    <td className="mono">{ing.cost_per_gram > 0 ? `$${(ing.cost_per_gram * 28.3495).toFixed(2)}` : "—"}</td>
                    <td style={{ color: "var(--muted)" }}>{ing.supplier || "—"}</td>
                    <td className="mono qty-cell">
                      <span className={ing.inventory_status === "critical" ? "qty-critical" : ing.inventory_status === "low" ? "qty-low" : ing.inventory_status === "ok" ? "qty-ok" : ""}>
                        {Math.round(ing.available_qty ?? 0)}g
                      </span>
                    </td>
                    <td></td>
                    <td onClick={e => e.stopPropagation()}>
                      <div style={{ display: "flex", gap: 4 }}>
                        <span className="tip" data-tip="Edit Ingredient">
                          <button className="btn btn-sm btn-outline" aria-label="Edit Ingredient" onClick={() => setModal(ing)}>{Icon.edit}</button>
                        </span>
                        <span className="tip" data-tip="Delete Ingredient">
                          <button className="btn btn-sm btn-danger" aria-label="Delete Ingredient" onClick={() => handleDeleteIngredient(ing)}>{Icon.trash}</button>
                        </span>
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
      {modal && (
        <IngredientModal
          user={user}
          ingredient={modal === "new" ? null : modal}
          ingredients={ingredients}
          onClose={() => setModal(null)}
          onSave={() => { setModal(null); load(); }}
        />
      )}
      {confirmDel && (
        <ConfirmModal
          title="Delete Ingredient"
          message={`Are you sure you want to delete "${confirmDel.name}"? This cannot be undone.`}
          confirmLabel="Delete"
          onConfirm={doDelete}
          onCancel={() => setConfirmDel(null)}
        />
      )}
      {blockedDel && (() => {
        const usedInFormulas = blockedDelFormulas;
        return (
          <div className="modal-backdrop" style={{ zIndex: 300 }}>
            <div className="modal" style={{ maxWidth: 400 }}>
              <div className="modal-header">
                <div className="modal-title">Cannot Delete Ingredient</div>
              </div>
              <div className="modal-body">
                <p style={{ fontSize: 14, lineHeight: 1.6, color: "var(--muted)" }}>
                  <strong style={{ color: "var(--text)" }}>{blockedDel.name}</strong> is used in one or more formulas and cannot be deleted.
                </p>
                <p style={{ fontSize: 13, marginTop: 8, color: "var(--muted)", lineHeight: 1.6 }}>
                  To remove this ingredient, you must first replace or remove it from the formulas where it is used.
                </p>
                {usedInFormulas.length > 0 && (
                  <p style={{ fontSize: 13, marginTop: 10, color: "var(--muted)" }}>
                    <span style={{ color: "var(--text)", fontWeight: 500 }}>Used in: </span>
                    {usedInFormulas.map((f, i) => (
                      <span key={f.id}>
                        <span
                          style={{ color: "var(--accent)", cursor: "pointer", textDecoration: "underline" }}
                          onClick={() => { setBlockedDel(null); nav("formulas", f.id); }}
                        >{f.name}</span>
                        {i < usedInFormulas.length - 1 ? ", " : ""}
                      </span>
                    ))}
                  </p>
                )}
              </div>
              <div className="modal-footer">
                <button className="btn btn-outline" onClick={() => { setBlockedDel(null); setBlockedDelFormulas([]); }}>Close</button>
                <button className="btn btn-primary" onClick={() => { setReplacementId(""); setReplaceStep(1); setSelectedFormulas([]); setReplacedFormulaIds([]); setReplaceIng(blockedDel); setBlockedDel(null); }}>Replace Ingredient</button>
              </div>
            </div>
          </div>
        );
      })()}
      {replaceIng && (() => {
        const others = ingredients.filter(i => i.id !== replaceIng.id);
        const replacementIng = others.find(i => i.id === replacementId);

        const everUsedIds = [...new Set(formulaItems.filter(fi => fi.ingredient_id === replaceIng.id).map(fi => fi.formula_id))];
        const allRelevantIds = [...new Set([...everUsedIds, ...replacedFormulaIds])];
        const allRelevantFormulas = formulas.filter(f => allRelevantIds.includes(f.id));
        const stillUsedIds = new Set(formulaItems.filter(fi => fi.ingredient_id === replaceIng.id).map(fi => fi.formula_id));

        function toggleFormula(id) {
          if (!stillUsedIds.has(id)) return; // can't select already-replaced
          setSelectedFormulas(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
        }

        if (replaceStep === 1) return (
          <div className="modal-backdrop" style={{ zIndex: 300 }}>
            <div className="modal" style={{ maxWidth: 420 }}>
              <div className="modal-header">
                <div className="modal-title">Replace Ingredient — Step 1 of 2</div>
                <button className="close-btn" onClick={() => { setReplaceIng(null); setReplacedFormulaIds([]); }}>{Icon.x}</button>
              </div>
              <div className="modal-body">
                <p style={{ fontSize: 14, color: "var(--muted)", marginBottom: 14, lineHeight: 1.6 }}>
                  Choose a replacement for <strong style={{ color: "var(--text)" }}>{replaceIng.name}</strong>. You will select which formulas to update in the next step.
                </p>
                <div className="form-group">
                  <label>Replace with</label>
                  <select value={replacementId} onChange={e => setReplacementId(e.target.value)}>
                    <option value="">Select an ingredient…</option>
                    {sortIngredients(others).map(i => <option key={i.id} value={i.id}>{ingLabel(i)}</option>)}
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-outline" onClick={() => { setReplaceIng(null); setReplacedFormulaIds([]); }}>Cancel</button>
                <button
                  className="btn btn-primary"
                  disabled={!replacementId}
                  style={{ opacity: replacementId ? 1 : 0.4, cursor: replacementId ? "pointer" : "not-allowed" }}
                  onClick={() => { setSelectedFormulas([...stillUsedIds]); setReplaceStep(2); }}
                >Continue</button>
              </div>
            </div>
          </div>
        );

        if (replaceStep === 2) return (
          <div className="modal-backdrop" style={{ zIndex: 300 }}>
            <div className="modal" style={{ maxWidth: 420 }}>
              <div className="modal-header">
                <div className="modal-title">Replace Ingredient — Step 2 of 2</div>
                <button className="close-btn" onClick={() => { setReplaceIng(null); setReplacedFormulaIds([]); }}>{Icon.x}</button>
              </div>
              <div className="modal-body">
                <p style={{ fontSize: 14, color: "var(--muted)", marginBottom: 14, lineHeight: 1.6 }}>
                  {replacedFormulaIds.length > 0
                    ? <>Some formulas have already been updated. Select remaining formulas to apply replacement.</>
                    : <>Replace <strong style={{ color: "var(--text)" }}>{replaceIng.name}</strong> with <strong style={{ color: "var(--text)" }}>{replacementIng?.name}</strong>. Uncheck any formulas you want to skip.</>
                  }
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {allRelevantFormulas.map(f => {
                    const alreadyReplaced = replacedFormulaIds.includes(f.id);
                    const canSelect = stillUsedIds.has(f.id);
                    const checked = selectedFormulas.includes(f.id);
                    return (
                      <label key={f.id} style={{
                        display: "flex", alignItems: "center", gap: 10,
                        cursor: canSelect ? "pointer" : "default",
                        fontSize: 14, padding: "8px 12px",
                        borderRadius: "var(--radius)",
                        border: `1px solid ${alreadyReplaced ? "#c8e6c9" : checked ? "var(--accent)" : "var(--border)"}`,
                        background: alreadyReplaced ? "#f0faf4" : checked ? "#f7fdf9" : "#fff",
                        opacity: alreadyReplaced ? 0.55 : 1,
                        pointerEvents: alreadyReplaced ? "none" : "auto"
                      }}>
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={alreadyReplaced}
                          onChange={() => toggleFormula(f.id)}
                          style={{ width: 16, height: 16, accentColor: "var(--accent)", cursor: canSelect ? "pointer" : "default", flexShrink: 0 }}
                        />
                        <span style={{ flex: 1, color: alreadyReplaced ? "var(--muted)" : "var(--text)" }}>{f.name}</span>
                        {alreadyReplaced
                          ? <span style={{ fontSize: 11, color: "#2E7D32", fontFamily: "var(--font-body)", background: "#e8f5e9", padding: "2px 6px", borderRadius: 4 }}>✓ Replaced</span>
                          : <span style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--font-body)" }}>Pending</span>
                        }
                      </label>
                    );
                  })}
                </div>
                {selectedFormulas.length === 0 && stillUsedIds.size > 0 && (
                  <p style={{ fontSize: 12, color: "var(--danger)", marginTop: 10 }}>Select at least one formula to apply.</p>
                )}
                {stillUsedIds.size === 0 && (
                  <p style={{ fontSize: 12, color: "var(--accent)", marginTop: 10 }}>All formulas have been updated.</p>
                )}
              </div>
              <div className="modal-footer">
                <button className="btn btn-outline" onClick={() => setReplaceStep(1)}>← Back</button>
                <button
                  className="btn btn-primary"
                  disabled={selectedFormulas.length === 0}
                  style={{ opacity: selectedFormulas.length > 0 ? 1 : 0.4, cursor: selectedFormulas.length > 0 ? "pointer" : "not-allowed" }}
                  onClick={async () => {
                    // Update each affected formula_item in Supabase
                    const toUpdate = formulaItems.filter(fi =>
                      fi.ingredient_id === replaceIng.id && selectedFormulas.includes(fi.formula_id)
                    );
                    try {
                      await Promise.all(toUpdate.map(fi =>
                        updateFormulaItemIngredient(fi.id, replacementId)
                      ));
                    } catch(e) {
                      console.error("replace formula_items:", e.message);
                    }
                    load();
                    const nowReplaced = [...new Set([...replacedFormulaIds, ...selectedFormulas])];
                    setReplacedFormulaIds(nowReplaced);
                    setSelectedFormulas([]);
                    const remaining = formulaItems.filter(fi =>
                      fi.ingredient_id === replaceIng.id && !nowReplaced.includes(fi.formula_id)
                    ).length;
                    if (remaining === 0) {
                      const ing = replaceIng;
                      setReplaceIng(null);
                      setReplacedFormulaIds([]);
                      setReplaceStep(1);
                      setReplacementId("");
                      setReplaceRemaining(0);
                      setConfirmDel(ing);
                    } else {
                      setReplaceRemaining(remaining);
                      setReplaceStep(3);
                    }
                  }}
                >Apply Replacement</button>
              </div>
            </div>
          </div>
        );

        if (replaceStep === 3) return (
          <div className="modal-backdrop" style={{ zIndex: 300 }}>
            <div className="modal" style={{ maxWidth: 420 }}>
              <div className="modal-header">
                <div className="modal-title">Replacement Applied</div>
              </div>
              <div className="modal-body">
                <p style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.6 }}>
                  Replacement applied to selected formulas.{" "}
                  <strong style={{ color: "var(--text)" }}>{replaceRemaining}</strong>{" "}
                  formula{replaceRemaining !== 1 ? "s" : ""} still {replaceRemaining !== 1 ? "use" : "uses"} <strong style={{ color: "var(--text)" }}>{replaceIng.name}</strong>.
                </p>
              </div>
              <div className="modal-footer">
                <button className="btn btn-outline" onClick={() => { setReplaceIng(null); setReplacedFormulaIds([]); setReplaceStep(1); setReplacementId(""); setReplaceRemaining(0); }}>Close</button>
                <button className="btn btn-primary" onClick={() => { setReplacementId(""); setReplaceStep(1); }}>Continue Replacing</button>
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
}

