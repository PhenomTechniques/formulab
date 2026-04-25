# FormuLab

Cosmetic formulator app — restructured from a single HTML file into a Vite + React project.

## What's inside

```
formulab/
├── index.html              # Vite entry HTML
├── package.json            # npm dependencies and scripts
├── vite.config.js          # Vite config
├── .env.example            # Template for your Supabase credentials
├── .gitignore
└── src/
    ├── main.jsx            # App entry point — mounts React, loads global CSS
    ├── App.jsx             # Root component — routing, auth state, data loading
    ├── lib/
    │   └── supabase.js     # Supabase client (reads from .env)
    ├── styles/
    │   └── global.css      # All app styles
    ├── services/           # All Supabase calls live here — never in components
    │   ├── authService.js
    │   ├── ingredientsService.js
    │   ├── lotsService.js
    │   └── formulasService.js
    ├── utils/
    │   ├── constants.js          # Ingredient types, units, conversions
    │   ├── helpers.js            # Pure helpers (uid, costPerGram, etc.)
    │   ├── ingredientLibrary.js  # Predefined cosmetic ingredient catalog
    │   └── pdfExport.js          # Printable formula export
    └── components/         # React UI components
        ├── Icon.jsx
        ├── ConfirmModal.jsx
        ├── AuthPage.jsx
        ├── Dashboard.jsx
        ├── IngredientModal.jsx
        ├── InventoryLotsSection.jsx
        ├── IngredientsPage.jsx
        ├── FormulaModal.jsx
        ├── FormulaDetail.jsx
        └── FormulasPage.jsx
```

## Setup

### 1. Install Node.js
If you don't already have it: https://nodejs.org (download the LTS version).

### 2. Install dependencies

Open a terminal in this folder and run:

```bash
npm install
```

### 3. Configure environment variables

Copy the example env file to a real `.env` file:

```bash
cp .env.example .env
```

Then edit `.env` and fill in your Supabase credentials:

```
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-publishable-anon-key-here
```

> ⚠️ **Never commit `.env`** — it's already in `.gitignore`. Only `.env.example` should be committed.

### 4. Run locally

```bash
npm run dev
```

This starts the dev server, typically at `http://localhost:5173`.

### 5. Build for production

```bash
npm run build
```

Output goes to `dist/`. Run `npm run preview` to test the production build locally.

## What stayed the same

All business logic, validation rules, save behavior, UI design, and feature behavior are identical to the original single-file app. Specifically preserved:

- Inventory lots flow (single-entry receiving, lot number generation, duplicate detection)
- Formula builder and versioning
- Validation system (auth, lot numbers, formula percentages)
- Warning system (low inventory, supplier lot collisions, etc.)

## What changed

- Single HTML file → modular Vite + React project
- Inline `<script type="text/babel">` → real ES modules
- Hardcoded Supabase URL/key → `.env` variables
- All Supabase calls now live in `src/services/` — UI components never call `sb` directly
- CSS string in JS → real `global.css` file
