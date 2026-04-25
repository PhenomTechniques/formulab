import React, { useState } from 'react';
import { Icon } from './Icon.jsx';
import { costPerGram, parseFormulaName } from '../utils/helpers.js';
import { exportFormulaPDF } from '../utils/pdfExport.js';
import { executeFormulaConsumption } from '../services/formulasService.js';

export default function FormulaDetail({ user, formulaId, onBack, onEdit, onDuplicate, onOpenVersion, onViewIngredient, ingredients = [], formulas = [], formulaItems = [] }) {
  const [batchSize, setBatchSize] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [expandedVersion, setExpandedVersion] = useState(null);
  const [executing, setExecuting] = useState(false);
  const [execResult, setExecResult] = useState(null);  // { success, message }
  const formula = formulas.find(f => f.id === formulaId && f.user_id === user.id);
  if (!formula) return <div className="content"><p>Formula not found.</p><button className="btn btn-outline" onClick={onBack}>Back</button></div>;

  // All versions of this formula
  const baseName = formula.base_name || parseFormulaName(formula.name).baseName;
  const allVersions = formulas
    .filter(f => f.user_id === user.id && (f.base_name === baseName || parseFormulaName(f.name).baseName === baseName))
    .sort((a, b) => (b.version || 1) - (a.version || 1));
  const isLatestVersion = allVersions.length === 0 || allVersions[0].id === formula.id;

  const effectiveBatch = parseFloat(batchSize ?? formula.batch_size) || formula.batch_size;
  const items = formulaItems.filter(fi => fi.formula_id === formula.id).map(fi => {
    const ing = ingredients.find(i => i.id === fi.ingredient_id);
    const grams = (fi.percentage / 100) * effectiveBatch;
    const cost = grams * (ing?.cost_per_gram || 0);
    return { ...fi, ingredient: ing, grams, cost };
  });
  const totalCost = items.reduce((s, i) => s + i.cost, 0);
  const ingIds = items.map(i => i.ingredient_id);
  const dupIngIds = new Set(ingIds.filter((id, idx) => ingIds.indexOf(id) !== idx));
  const hasDuplicates = dupIngIds.size > 0;

  return (
    <>
      {showHistory && (
        <div className="modal-backdrop" style={{ zIndex: 300 }}>
          <div className="modal" style={{ maxWidth: 440 }}>
            <div className="modal-header">
              <div className="modal-title">Version History — {baseName}</div>
              <button className="close-btn" onClick={() => { setShowHistory(false); setExpandedVersion(null); }}>{Icon.x}</button>
            </div>
            <div className="modal-body">
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {allVersions.map(v => {
                  const isCurrent = v.id === formula.id;
                  const vNum = v.version || parseFormulaName(v.name).version;
                  const isExpanded = expandedVersion === v.id;
                  const snap = v.snapshot;
                  return (
                    <div key={v.id} style={{ borderRadius: "var(--radius)", border: `1px solid ${isCurrent ? "var(--accent)" : "var(--border)"}`, background: isCurrent ? "#f0faf4" : "#fff", overflow: "hidden" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", cursor: snap ? "pointer" : "default" }}
                        onClick={() => snap && setExpandedVersion(isExpanded ? null : v.id)}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>
                            v{vNum}
                            {isCurrent && <span style={{ fontSize: 11, color: "var(--accent)", fontFamily: "var(--font-body)", marginLeft: 6 }}>current</span>}
                          </div>
                          <div style={{ fontSize: 12, color: "var(--muted)" }}>{new Date(v.created_at).toLocaleDateString()} · {v.batch_size}g</div>
                        </div>
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          {snap && <span style={{ fontSize: 11, color: "var(--muted)" }}>{isExpanded ? "▲" : "▼"}</span>}
                          {!isCurrent && (
                            <button className="btn btn-outline btn-sm" onClick={e => { e.stopPropagation(); setShowHistory(false); setExpandedVersion(null); onOpenVersion(v.id); }}>Open</button>
                          )}
                        </div>
                      </div>
                      {isExpanded && snap && (
                        <div style={{ borderTop: "1px solid var(--border)", padding: "10px 14px", background: "#FAFAF7" }}>
                          <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.4px", fontFamily: "var(--font-body)" }}>
                            Snapshot · {snap.batch_size}g batch
                          </div>
                          {(() => {
                            const vIdx = allVersions.findIndex(x => x.id === v.id);
                            const prevSnap = allVersions[vIdx + 1]?.snapshot;
                            // Build rows: current ingredients + removed ones from previous
                            const currentRows = snap.ingredients.map(ing => {
                              const prevIng = prevSnap?.ingredients?.find(p => p.name === ing.name);
                              const isNew = prevSnap && !prevIng;
                              const isChanged = prevIng && Math.abs(parseFloat(prevIng.percentage) - parseFloat(ing.percentage)) > 0.001;
                              return { ...ing, isNew, isChanged, prevPct: prevIng?.percentage };
                            });
                            const removedRows = prevSnap
                              ? prevSnap.ingredients.filter(p => !snap.ingredients.find(c => c.name === p.name)).map(ing => ({ ...ing, isRemoved: true }))
                              : [];
                            const allRows = [...currentRows, ...removedRows];
                            return allRows.map((ing, i) => {
                              const { isNew, isChanged, isRemoved, prevPct } = ing;
                              const rowBg = isNew ? "#f0faf4" : isChanged ? "#fffbf0" : isRemoved ? "#fdf2f0" : "transparent";
                              return (
                                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, borderBottom: i < allRows.length - 1 ? "1px solid var(--border)" : "none", background: rowBg, margin: "0 -14px", padding: "5px 14px" }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <span style={{ fontWeight: isNew || isChanged || isRemoved ? 600 : 400, color: isRemoved ? "var(--muted)" : "var(--text)", textDecoration: isRemoved ? "line-through" : "none" }}>{ing.name}</span>
                                    {isRemoved && <span style={{ fontSize: 10, background: "#f5c6c2", color: "var(--danger)", borderRadius: 4, padding: "1px 5px", fontFamily: "var(--font-body)" }}>– Removed</span>}
                                  </div>
                                  <div style={{ textAlign: "right", display: "flex", alignItems: "center", gap: 6 }}>
                                    {!isRemoved && (
                                      <span className="mono" style={{ color: isNew ? "var(--accent)" : isChanged ? "#92600a" : "var(--accent)", fontWeight: isNew || isChanged ? 700 : 600 }}>
                                        {parseFloat(ing.percentage).toFixed(2)}%
                                      </span>
                                    )}
                                    {isChanged && prevPct != null && (
                                      <span style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--font-body)" }}>
                                        (was {parseFloat(prevPct).toFixed(2)}%)
                                      </span>
                                    )}
                                    {isNew && (
                                      <span style={{ fontSize: 11, color: "#2E7D32", fontFamily: "var(--font-body)" }}>
                                        (+ Added)
                                      </span>
                                    )}
                                    {isRemoved && prevPct != null && (
                                      <span className="mono" style={{ color: "var(--muted)", textDecoration: "line-through", fontSize: 12 }}>
                                        {parseFloat(prevPct).toFixed(2)}%
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            });
                          })()}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => { setShowHistory(false); setExpandedVersion(null); }}>Close</button>
            </div>
          </div>
        </div>
      )}
      <div className="page-header">
        <div>
          <div className="page-title">{formula.name}</div>
          <div className="page-sub">
            Created {new Date(formula.created_at).toLocaleDateString()}
            {allVersions.length > 1 && <span style={{ marginLeft: 8, fontSize: 11, color: "var(--muted)", fontFamily: "var(--font-body)" }}>· {allVersions.length} versions</span>}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {!isLatestVersion && (
            <span style={{ fontSize: 12, background: "#F5EEE3", color: "#7A4F1A", border: "1px solid #E6D5C0", borderRadius: "var(--radius)", padding: "5px 12px", fontWeight: 500 }}>
              Previous version — read only
            </span>
          )}
          <button className="btn btn-outline" onClick={onBack}>← Back</button>
          {allVersions.length > 1 && <button className="btn btn-outline" onClick={() => setShowHistory(true)}>Version History</button>}
          <button className="btn btn-outline" onClick={() => {
            const totalCostExport = items.reduce((s, item) => s + item.cost, 0);
            const cpg = formula.batch_size > 0 ? totalCostExport / formula.batch_size : 0;
            const currentFormula = {
              name: formula.name,
              batch_size: formula.batch_size,
              date: new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
              ingredients: items.map(item => ({
                name: item.ingredient?.name || "Unknown",
                inci: item.ingredient?.inci_name || "",
                percentage: item.percentage.toFixed(2),
                grams: item.grams.toFixed(2),
                cost: item.cost > 0 ? item.cost.toFixed(2) : null
              })),
              totalCost: totalCostExport.toFixed(2),
              costPerGram: cpg.toFixed(4)
            };
            exportFormulaPDF(currentFormula);
          }}>Export PDF</button>
          <button className="btn btn-outline" onClick={() => onDuplicate(formula)}><span className="tip" data-tip="Duplicate formula" style={{display:"inline-flex"}}>{Icon.copy}</span> Duplicate</button>
          {isLatestVersion
            ? <button className="btn btn-primary" onClick={() => onEdit(formula)}>{Icon.edit} Edit</button>
            : <span className="tip" data-tip="Only the latest version can be edited">
                <button className="btn btn-outline" disabled style={{ opacity: 0.35, cursor: "not-allowed" }}>{Icon.edit} Edit</button>
              </span>
          }
          <button
            className="btn btn-primary"
            disabled={executing}
            style={{ opacity: executing ? 0.6 : 1, background: "var(--accent2)" }}
            onClick={async () => {
              if (executing) return;
              setExecuting(true);
              setExecResult(null);
              try {
                const result = await executeFormulaConsumption(formula.id, user.id);
                const lotsUsed = result?.usage?.length || 0;
                setExecResult({ success: true, message: `Executed successfully. ${lotsUsed} lot${lotsUsed !== 1 ? "s" : ""} updated.`, data: result });
              } catch(e) {
                setExecResult({ success: false, message: e.message || "Execution failed." });
              }
              setExecuting(false);
            }}
          >
            {executing ? "Executing…" : "⚗ Execute Formula"}
          </button>
        </div>
      </div>
      <div className="content">
        {execResult && (
          <div style={{ marginBottom: 16, borderRadius: "var(--radius)", border: `1px solid ${execResult.success ? "#B8D9BC" : "#F5C6C2"}`, overflow: "hidden" }}>
            {/* Header bar */}
            <div style={{
              padding: "10px 16px", display: "flex", justifyContent: "space-between", alignItems: "center",
              background: execResult.success ? "#EDF3EE" : "#FDF2F0",
              color: execResult.success ? "#3D6B44" : "var(--danger)", fontSize: 13
            }}>
              <span>{execResult.success ? "✓ " : "✕ "}{execResult.message}</span>
              <button onClick={() => setExecResult(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", fontSize: 16, lineHeight: 1 }}>×</button>
            </div>
            {/* Usage detail — only on success */}
            {execResult.success && execResult.data && (
              <div style={{ padding: "12px 16px", background: "var(--surface)" }}>
                <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 10 }}>
                  Batch ID: <span style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>{execResult.data.batch_id}</span>
                </div>
                <div className="table-wrap" style={{ marginBottom: 0 }}>
                  <table>
                    <thead>
                      <tr><th>Ingredient</th><th>Lot</th><th>Used</th></tr>
                    </thead>
                    <tbody>
                      {(execResult.data.usage || []).map((u, i) => (
                        <tr key={i}>
                          <td style={{ fontWeight: 500 }}>{u.ingredient_name || "—"}</td>
                          <td style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)" }}>{u.lot_id ? u.lot_id.slice(0, 8) + "…" : "—"}</td>
                          <td style={{ fontFamily: "var(--font-mono)", fontWeight: 600 }}>{parseFloat(u.grams_used).toFixed(4)}g</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
        <div className="grid-5" style={{ marginBottom: 20 }}>
          <div className="stat-card"><div className="stat-label">Base Batch</div><div className="stat-value mono">{formula.batch_size}g</div></div>
          <div className="stat-card"><div className="stat-label">Ingredients</div><div className="stat-value">{items.length}</div></div>
          <div className="stat-card"><div className="stat-label">Total Cost</div><div className="stat-value accent mono">${totalCost.toFixed(2)}</div></div>
          <div className="stat-card"><div className="stat-label">Cost per gram</div><div className="stat-value mono">${(totalCost / effectiveBatch).toFixed(4)}</div></div>
          <div className="stat-card"><div className="stat-label">Cost per oz</div><div className="stat-value mono">${(totalCost / effectiveBatch * 28.3495).toFixed(2)}</div></div>
        </div>

        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: "block", fontSize: 12, color: "var(--muted)", marginBottom: 4, fontFamily: "var(--font-body)" }}>Batch Calculator — adjust batch size</label>
              <input type="number" min="1" value={batchSize ?? formula.batch_size} onChange={e => setBatchSize(e.target.value)} style={{ width: 160 }} />
            </div>
            {batchSize && batchSize != formula.batch_size && <button className="btn btn-outline btn-sm" onClick={() => setBatchSize(null)}>Reset</button>}
          </div>
        </div>

        <div className="table-wrap">
          {hasDuplicates && (
            <div style={{ padding: "10px 16px", background: "#fffbf0", borderBottom: "1px solid #ffe4a0", color: "#92600a", fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
              <span>⚠</span>
              <span>This formula contains duplicate ingredients. Review the highlighted rows below.</span>
            </div>
          )}
          <table>
            <thead><tr><th>Ingredient</th><th>Type</th><th>%</th><th>Grams</th><th>Cost</th></tr></thead>
            <tbody>
              {items.map(item => {
                const isDup = item.ingredient_id && dupIngIds.has(item.ingredient_id);
                return (
                  <tr key={item.id} style={{ background: isDup ? "#fffbf0" : undefined }}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        {isDup && <span title="Duplicate ingredient" style={{ color: "var(--warn)", fontSize: 14, flexShrink: 0 }}>⚠</span>}
                        <div>
                          <div
                            style={{ fontWeight: 500, cursor: onViewIngredient && item.ingredient ? "pointer" : "default", color: onViewIngredient && item.ingredient ? "var(--accent)" : "var(--text)" }}
                            onClick={() => onViewIngredient && item.ingredient && onViewIngredient(item.ingredient)}
                          >{item.ingredient?.name || "Unknown"}</div>
                          {item.ingredient?.inci_name && <div style={{ fontSize: 11, color: "var(--muted)", fontStyle: "italic" }}>{item.ingredient.inci_name}</div>}
                          {isDup && <div style={{ fontSize: 11, color: "#92600a", marginTop: 2 }}>This ingredient appears more than once in the formula.</div>}
                        </div>
                      </div>
                    </td>
                    <td><span className="tag">{item.ingredient?.type || "—"}</span></td>
                    <td className="mono" style={{ fontWeight: 600 }}>{item.percentage.toFixed(2)}%</td>
                    <td className="mono">{item.grams.toFixed(2)}g</td>
                    <td className="mono">{item.cost > 0 ? `$${item.cost.toFixed(2)}` : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ background: "#F7F5F0" }}>
                <td colSpan={2} style={{ fontWeight: 600, fontSize: 12 }}>Total</td>
                <td className="mono" style={{ fontWeight: 700 }}>100.00%</td>
                <td className="mono" style={{ fontWeight: 700 }}>{effectiveBatch.toFixed(2)}g</td>
                <td className="mono" style={{ fontWeight: 700, color: "var(--accent)" }}>${totalCost.toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {formula.notes && <div className="card" style={{ marginTop: 16 }}><div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 6, fontFamily: "var(--font-body)" }}>Notes</div><p style={{ fontSize: 14 }}>{formula.notes}</p></div>}
      </div>
    </>
  );
}

