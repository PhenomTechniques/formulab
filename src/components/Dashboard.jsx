import React from 'react';
import { Icon } from './Icon.jsx';
import { parseFormulaName } from '../utils/helpers.js';

export default function Dashboard({ user, onNav, ingredients: myIngredients = [], formulas: allFormulas = [], formulaItems: allFormulaItems = [] }) {
  const myFormulas = allFormulas.filter(f => f.user_id === user.id);
  // Latest version only per base name
  const latestByBase = {};
  myFormulas.forEach(f => {
    const bn = f.base_name || parseFormulaName(f.name).baseName;
    const v = f.version || parseFormulaName(f.name).version;
    if (!latestByBase[bn] || v > (latestByBase[bn].version || parseFormulaName(latestByBase[bn].name).version)) {
      latestByBase[bn] = f;
    }
  });
  const latestFormulas = Object.values(latestByBase);
  const recentFormulas = [...latestFormulas]
    .sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at))
    .slice(0, 8);
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recentCount = latestFormulas.filter(f => new Date(f.updated_at || f.created_at) >= sevenDaysAgo).length;

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Dashboard</div>
          <div className="page-sub">Welcome back, {user.email.split("@")[0]}</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-outline" onClick={() => onNav("ingredients", "new")}>{Icon.plus} Add Ingredient</button>
          <button className="btn btn-primary" onClick={() => onNav("formulas", "new")}>{Icon.plus} New Formula</button>
        </div>
      </div>
      <div className="content">
        <div className="grid-3" style={{ marginBottom: 24, maxWidth: 560 }}>
          {[
            { label: "Formulas", value: latestFormulas.length, tip: "Total number of current formulas", nav: "formulas", emptyNote: latestFormulas.length === 0 ? "No formulas yet" : null },
            { label: "Ingredients", value: myIngredients.length, tip: "Total ingredients in your library", nav: "ingredients", emptyNote: myIngredients.length === 0 ? "No ingredients yet" : null },
            { label: "Updated (7d)", value: recentCount, tip: "Formulas updated in the last 7 days", nav: "formulas", emptyNote: recentCount === 0 ? "No recent activity" : null },
          ].map(({ label, value, tip, nav: navTo, emptyNote }) => (
            <span key={label} className="tip" data-tip={tip} style={{ display: "block" }}>
              <div
                className="stat-card"
                onClick={() => onNav(navTo)}
                style={{ cursor: "pointer", transition: "transform 0.15s, box-shadow 0.15s" }}
                onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 4px 16px rgba(59,31,26,0.10)"; }}
                onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = ""; }}
              >
                <div className="stat-label">{label}</div>
                <div className={`stat-value${label === "Formulas" ? " accent" : ""}`}>{value}</div>
                {emptyNote && <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4, fontStyle: "italic" }}>{emptyNote}</div>}
              </div>
            </span>
          ))}
        </div>

        <div className="grid-2">
          <div>
            <div className="section-head">
              <div className="section-title">Recent Formulas</div>
              <button className="btn btn-outline btn-sm" onClick={() => onNav("formulas")}>{Icon.flask} View all</button>
            </div>
            <div className="table-wrap">
              {recentFormulas.length === 0 ? (
                <div className="empty-state">
                  <div className="icon">⚗️</div>
                  <p>No formulas yet — create your first formula</p>
                  <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => onNav("formulas", "new")}>{Icon.plus} New Formula</button>
                </div>
              ) : (
                <table>
                  <thead><tr><th>Name</th><th>Ver</th><th>Batch</th><th>Updated</th><th style={{ width: 64 }}></th></tr></thead>
                  <tbody>{recentFormulas.map(f => {
                    const updated = f.updated_at || f.created_at;
                    const dateStr = new Date(updated).toLocaleDateString(undefined, { month: "short", day: "numeric" });
                    return (
                      <tr key={f.id}
                        onClick={() => onNav("formulas", f.id)}
                        style={{ cursor: "pointer" }}
                      >
                        <td style={{ fontWeight: 500 }}>{f.base_name || parseFormulaName(f.name).baseName}</td>
                        <td style={{ color: "var(--muted)", fontSize: 12, fontFamily: "var(--font-mono)" }}>v{f.version || parseFormulaName(f.name).version}</td>
                        <td style={{ color: "var(--muted)", fontSize: 13 }}>{f.batch_size}g</td>
                        <td style={{ color: "var(--muted)", fontSize: 12 }}>{dateStr}</td>
                        <td onClick={e => e.stopPropagation()}>
                          <span className="tip" data-tip="Open Formula">
                            <button className="btn btn-sm btn-outline" onClick={() => onNav("formulas", f.id)}>Open</button>
                          </span>
                        </td>
                      </tr>
                    );
                  })}</tbody>
                </table>
              )}
            </div>
          </div>
          <div>
            <div className="section-head">
              <div className="section-title">Ingredient Library</div>
              <button className="btn btn-outline btn-sm" onClick={() => onNav("ingredients")}>{Icon.leaf} View all</button>
            </div>
            <div className="table-wrap">
              {myIngredients.length === 0 ? (
                <div className="empty-state">
                  <div className="icon">🌿</div>
                  <p>No ingredients yet — add ingredients to begin</p>
                  <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => onNav("ingredients", "new")}>{Icon.plus} Add Ingredient</button>
                </div>
              ) : (
                <table>
                  <thead><tr><th>Name</th><th>Type</th></tr></thead>
                  <tbody>{myIngredients.slice(0, 8).map(i => (
                    <tr key={i.id}
                      onClick={() => onNav("ingredients", i.id)}
                      style={{ cursor: "pointer" }}
                    >
                      <td style={{ fontWeight: 500 }}>{i.name}</td>
                      <td><span className="tag">{i.type}</span></td>
                    </tr>
                  ))}</tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

