import React, { useState } from 'react';
import { Icon } from './Icon.jsx';
import ConfirmModal from './ConfirmModal.jsx';
import { uid, ingLabel, sortIngredients, parseFormulaName, nextVersionFor } from '../utils/helpers.js';
import { insertFormula, insertFormulaItems } from '../services/formulasService.js';

export default function FormulaModal({ user, formula, onClose, onSave, onAddIngredient, ingredients: userIngredients = [], formulaItems = [], formulas = [] }) {
  const existingItems = formula ? formulaItems.filter(fi => fi.formula_id === formula.id) : [];

  // Use base_name for editing — the version suffix is auto-assigned on save
  const initName = formula ? (formula.base_name || parseFormulaName(formula.name).baseName) : "";
  const [name, setName] = useState(initName);
  const [batchSize, setBatchSize] = useState(formula?.batch_size || 100);
  const [notes, setNotes] = useState(formula?.notes || "");
  const [items, setItems] = useState(
    existingItems.map(fi => ({ id: fi.id || uid(), ingredient_id: fi.ingredient_id, percentage: fi.percentage }))
  );
  const [err, setErr] = useState("");
  const [removeMsg, setRemoveMsg] = useState("");
  const [confirmRowId, setConfirmRowId] = useState(null);
  const [dupPrompt, setDupPrompt] = useState(null); // {rowId, ingredientId}
  const [showDupSaveWarn, setShowDupSaveWarn] = useState(false);
  const [showZeroWarn, setShowZeroWarn] = useState(false);

  const totalPct = items.reduce((s, it) => s + (parseFloat(it.percentage) || 0), 0);

  // Check if a given ingredient_id appears more than once in items
  function isDup(ingredient_id) {
    return ingredient_id && items.filter(i => i.ingredient_id === ingredient_id).length > 1;
  }

  function addItem() {
    if (userIngredients.length === 0) { setErr("Add ingredients to your library first."); return; }
    const used = items.map(i => i.ingredient_id);
    const allUsed = userIngredients.every(i => used.includes(i.id));
    if (allUsed) { setErr("All ingredients already added."); return; }
    setItems([...items, { id: uid(), ingredient_id: "", percentage: 0, allowDup: false }]);
  }

  function handleIngredientChange(rowId, newIngId) {
    if (!newIngId) { updateItem(rowId, "ingredient_id", newIngId); return; }
    const alreadyInList = items.some(i => i.id !== rowId && i.ingredient_id === newIngId);
    if (alreadyInList) {
      const thisRow = items.find(i => i.id === rowId);
      setDupPrompt({ rowId, ingredientId: newIngId, newPct: parseFloat(thisRow?.percentage || 0) });
      return;
    }
    updateItem(rowId, "ingredient_id", newIngId);
  }

  function mergeDuplicates() {
    const seen = {};
    const merged = [];
    items.forEach(item => {
      if (!item.ingredient_id) { merged.push(item); return; }
      if (seen[item.ingredient_id] !== undefined) {
        merged[seen[item.ingredient_id]].percentage =
          parseFloat(merged[seen[item.ingredient_id]].percentage || 0) +
          parseFloat(item.percentage || 0);
      } else {
        seen[item.ingredient_id] = merged.length;
        merged.push({ ...item, percentage: parseFloat(item.percentage || 0) });
      }
    });
    setItems(merged.map(i => ({ ...i, percentage: parseFloat(i.percentage.toFixed(4)) })));
  }

  function removeItem(id) {
    const item = items.find(i => i.id === id);
    if (item.ingredient_id && parseFloat(item.percentage) > 0) {
      setConfirmRowId(id);
      return;
    }
    setItems(items.filter(i => i.id !== id));
  }
  function doRemoveRow() {
    const item = items.find(i => i.id === confirmRowId);
    const ing = userIngredients.find(i => i.id === item?.ingredient_id);
    setRemoveMsg(`"${ing ? ing.name : "Ingredient"}" removed`);
    setTimeout(() => setRemoveMsg(""), 2500);
    setItems(items.filter(i => i.id !== confirmRowId));
    setConfirmRowId(null);
  }
  function updateItem(id, field, val) { setItems(items.map(i => i.id === id ? { ...i, [field]: val } : i)); }

  function save(force = false) {
    if (!name.trim()) { setErr("Formula name required."); return; }
    if (items.length === 0) { setErr("Add at least one ingredient."); return; }
    if (items.some(it => !it.ingredient_id)) { setErr("One or more rows have no ingredient selected."); return; }
    const t = parseFloat(totalPct.toFixed(4));
    if (Math.abs(t - 100) > 0.01) { setErr(`Percentages must total 100% (currently ${t.toFixed(2)}%)`); return; }
    const ids = items.map(i => i.ingredient_id);
    const hasDups = ids.some((id, idx) => ids.indexOf(id) !== idx);
    if (hasDups && !force) { setShowDupSaveWarn(true); return; }
    const hasZero = items.some(it => it.ingredient_id && (parseFloat(it.percentage) || 0) === 0);
    if (hasZero && !force) { setShowZeroWarn(true); return; }

    const now = new Date().toISOString();
    const snapshot = {
      batch_size: parseFloat(batchSize) || 100,
      ingredients: items.map(it => {
        const ing = userIngredients.find(i => i.id === it.ingredient_id);
        return { name: ing?.name || "Unknown", percentage: parseFloat(it.percentage) || 0 };
      })
    };

    let formulaRecord;
    if (formula) {
      const baseName = formula.base_name || parseFormulaName(formula.name).baseName;
      const nextVer = nextVersionFor(baseName, user.id, formulas);
      formulaRecord = {
        user_id: user.id, name: `${baseName} v${nextVer}`, base_name: baseName,
        version: nextVer, batch_size: parseFloat(batchSize) || 100,
        notes: notes || null, created_at: now, updated_at: now, snapshot
      };
    } else {
      const baseName = name.replace(/ v\d+$/i, "").trim();
      formulaRecord = {
        user_id: user.id, name: `${baseName} v1`, base_name: baseName,
        version: 1, batch_size: parseFloat(batchSize) || 100,
        notes: notes || null, created_at: now, updated_at: now, snapshot
      };
    }

    insertFormula(formulaRecord).then(inserted => {
      const newItems = items.map(it => ({
        formula_id: inserted.id,
        ingredient_id: it.ingredient_id,
        percentage: parseFloat(it.percentage) || 0
      }));
      return insertFormulaItems(newItems).then(() => inserted.id);
    }).then(fid => {
      onSave(fid);
    }).catch(e => {
      setErr(e.message);
    });
  }

  const isExact100 = Math.abs(totalPct - 100) < 0.01;
  const isOver = totalPct > 100;
  const remaining = parseFloat((100 - totalPct).toFixed(4));
  const pctBarColor = isExact100 ? "var(--accent)" : isOver ? "var(--danger)" : "var(--warn)";
  const pctWidth = Math.min(totalPct, 100);

  const [showDiscard, setShowDiscard] = useState(false);

  const originalName = formula ? (formula.base_name || parseFormulaName(formula.name).baseName) : "";
  const originalBatch = formula?.batch_size || 100;
  const originalNotes = formula?.notes || "";
  const originalItems = existingItems.map(fi => fi.ingredient_id + ":" + fi.percentage).sort().join(",");
  const currentItems = items.map(i => i.ingredient_id + ":" + i.percentage).sort().join(",");
  const hasChanges = name !== originalName || String(batchSize) !== String(originalBatch) || notes !== originalNotes || currentItems !== originalItems;

  function confirmClose() {
    if (hasChanges) { setShowDiscard(true); return; }
    onClose();
  }

  return (
    <>
      {showDiscard && (
        <ConfirmModal
          title="Unsaved Changes"
          message="You have unsaved changes. If you leave now they will be lost."
          confirmLabel="Discard Changes"
          confirmStyle="btn-danger"
          onConfirm={onClose}
          onCancel={() => setShowDiscard(false)}
        />
      )}
      {confirmRowId && (
        <ConfirmModal
          title="Remove Ingredient"
          message={`Remove "${userIngredients.find(i => i.id === items.find(r => r.id === confirmRowId)?.ingredient_id)?.name || "this ingredient"}" from the formula?`}
          confirmLabel="Remove"
          confirmStyle="btn-danger"
          onConfirm={doRemoveRow}
          onCancel={() => setConfirmRowId(null)}
        />
      )}
      {dupPrompt && (() => {
        const dupIng = userIngredients.find(i => i.id === dupPrompt.ingredientId);
        const existingRow = items.find(i => i.id !== dupPrompt.rowId && i.ingredient_id === dupPrompt.ingredientId);
        const existingPct = parseFloat(existingRow?.percentage || 0);
        const newPct = dupPrompt.newPct || 0;
        const combinedPct = parseFloat((existingPct + newPct).toFixed(4));
        const canUpdate = newPct > 0 && existingRow;
        return (
          <div className="modal-backdrop" style={{ zIndex: 300 }}>
            <div className="modal" style={{ maxWidth: 400 }}>
              <div className="modal-header"><div className="modal-title">Duplicate Ingredient</div></div>
              <div className="modal-body">
                <p style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.6, marginBottom: 14 }}>
                  <strong style={{ color: "var(--text)" }}>{dupIng?.name || "This ingredient"}</strong> already exists in this formula.
                </p>
                <div className="form-group">
                  <label>Amount to add (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={newPct || ""}
                    placeholder="Enter percentage to add (e.g. 5)"
                    onChange={e => setDupPrompt({ ...dupPrompt, newPct: parseFloat(e.target.value) || 0 })}
                    autoFocus
                  />
                  {newPct === 0 && <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>Enter a value before updating existing entry.</div>}
                </div>
                {canUpdate && (
                  <p style={{ fontSize: 13, color: "var(--muted)", background: "#F7F5F0", padding: "8px 12px", borderRadius: "var(--radius)", lineHeight: 1.6 }}>
                    Existing: <strong style={{ color: "var(--text)" }}>{existingPct}%</strong>
                    {" "}+ New: <strong style={{ color: "var(--text)" }}>{newPct}%</strong>
                    {" "}= <strong style={{ color: "var(--accent)" }}>{combinedPct}%</strong>
                  </p>
                )}
              </div>
              <div className="modal-footer" style={{ flexWrap: "wrap", gap: 8 }}>
                <button className="btn btn-outline" onClick={() => setDupPrompt(null)}>Do Not Add</button>
                <button
                  className="btn btn-outline"
                  disabled={!canUpdate}
                  style={{ opacity: canUpdate ? 1 : 0.4, cursor: canUpdate ? "pointer" : "not-allowed" }}
                  onClick={() => {
                    if (existingRow) {
                      setItems(
                        items
                          .filter(i => i.id !== dupPrompt.rowId)
                          .map(i => i.id === existingRow.id ? { ...i, percentage: combinedPct } : i)
                      );
                      setRemoveMsg(`Updated ${dupIng?.name || "ingredient"} to ${combinedPct}%`);
                      setTimeout(() => setRemoveMsg(""), 2500);
                    }
                    setDupPrompt(null);
                  }}>Update Existing Entry</button>
                <button className="btn btn-primary" onClick={() => {
                  // Add the ingredient AND carry over the entered percentage
                  setItems(items.map(i => i.id === dupPrompt.rowId
                    ? { ...i, ingredient_id: dupPrompt.ingredientId, percentage: newPct || 0 }
                    : i
                  ));
                  setDupPrompt(null);
                }}>Add Anyway</button>
              </div>
            </div>
          </div>
        );
      })()}
      {showDupSaveWarn && (
        <div className="modal-backdrop" style={{ zIndex: 300 }}>
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="modal-header"><div className="modal-title">Duplicate Ingredients</div></div>
            <div className="modal-body">
              <p style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.6 }}>
                This formula contains duplicate ingredients. How would you like to proceed?
              </p>
            </div>
            <div className="modal-footer" style={{ flexWrap: "wrap", gap: 8 }}>
              <button className="btn btn-outline" onClick={() => setShowDupSaveWarn(false)}>Cancel</button>
              <button className="btn btn-outline" onClick={() => { setShowDupSaveWarn(false); save(true); }}>Keep As-Is</button>
              <button className="btn btn-primary" onClick={() => { setShowDupSaveWarn(false); mergeDuplicates(); }}>Merge Duplicates</button>
            </div>
          </div>
        </div>
      )}
      {showZeroWarn && (
        <div className="modal-backdrop" style={{ zIndex: 300 }}>
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="modal-header"><div className="modal-title">Zero Percentage Ingredients</div></div>
            <div className="modal-body">
              <p style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.6 }}>
                One or more ingredients have 0%. They will not contribute to the formula. How would you like to proceed?
              </p>
            </div>
            <div className="modal-footer" style={{ flexWrap: "wrap", gap: 8 }}>
              <button className="btn btn-outline" onClick={() => setShowZeroWarn(false)}>Review Formula</button>
              <button className="btn btn-outline" onClick={() => { setShowZeroWarn(false); save(true); }}>Keep As-Is</button>
              <button className="btn btn-primary" onClick={() => {
                setShowZeroWarn(false);
                setItems(items.filter(it => !it.ingredient_id || (parseFloat(it.percentage) || 0) > 0));
              }}>Remove 0% Ingredients</button>
            </div>
          </div>
        </div>
      )}
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && confirmClose()}>
      <div className="modal" style={{ maxWidth: 640 }}>
        <div className="modal-header">
          <div className="modal-title">{formula ? `Edit Formula — new version will be created` : "New Formula"}</div>
          <button className="close-btn" onClick={confirmClose}>{Icon.x}</button>
        </div>
        <div className="modal-body">
          {err && <div className="alert alert-danger">{err}</div>}
          {removeMsg && <div style={{ background: "#e8f5e9", border: "1px solid #c8e6c9", color: "#2E7D32", padding: "10px 14px", borderRadius: "var(--radius)", fontSize: 13, marginBottom: 14 }}>✓ {removeMsg}</div>}
          <div className="grid-2">
            <div className="form-group"><label>Formula Name *</label><input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Whipped Body Butter" /></div>
            <div className="form-group"><label>Batch Size (g)</label><input type="number" min="1" value={batchSize} onChange={e => setBatchSize(e.target.value)} /></div>
          </div>
          <div className="form-group"><label>Notes</label><textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Formula notes, instructions..." /></div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <div className="section-title">Ingredients</div>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ textAlign: "right" }}>
                <span className="mono" style={{ fontSize: 13, fontWeight: 600, color: pctBarColor }}>
                  {totalPct.toFixed(2)}%
                </span>
                <span style={{ fontSize: 11, color: "var(--muted)", marginLeft: 4 }}>/ 100%</span>
              </div>
              <button className="btn btn-outline btn-sm" onClick={addItem}>{Icon.plus} Add</button>
            </div>
          </div>
          <div className="pct-bar-wrap"><div className="pct-bar" style={{ width: `${pctWidth}%`, background: pctBarColor }} /></div>
          {items.length > 0 && !isExact100 && (
            <div style={{ marginTop: 8, padding: "10px 14px", borderRadius: "var(--radius)", background: isOver ? "#fdf2f0" : "#fffbf0", border: `1px solid ${isOver ? "#f5c6c2" : "#ffe4a0"}`, color: isOver ? "var(--danger)" : "#92600a", fontSize: 13, fontWeight: 500 }}>
              {isOver
                ? `⚠ Over by ${Math.abs(remaining).toFixed(2)}% — reduce ingredients before saving.`
                : `⚠ ${remaining.toFixed(2)}% remaining — formula must total exactly 100% to save.`}
            </div>
          )}
          {!isExact100 && items.length > 0 && items.length === userIngredients.length && (
            <div style={{ marginTop: 8, padding: "10px 14px", borderRadius: "var(--radius)", background: "#f0f4ff", border: "1px solid #c7d4f5", color: "#2c4a9e", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <span>No additional ingredients available. Add more ingredients to your library to complete this formula.</span>
              <button className="btn btn-sm" style={{ background: "#2c4a9e", color: "#fff", border: "none", whiteSpace: "nowrap", flexShrink: 0 }} onClick={() => { onClose(); onAddIngredient(); }}>+ Add Ingredient</button>
            </div>
          )}
          {items.some((item, idx) => item.ingredient_id && items.findIndex(i => i.ingredient_id === item.ingredient_id) !== idx) && (
            <div style={{ marginTop: 8, padding: "10px 14px", borderRadius: "var(--radius)", background: "#fffbf0", border: "1px solid #ffe4a0", color: "#92600a", fontSize: 13 }}>
              ⚠ Duplicate ingredient detected. This ingredient appears more than once in the formula.
            </div>
          )}
          {items.some(it => it.ingredient_id && (parseFloat(it.percentage) || 0) === 0) && (
            <div style={{ marginTop: 8, padding: "10px 14px", borderRadius: "var(--radius)", background: "#fdf2f0", border: "1px solid #f5c6c2", color: "var(--danger)", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <span>⚠ One or more ingredients have 0%. Update or remove them before saving.</span>
              <button className="btn btn-sm btn-danger" style={{ whiteSpace: "nowrap", flexShrink: 0 }} onClick={() => setItems(items.filter(it => !it.ingredient_id || (parseFloat(it.percentage) || 0) > 0))}>Remove 0% ingredients</button>
            </div>
          )}

          <div style={{ marginTop: 12 }}>
            {items.length === 0 && <div style={{ color: "var(--muted)", fontSize: 13, padding: "12px 0" }}>No ingredients added yet.</div>}
            {items.map((item, idx) => {
              const ing = userIngredients.find(i => i.id === item.ingredient_id);
              const grams = ((parseFloat(item.percentage) || 0) / 100) * (parseFloat(batchSize) || 0);
              const cost = grams * (ing?.cost_per_gram || 0);
              // Primary = first occurrence of this ingredient_id, BUT only if a duplicate also exists
              const firstOccurrenceIdx = item.ingredient_id ? items.findIndex(i => i.ingredient_id === item.ingredient_id) : -1;
              const occurrenceCount = item.ingredient_id ? items.filter(i => i.ingredient_id === item.ingredient_id).length : 0;
              const hasDup = occurrenceCount > 1;
              const isPrimary = hasDup && firstOccurrenceIdx === idx;
              const isDuplicate = hasDup && firstOccurrenceIdx !== idx;
              const isZero = item.ingredient_id && (parseFloat(item.percentage) || 0) === 0;
              const primaryRow = isDuplicate ? items[firstOccurrenceIdx] : null;
              const mergedPct = isDuplicate
                ? parseFloat((parseFloat(primaryRow?.percentage || 0) + parseFloat(item.percentage || 0)).toFixed(2))
                : 0;
              const rowBg = isDuplicate ? "#fffbf0" : isZero ? "#fdf2f0" : "transparent";
              return (
                <div key={item.id} style={{ borderTop: idx === 0 ? "none" : "1px solid var(--border)" }}>
                  <div className="formula-item-row" style={{ background: rowBg, borderTop: "none" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      {isDuplicate
                        ? <span style={{ fontSize: 10, background: "#ffe4a0", color: "#92600a", borderRadius: 4, padding: "1px 5px", fontFamily: "var(--font-body)", flexShrink: 0, whiteSpace: "nowrap" }}>Duplicate</span>
                        : isPrimary
                          ? <span style={{ fontSize: 10, background: "#e8f5e9", color: "#2E7D32", borderRadius: 4, padding: "1px 5px", fontFamily: "var(--font-body)", flexShrink: 0, whiteSpace: "nowrap" }}>Primary</span>
                          : null
                      }
                      <div style={{ flex: 1 }}>
                        <select value={item.ingredient_id} onChange={e => handleIngredientChange(item.id, e.target.value)} style={{ width: "100%" }}>
                          <option value="" disabled>Select ingredient…</option>
                          {sortIngredients(userIngredients).map(i => (
                            <option key={i.id} value={i.id}>{ingLabel(i)}</option>
                          ))}
                        </select>
                        {ing?.inci_name && (
                          <div style={{ fontSize: 11, color: "var(--muted)", fontStyle: "italic", marginTop: 2, paddingLeft: 2 }}>{ing.inci_name}</div>
                        )}
                        {item.ingredient_id && ing && !ing.inci_name && (
                          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2, paddingLeft: 2 }}>INCI: —</div>
                        )}
                      </div>
                    </div>
                    <div>
                      <input type="number" min="0" max="100" step="0.1" value={item.percentage} onChange={e => updateItem(item.id, "percentage", e.target.value)} placeholder="%" />
                    </div>
                    <div style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--font-body)" }}>
                      {grams.toFixed(2)}g<br />
                      {cost > 0 ? `$${cost.toFixed(2)}` : ""}
                    </div>
                    <button className="btn btn-sm btn-danger" style={{ padding: "5px 7px" }} onClick={() => removeItem(item.id)}>{Icon.trash}</button>
                  </div>
                  {isDuplicate && (
                    <div style={{ display: "flex", gap: 6, padding: "4px 4px 8px", flexWrap: "wrap" }}>
                      <button className="btn btn-sm btn-outline" style={{ fontSize: 11 }} onClick={() => {
                        // Merge into Primary: add this row's % to the primary row, remove this duplicate
                        const merged = parseFloat(primaryRow.percentage || 0) + parseFloat(item.percentage || 0);
                        setItems(items.filter(i => i.id !== item.id).map(i =>
                          i.id === primaryRow.id ? { ...i, percentage: parseFloat(merged.toFixed(4)) } : i
                        ));
                      }}>Merge into Primary ({mergedPct}%)</button>
                      <button className="btn btn-sm btn-danger" style={{ fontSize: 11 }} onClick={() => removeItem(item.id)}>Remove duplicate</button>
                      <button className="btn btn-sm btn-outline" style={{ fontSize: 11, color: "var(--muted)" }} onClick={() => {
                        setItems(items.map(i => i.id === item.id ? { ...i, allowDup: true } : i));
                      }}>Keep separate</button>
                    </div>
                  )}
                  {isZero && (
                    <div style={{ padding: "4px 4px 8px", fontSize: 12, color: "var(--danger)" }}>
                      This ingredient has 0% and should be removed or updated.
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={confirmClose}>Cancel</button>
          <button
            className="btn btn-primary"
            onClick={save}
            disabled={!isExact100}
            style={{ opacity: isExact100 ? 1 : 0.4, cursor: isExact100 ? "pointer" : "not-allowed" }}
          >Save Formula</button>
        </div>
      </div>
    </div>
    </>
  );
}

