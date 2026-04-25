import React, { useState, useEffect } from 'react';
import { Icon } from './components/Icon.jsx';
import AuthPage from './components/AuthPage.jsx';
import Dashboard from './components/Dashboard.jsx';
import IngredientsPage from './components/IngredientsPage.jsx';
import FormulasPage from './components/FormulasPage.jsx';
import { getSession, onAuthStateChange, signOut } from './services/authService.js';
import { fetchIngredients } from './services/ingredientsService.js';
import { fetchFormulas, fetchAllFormulaItems } from './services/formulasService.js';

export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [page, setPage] = useState("dashboard");
  const [navArg, setNavArg] = useState(null);
  const [navKey, setNavKey] = useState(0);
  const [allIngredients, setAllIngredients] = useState([]);
  const [allFormulas, setAllFormulas] = useState([]);
  const [allFormulaItems, setAllFormulaItems] = useState([]);

  useEffect(() => {
    // Check existing session on load
    getSession().then((session) => {
      if (session?.user) setUser(session.user);
      setAuthLoading(false);
    });
    // Listen for auth state changes (login, logout, token refresh)
    const subscription = onAuthStateChange((u) => setUser(u));
    return () => subscription.unsubscribe();
  }, []);

  // Load all data from Supabase whenever user changes
  useEffect(() => {
    if (user) {
      fetchIngredients(user.id).then(setAllIngredients);
      fetchFormulas(user.id).then(setAllFormulas);
      fetchAllFormulaItems(user.id).then(data => setAllFormulaItems(data.map(fi => ({ id: fi.id, formula_id: fi.formula_id, ingredient_id: fi.ingredient_id, percentage: fi.percentage }))));
    } else {
      setAllIngredients([]);
      setAllFormulas([]);
      setAllFormulaItems([]);
    }
  }, [user?.id]);

  function reloadIngredients() {
    if (user) fetchIngredients(user.id).then(setAllIngredients);
  }

  function reloadFormulas() {
    if (user) {
      fetchFormulas(user.id).then(setAllFormulas);
      fetchAllFormulaItems(user.id).then(data => setAllFormulaItems(data.map(fi => ({ id: fi.id, formula_id: fi.formula_id, ingredient_id: fi.ingredient_id, percentage: fi.percentage }))));
    }
  }

  async function logout() {
    await signOut();
    setUser(null);
    setPage("dashboard");
    setAllIngredients([]);
    setAllFormulas([]);
    setAllFormulaItems([]);
  }

  function nav(p, arg) { setPage(p); setNavArg(arg || null); }

  if (authLoading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", fontFamily: "var(--font-body)", color: "var(--muted)", fontSize: 14 }}>
      Loading…
    </div>
  );

  if (!user) return <AuthPage onLogin={u => { setUser(u); setPage("dashboard"); }} />;

  return (
    <div className="app-shell">
      <div className="sidebar">
        <div className="sidebar-logo" style={{ cursor: "pointer" }} onClick={() => { setPage("dashboard"); setNavArg(null); setNavKey(k => k + 1); }}>
          <h1>Parchment Lab</h1>
          <p>cosmetic formulator</p>
        </div>
        <nav className="sidebar-nav">
          <div className="nav-section">Main</div>
          {[
            { id: "dashboard", label: "Dashboard", icon: Icon.dash },
            { id: "formulas", label: "Formulas", icon: Icon.flask },
            { id: "ingredients", label: "Ingredients", icon: Icon.leaf },
          ].map(item => (
            <div key={item.id} className={`nav-item ${page === item.id ? "active" : ""}`} onClick={() => { setPage(item.id); setNavArg(null); setNavKey(k => k + 1); }}>
              {item.icon} {item.label}
            </div>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="user-chip">{user.email}</div>
          <button className="logout-btn" onClick={logout}>Log out</button>
        </div>
      </div>

      <div className="main">
        {page === "dashboard" && <Dashboard user={user} onNav={nav} ingredients={allIngredients} formulas={allFormulas} formulaItems={allFormulaItems} />}
        {page === "formulas" && <FormulasPage user={user} openFormulaId={navArg} key={navKey} onAddIngredient={() => { setPage("ingredients"); setNavArg("new"); setNavKey(k => k + 1); }} nav={nav} ingredients={allIngredients} formulas={allFormulas} formulaItems={allFormulaItems} onFormulasChange={reloadFormulas} />}
        {page === "ingredients" && <IngredientsPage user={user} openNew={navArg === "new"} openIngredientId={navArg !== "new" ? navArg : null} key={navKey} nav={nav} ingredients={allIngredients} onIngredientsChange={reloadIngredients} formulas={allFormulas} formulaItems={allFormulaItems} />}
      </div>
    </div>
  );
}
