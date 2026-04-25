import React, { useState, useEffect } from 'react';
import { Icon } from './Icon.jsx';
import ConfirmModal from './ConfirmModal.jsx';
import FormulaModal from './FormulaModal.jsx';
import FormulaDetail from './FormulaDetail.jsx';
import { parseFormulaName, nextVersionFor } from '../utils/helpers.js';
import { insertFormula, insertFormulaItems, deleteFormula } from '../services/formulasService.js';

export default function FormulasPage({ user, openFormulaId, onAddIngredient, nav, ingredients = [], formulas = [], formulaItems = [], onFormulasChange }) {
  const [modal, setModal] = useState(null);
  const [viewId, setViewId] = useState(openFormulaId || null);
  const [editFormula, setEditFormula] = useState(null);
  const [search, setSearch] = useState("");
  const [confirmDel, setConfirmDel] = useState(null);
  const [showAllVersions, setShowAllVersions] = useState(false);

  useEffect(() => { setViewId(openFormulaId || null); }, [openFormulaId]);

  function load() {
    if (onFormulasChange) onFormulasChange();
  }

  function del(f) { setConfirmDel(f); }
  function doDelete() {
    const toDelete = confirmDel;
    setConfirmDel(null);
    deleteFormula(toDelete.id)
      .then(() => load())
      .catch(e => console.error("deleteFormula:", e.message));
  }

  function duplicate(f) {
    const baseName = f.name.replace(/ v\d+$/i, "").trim();
    const nextVer = nextVersionFor(baseName, user.id, formulas);
    const newName = `${baseName} v${nextVer}`;
    const now = new Date().toISOString();
    const newFormula = {
      user_id: user.id, name: newName, base_name: baseName, version: nextVer,
      batch_size: f.batch_size, notes: f.notes || null, snapshot: f.snapshot || null,
      created_at: now, updated_at: now
    };
    insertFormula(newFormula).then(inserted => {
      const originalItems = formulaItems.filter(fi => fi.formula_id === f.id);
      const newItems = originalItems.map(fi => ({ formula_id: inserted.id, ingredient_id: fi.ingredient_id, percentage: fi.percentage }));
      return insertFormulaItems(newItems);
    }).then(() => { load(); })
      .catch(e => console.error("duplicate:", e.message));
  }

  if (viewId) return (
    <FormulaDetail
      user={user}
      formulaId={viewId}
      onBack={() => setViewId(null)}
      onEdit={(f) => { setViewId(null); setEditFormula(f); }}
      onDuplicate={(f) => duplicate(f)}
      onOpenVersion={(id) => setViewId(id)}
      onViewIngredient={nav ? (ing) => nav("ingredients", ing.id) : null}
      ingredients={ingredients}
      formulas={formulas}
      formulaItems={formulaItems}
    />
  );

  const myFormulas = formulas.filter(f => f.user_id === user.id);
  const latestPerBase = {};
  myFormulas.forEach(f => {
    const bn = f.base_name || parseFormulaName(f.name).baseName;
    const v = f.version || parseFormulaName(f.name).version;
    if (!latestPerBase[bn] || v > (latestPerBase[bn].version || parseFormulaName(latestPerBase[bn].name).version)) {
      latestPerBase[bn] = f;
    }
  });
  const displayFormulas = showAllVersions ? myFormulas : Object.values(latestPerBase).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const filtered = displayFormulas.filter(f => !search || f.name.toLowerCase().includes(search.toLowerCase()) || (f.base_name || "").toLowerCase().includes(search.toLowerCase()));

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Formulas</div>
          <div className="page-sub">{Object.keys(latestPerBase).length} formula{Object.keys(latestPerBase).length !== 1 ? "s" : ""}</div>
        </div>
        <button className="btn btn-primary" onClick={() => setModal("new")}>{Icon.plus} New Formula</button>
      </div>
      <div className="content">
        <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center" }}>
          <input placeholder="Search formulas..." value={search} onChange={e => setSearch(e.target.value)} style={{ maxWidth: 260 }} />
          <button className={`btn btn-sm ${showAllVersions ? "btn-primary" : "btn-outline"}`} onClick={() => setShowAllVersions(v => !v)}>
            {showAllVersions ? "Latest only" : "Show all versions"}
          </button>
        </div>
        {filtered.length === 0 ? (
          <div className="empty-state" style={{ marginTop: 40 }}>
            <div className="icon">⚗️</div>
            <p>{formulas.length === 0 ? "No formulas yet — create your first formula" : "No formulas match your search"}</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Name</th><th>Ver</th><th>Batch</th><th>Ingredients</th><th>Est. Cost</th><th>Created</th><th style={{ width: 110 }}></th></tr></thead>
              <tbody>
                {filtered.map(f => {
                  const items = formulaItems.filter(fi => fi.formula_id === f.id);
                  const totalCost = items.reduce((s, fi) => {
                    const ing = ingredients.find(i => i.id === fi.ingredient_id);
                    return s + (fi.percentage / 100) * f.batch_size * (ing?.cost_per_gram || 0);
                  }, 0);
                  return (
                    <tr key={f.id}
                      onClick={() => setViewId(f.id)}
                      style={{ cursor: "pointer" }}
                    >
                      <td style={{ fontWeight: 600, color: "var(--accent)" }}>{f.base_name || parseFormulaName(f.name).baseName}</td>
                      <td className="mono" style={{ color: "var(--muted)" }}>v{f.version || parseFormulaName(f.name).version}</td>
                      <td className="mono">{f.batch_size}g</td>
                      <td>{items.length}</td>
                      <td className="mono">{totalCost > 0 ? `$${totalCost.toFixed(2)}` : "—"}</td>
                      <td style={{ color: "var(--muted)", fontSize: 12 }}>{new Date(f.created_at).toLocaleDateString()}</td>
                      <td onClick={e => e.stopPropagation()}>
                        <div style={{ display: "flex", gap: 4 }}>
                          <span className="tip" data-tip="View formula"><button className="btn btn-sm btn-outline" aria-label="View formula" onClick={() => setViewId(f.id)}>{Icon.eye}</button></span>
                          <span className="tip" data-tip="Edit formula"><button className="btn btn-sm btn-outline" aria-label="Edit formula" onClick={() => setEditFormula(f)}>{Icon.edit}</button></span>
                          <span className="tip" data-tip="Duplicate formula"><button className="btn btn-sm btn-outline" aria-label="Duplicate formula" onClick={() => duplicate(f)}>{Icon.copy}</button></span>
                          {(() => {
                            const bn = f.base_name || parseFormulaName(f.name).baseName;
                            const siblingCount = formulas.filter(x => x.user_id === user.id && (x.base_name === bn || parseFormulaName(x.name).baseName === bn)).length;
                            if (siblingCount > 1) return (
                              <span className="tip" data-tip="Cannot delete — part of a version history">
                                <button className="btn btn-sm btn-outline" style={{ opacity: 0.35, cursor: "not-allowed" }} aria-label="Cannot delete versioned formula" disabled>{Icon.trash}</button>
                              </span>
                            );
                            return (
                              <span className="tip" data-tip="Delete formula"><button className="btn btn-sm btn-danger" aria-label="Delete formula" onClick={() => del(f)}>{Icon.trash}</button></span>
                            );
                          })()}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {(modal === "new" || editFormula) && (
        <FormulaModal
          user={user}
          formula={editFormula}
          onClose={() => { setModal(null); setEditFormula(null); }}
          onSave={(newId) => { setModal(null); setEditFormula(null); load(); if (newId) setViewId(newId); }}
          onAddIngredient={onAddIngredient}
          ingredients={ingredients}
          formulaItems={formulaItems}
          formulas={formulas}
        />
      )}
      {confirmDel && (
        <ConfirmModal
          title="Delete Formula"
          message={`Are you sure you want to delete "${confirmDel.name}"? This cannot be undone.`}
          confirmLabel="Delete"
          confirmStyle="btn-danger"
          onConfirm={doDelete}
          onCancel={() => setConfirmDel(null)}
        />
      )}
    </>
  );
}

