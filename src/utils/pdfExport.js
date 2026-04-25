// PDF / printable HTML export for formulas (isolated — opens in a new browser window for printing).

// ── PDF Export (isolated — not connected to UI yet) ──────────
export function buildFormulaHTML(formula) {
  const totalPct = formula.ingredients.reduce((s, i) => s + parseFloat(i.percentage), 0);
  const totalG   = formula.ingredients.reduce((s, i) => s + parseFloat(i.grams), 0);
  const rows = formula.ingredients.map(i => `
    <div class="row">
      <span class="ing-name">
        <span class="ing-title">${i.name}</span>
        ${i.inci ? `<span class="ing-inci">${i.inci}</span>` : `<span class="ing-inci muted">—</span>`}
      </span>
      <span class="ing-right">
        <span class="ing-pct">${i.percentage}%</span>
        <span class="ing-g">${i.grams}g</span>
        <span class="ing-cost">${i.cost ? "$" + i.cost : "—"}</span>
      </span>
    </div>
  `).join("");
  return `
    <html>
      <head>
        <title>${formula.name}</title>
        <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
        <style>
          body { font-family: 'Inter', sans-serif; background: #f7f3ee; color: #3b1f1a; margin: 0; padding: 64px 48px; }
          .container { max-width: 720px; margin: 0 auto; background: #fbf8f5; padding: 52px 56px; border-radius: 4px; }
          .header { border-top: 2px solid #3b1f1a; padding-top: 28px; margin-bottom: 44px; }
          h1 { font-family: 'Playfair Display', serif; font-size: 30px; font-weight: 700; color: #3b1f1a; margin: 0 0 8px 0; letter-spacing: 0.2px; }
          .batch { font-size: 13px; color: #6e4b45; margin: 0 0 4px 0; letter-spacing: 0.3px; }
          .date-line { font-size: 11px; color: #a08070; margin: 0; letter-spacing: 0.3px; }
          .ingredients { margin-bottom: 40px; }
          .col-headers { display: flex; justify-content: space-between; align-items: center; padding-bottom: 10px; border-bottom: 1px solid #e6ddd6; margin-bottom: 2px; }
          .col-label { font-family: 'Inter', sans-serif; font-size: 9px; text-transform: uppercase; letter-spacing: 1.4px; color: #6e4b45; font-weight: 500; }
          .col-label-right { font-family: 'Inter', sans-serif; font-size: 9px; text-transform: uppercase; letter-spacing: 1.4px; color: #6e4b45; font-weight: 500; display: flex; gap: 32px; }
          .row { display: flex; justify-content: space-between; align-items: center; padding: 13px 0; border-bottom: 1px solid #e6ddd6; line-height: 1.5; }
          .ing-name { display: flex; flex-direction: column; flex: 1; }
          .ing-title { font-family: 'Inter', sans-serif; font-size: 13px; color: #3b1f1a; font-weight: 500; letter-spacing: 0.3px; }
          .ing-inci { font-family: 'Inter', sans-serif; font-size: 11px; color: #6e4b45; font-weight: 400; letter-spacing: 0.2px; font-style: italic; }
          .ing-inci.muted { color: #9b7b72; }
          .ing-right { display: flex; gap: 32px; align-items: baseline; }
          .ing-pct  { font-family: 'Inter', sans-serif; font-size: 13px; font-weight: 700; color: #3b1f1a; min-width: 52px; text-align: right; letter-spacing: 0.2px; }
          .ing-g    { font-family: 'Inter', sans-serif; font-size: 12px; font-weight: 400; color: #6e4b45; min-width: 64px; text-align: right; letter-spacing: 0.2px; }
          .ing-cost { font-family: 'Inter', sans-serif; font-size: 12px; font-weight: 500; color: #3b1f1a; min-width: 60px; text-align: right; letter-spacing: 0.2px; }
          .summary { padding-top: 28px; border-top: 1px solid #e6ddd6; display: grid; grid-template-columns: 1fr 1fr; gap: 20px 48px; }
          .summary-item .s-label { font-family: 'Inter', sans-serif; font-size: 9px; text-transform: uppercase; letter-spacing: 1.4px; color: #6e4b45; font-weight: 500; margin-bottom: 4px; }
          .summary-item .s-value { font-size: 20px; font-weight: bold; color: #3b1f1a; font-family: 'Playfair Display', serif; }
          .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e6ddd6; font-family: 'Inter', sans-serif; font-size: 10px; color: #a08070; letter-spacing: 0.4px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${formula.name}</h1>
            <p class="batch">Batch size &nbsp;·&nbsp; ${formula.batch_size}g</p>
            ${formula.date ? `<p class="date-line">${formula.date}</p>` : ""}
          </div>
          <div class="ingredients">
            <div class="col-headers">
              <span class="col-label">Ingredient</span>
              <span class="col-label-right"><span>%</span><span>Weight</span><span>Cost</span></span>
            </div>
            ${rows}
          </div>
          <div class="summary">
            <div class="summary-item">
              <div class="s-label">Total</div>
              <div class="s-value">${totalPct.toFixed(2)}%</div>
            </div>
            <div class="summary-item">
              <div class="s-label">Total Weight</div>
              <div class="s-value">${totalG.toFixed(2)}g</div>
            </div>
            ${formula.totalCost ? `
            <div class="summary-item">
              <div class="s-label">Total Cost</div>
              <div class="s-value">$${formula.totalCost}</div>
            </div>` : `
            <div class="summary-item">
              <div class="s-label">Total Cost</div>
              <div class="s-value">—</div>
            </div>`}
            ${formula.costPerGram ? `
            <div class="summary-item">
              <div class="s-label">Cost / g</div>
              <div class="s-value">$${formula.costPerGram}</div>
            </div>` : `
            <div class="summary-item">
              <div class="s-label">Cost / g</div>
              <div class="s-value">—</div>
            </div>`}
          </div>
          <div class="footer">Generated by Parchment Lab</div>
        </div>
      </body>
    </html>
  `;
}

export function exportFormulaPDF(formula) {
  const html = buildFormulaHTML(formula);
  const w = window.open("", "_blank");
  w.document.write(html);
  w.document.close();
}

