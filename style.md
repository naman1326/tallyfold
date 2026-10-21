# MediCore Design System & Frontend Style Guide

A complete reference documentation for all design elements, color palettes, typography, theme tokens, UI components, animations, and layouts used across the **MediCore Hospital Management System** frontend.

---

## 1. Design Philosophy & Aesthetic

The MediCore frontend is crafted around a **"Cyber-Clinical Dark Mode"** theme:
* **Deep Dark Surfaces:** High-contrast, dark midnight and obsidian base surfaces (`#02040a`, `#0a0f1c`, `#0f1729`) that eliminate eye strain and give a sleek modern SaaS feel.
* **Vibrant Neon Accents:** Cyan (`#06d6e6`), Emerald (`#10d992`), Violet (`#a78bfa`), Amber (`#fbbf24`), and Rose (`#fb7185`) provide instant visual hierarchy and clear status signals.
* **Atmospheric Glassmorphism & Radial Glows:** Subtle radial background gradients and backdrop blur filters (`backdrop-filter: blur(8px)`) give depth to cards, navigation sidebars, and dialog modals without visual clutter.
* **Role-Based Visual Identity:**
  * **Patient Portal:** Cyan theme (`--cyan`), approachable and clean.
  * **Doctor Portal:** Violet theme (`--violet`), clinical and specialized.
  * **Management Portal:** Emerald theme (`--emerald`), operational and analytical.

---

## 2. Color Palette & Design Tokens

All colors are codified as CSS custom properties in `:root` inside [`src/index.css`](file:///C:/Users/ghoda/Downloads/hospital-management/frontend/src/index.css).

### 2.1 Surfaces & Backgrounds

| Variable | Hex Value | Role / Usage |
| :--- | :--- | :--- |
| `--bg-root` | `#02040a` | Deepest black/navy background for `#root` and landing pages |
| `--bg-surface` | `#0a0f1c` | Sidebar start color, table headers (`thead`), pill tags |
| `--bg-card` | `#0f1729` | Base card background, modal bodies, toast notifications |
| `--bg-card-elev` | `#131d35` | Elevated surface for card gradients and hover depth |
| `--bg-hover` | `#1a2540` | Interactive hover state for table rows, ghost buttons |
| `--bg-input` | `#0c1220` | Form input and text field backgrounds |

### 2.2 Borders & Strokes

| Variable | Hex Value | Role / Usage |
| :--- | :--- | :--- |
| `--border` | `#1e2a45` | Default container border, table cell dividers, separators |
| `--border-lit` | `#2d3f65` | Active/focused borders, card hover outline, scrollbar thumb |
| `--border-glow` | `#3d5075` | Highlight borders on hover for interactive stat cards & hero cards |

### 2.3 Accent Colors, Glows & Gradients

| Accent | Base Color | Dim Tint (10% / `1a`) | Glow Tint (25% / `40`) | Gradient Token / Value | Meaning / Usage |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Cyan** | `#06d6e6` | `#06d6e61a` | `#06d6e640` | `linear-gradient(135deg, #06d6e6 0%, #00a8b3 100%)` | Primary brand accent, active nav links, patient portal, Cardiology |
| **Emerald** | `#10d992` | `#10d9921a` | `#10d99240` | `linear-gradient(90deg, #10d992 0%, #059669 100%)` | Success status, paid bills, revenue stats, management portal, Pediatrics |
| **Violet** | `#a78bfa` | `#a78bfa1a` | `#a78bfa40` | `linear-gradient(90deg, #a78bfa 0%, #7c3aed 100%)` | Doctor portal, staff metrics, Neurology department |
| **Amber** | `#fbbf24` | `#fbbf241a` | `#fbbf2440` | `linear-gradient(90deg, #fbbf24 0%, #d97706 100%)` | Pending appointments, warnings, Orthopedics department |
| **Rose** | `#fb7185` | `#fb71851a` | `#fb718540` | `linear-gradient(90deg, #fb7185 0%, #e11d48 100%)` | Unpaid bills, medical diagnoses, danger buttons, error alerts |

### 2.4 Typography Colors

| Variable | Hex Value | Purpose |
| :--- | :--- | :--- |
| `--text-primary` | `#f1f5f9` | High-contrast primary text, headings, modal titles, table body |
| `--text-secondary` | `#94a3b8` | Muted secondary text, form labels, card subtitles, descriptions |
| `--text-dim` | `#475569` | Dim helper text, icons, table headers (`th`), input placeholders |

---

## 3. Typography & Font Hierarchy

MediCore uses two primary web fonts loaded from Google Fonts via [`index.html`](file:///C:/Users/ghoda/Downloads/hospital-management/frontend/index.html):

```html
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
```

### 3.1 Font Families

* **Primary (`'Outfit', sans-serif`):** Used for all headings, body text, buttons, modal titles, and navigation labels. Smooth geometric styling with high readability.
* **Monospace (`'DM Mono', monospace`):** Used for database IDs (`#101`), dates (`2026-10-21`), currency amounts (`₹15,000`), status labels, and eyebrow tags.

### 3.2 Type Scale

| Role / Element | Font Size | Weight | Tracking (Letter Spacing) | Family | Class / Selector |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Hero / Landing Title** | `36px` | `800` | `-0.5px` | Outfit | `.landing-title` |
| **Page Title** | `28px` | `700` | `-0.5px` | Outfit | `.page-title` (gradient text fill) |
| **Stat Card Metric** | `28px` | `700` | `-1px` | DM Mono | `.stat-value` |
| **Landing Card Title** | `20px` | `700` | Normal | Outfit | `.landing-card-label` |
| **Modal Title** | `18px` | `700` | `-0.3px` | Outfit | `.modal-title` |
| **Brand Title** | `19px` | `700` | `-0.5px` | Outfit | `.brand-name` (gradient text fill) |
| **Body / Default Text** | `14px` | `400` / `500` | Normal | Outfit | `body`, `td`, `.btn` |
| **Section Title** | `13px` | `700` | Normal | Outfit | `.section-title` |
| **Form Label** | `12px` | `600` | `0.3px` | Outfit | `.form-label` |
| **Table Headings** | `11px` | `700` | `1.0px` | Outfit | `th` (uppercase) |
| **Eyebrows & Kickers** | `11px` | `500` | `2.0px` | DM Mono | `.page-eyebrow`, `.landing-kicker` (uppercase) |
| **Mono Code / IDs** | `12px` | `400` / `500` | Normal | DM Mono | `.mono`, `.mono-accent` |

---

## 4. Spacing, Elevation & Corner Radii

### 4.1 Border Radii

```css
--radius:     12px;   /* Buttons, inputs, nav items, pills */
--radius-lg:  18px;   /* Standard cards, table wrappers, stat cards */
--radius-xl:  24px;   /* Dialog modals, login panels, portal landing cards */
pill-radius:  99px;   /* Badges, filter pills, status dots */
```

### 4.2 Elevation & Drop Shadows

* **Small:** `--shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3)` — Subtle component elevation.
* **Medium:** `--shadow: 0 4px 12px rgba(0, 0, 0, 0.4)` — Hover states on cards and buttons.
* **Large:** `--shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.5)` — Floating modals, toast banners.
* **Neon Glow:** `--shadow-glow: 0 0 20px` — Used with accent tints (`--cyan-dim`, `--emerald-glow`, etc.).

### 4.3 Transitions

* Fast Interaction: `--transition: 0.2s cubic-bezier(0.4, 0, 0.2, 1)`
* Smooth Lift: `--transition-slow: 0.35s cubic-bezier(0.4, 0, 0.2, 1)`

---

## 5. Layout Architecture

### 5.1 Application Shell (`.app-shell`)
The core layout is a two-column full-height flex container:
* **Sidebar (`.sidebar`):** Fixed width of `260px`, `height: 100vh`, `border-right: 1px solid var(--border)`, backdrop blur.
* **Main Content (`.main-content`):** `flex: 1`, `overflow-y: auto`, vertical scrolling with custom 6px scrollbars.

```
+--------------------------------------------------------------+
| .app-shell                                                   |
| +----------------+-----------------------------------------+ |
| | .sidebar       | .main-content                           | |
| | (260px)        | +-------------------------------------+ | |
| | - Brand Header | | .page-header (Title + Action Buttons) | |
| | - Nav Section  | +-------------------------------------+ | |
| | - User Profile | | .page-body                          | | |
| | - Footer       | | (Stat cards, search, tables, grids) | | |
| |                | +-------------------------------------+ | |
| +----------------+-----------------------------------------+ |
+--------------------------------------------------------------+
```

### 5.2 Ambient Background Mesh (`#root::before`)
Every authenticated page renders a fixed ambient lighting background behind content:
```css
#root::before {
  content: '';
  position: fixed;
  inset: 0;
  background:
    radial-gradient(ellipse at 20% 0%, #06d6e608 0%, transparent 50%),
    radial-gradient(ellipse at 80% 0%, #a78bfa08 0%, transparent 50%),
    radial-gradient(ellipse at 50% 100%, #10d99205 0%, transparent 50%);
  pointer-events: none;
  z-index: -1;
}
```

---

## 6. Core UI Components & Class Patterns

### 6.1 Buttons (`.btn`)

Buttons share a base class `.btn` with smooth transitions and an inner specular reflection (`.btn::after`):

| Variant | Class Name | Visual Style |
| :--- | :--- | :--- |
| **Primary** | `.btn.btn-primary` | Cyan gradient background, dark text `#02040a`, cyan drop shadow. Lift on hover. |
| **Outline** | `.btn.btn-outline` | Transparent with `--border-lit` border. Glows cyan on hover. |
| **Ghost** | `.btn.btn-ghost` | Fully transparent, subtle background hover highlight. |
| **Danger** | `.btn.btn-danger` | Muted red border and text. Hover gives rose glow background. |
| **Small** | `.btn-sm` | Compact padding (`7px 14px`), `13px` font size. |
| **Extra Small** | `.btn-xs` | Table row action button (`5px 10px`), `12px` font size, `8px` radius. |

```html
<!-- Example Primary Button -->
<button class="btn btn-primary">
  <svg>...</svg> Add Patient
</button>

<!-- Example Danger Action Button -->
<button class="btn btn-danger btn-xs">Delete</button>
```

---

### 6.2 Stat Cards (`.stat-card`)

Stat cards display KPIs on the dashboard and overview screens. Each card features:
* Dynamic color accent bar across the top edge (`3px`).
* Translucent squircle icon container (`44x44px`) that rotates and scales on card hover.
* Monospace metric counter in `'DM Mono'`.
* Aura hover glow matched to the accent color.

**Supported Variants:**
* `.stat-card.cyan`
* `.stat-card.emerald`
* `.stat-card.amber`
* `.stat-card.rose`
* `.stat-card.violet`

```jsx
<div className="stat-card cyan" onClick={handleClick}>
  <div className="stat-icon cyan">
    <PersonIcon />
  </div>
  <div className="stat-value">124</div>
  <div className="stat-label">Total Patients</div>
</div>
```

---

### 6.3 Data Tables (`.table-wrap`)

Data tables are wrapped inside `.table-wrap` (and optionally `.table-scroll` for horizontal responsiveness):
* Surface gradient container with `--radius-lg` (18px) and border `--border`.
* Header (`th`): uppercase tracking `1px`, `--text-dim`, 11px font size.
* Rows (`tbody tr`): hover highlight with `--bg-hover` and inset border glow.
* Hover Actions: Action buttons container `.row-actions` is hidden by default (`opacity: 0`) and fades in on row hover (`opacity: 1`).
* ID badges: `.mono-accent` formats database identifiers (e.g., `#101`) in cyan DM Mono.

```html
<div class="table-wrap table-scroll">
  <table>
    <thead>
      <tr>
        <th>ID</th>
        <th>Patient</th>
        <th>Department</th>
        <th>Status</th>
        <th></th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><span class="mono-accent">#12</span></td>
        <td style="font-weight: 600;">Jane Doe</td>
        <td>Cardiology</td>
        <td><span class="badge badge-paid">Paid</span></td>
        <td>
          <div class="row-actions">
            <button class="btn btn-ghost btn-xs">Edit</button>
            <button class="btn btn-danger btn-xs">Del</button>
          </div>
        </td>
      </tr>
    </tbody>
  </table>
</div>
```

---

### 6.4 Status Badges & Pills (`.badge`)

Pill badges represent status, category, or departmental tags:

| Badge Type | Class Name | Appearance | Typical Usage |
| :--- | :--- | :--- | :--- |
| **Paid / Success** | `.badge-paid` | Emerald background tint with emerald glow | Paid invoices, resolved cases |
| **Unpaid / Alert** | `.badge-unpaid` | Rose background tint with rose glow | Unpaid bills, overdue items |
| **Cyan** | `.badge-cyan` | Cyan border & text | Cardiology, general tags |
| **Violet** | `.badge-violet` | Violet border & text | Neurology, specialist doctor tags |
| **Amber** | `.badge-amber` | Amber border & text | Orthopedics, pending appointments |
| **Rose** | `.badge-rose` | Rose border & text | Medical diagnoses, urgent alerts |

#### Department Color Mapping:
* **Department 1 (Cardiology):** `badge-cyan`
* **Department 2 (Neurology):** `badge-violet`
* **Department 3 (Orthopedics):** `badge-amber`
* **Department 4 (Pediatrics):** `badge-emerald`

---

### 6.5 Form Controls & Inputs

Forms follow a uniform dark input pattern:
* **Inputs & Selects (`.form-input`, `.form-select`):** Dark gradient background (`--bg-input` to `--bg-card`), rounded border (`--radius`). Focus creates a glowing cyan aura (`box-shadow: 0 0 0 3px var(--cyan-dim), 0 0 20px var(--cyan-dim)`).
* **Search Input (`.search-wrap`, `.search-input`):** Contains an embedded SVG search glass pinned to the left, with text indentation (`36px`).
* **Tag Input (`TagInput.jsx`):** Interactive tag chip list for symptoms and multiple phone numbers with instant keyboard addition (Enter) and deletion (Backspace or `×`).

```html
<div class="form-group">
  <label class="form-label">Patient Name</label>
  <input class="form-input" type="text" placeholder="Enter full name..." />
</div>
```

---

### 6.6 Dialog Modals (`.modal-overlay`, `.modal`)

* **Backdrop (`.modal-overlay`):** Fixed full-screen overlay with `rgba(2, 4, 10, 0.85)` and `backdrop-filter: blur(8px)`. ESC key or clicking outside closes the modal.
* **Dialog Container (`.modal`):** Max width `540px`, `--radius-xl` (24px) border radius, gradient card styling, triggered with `@keyframes modalSlideUp`.
* **Standard Structure:** `.modal-header`, `.modal-body`, `.modal-footer` with dual action buttons (Cancel + Save/Submit).

---

### 6.7 Toast Notifications (`.toast`, `.toast-container`)

Toasts appear at the bottom-right of the viewport with slide-in animation:
* **Success Toast (`.toast-success` / `.toast.success`):** Cyan/emerald accented border with glowing aura.
* **Error Toast (`.toast-error` / `.toast.error`):** Rose red border and soft alert glow.
* **Auto-Dismiss:** Built-in 3.2-second timer.

---

### 6.8 Loading States & Shimmer Skeletons

* **Spinner (`.loading`):** Centered animated CSS border spinner (`@keyframes spin`).
* **Skeleton Shimmer (`.skeleton`, `.skeleton-card`, `.skeleton-title`, `.skeleton-text`):** Wave shimmer effect using a moving 200% linear gradient (`@keyframes shimmer`) to preserve layout structure while fetching data.

---

## 7. Portal & Landing Visual Architecture

### 7.1 Landing Page (`Landing.jsx`)
The landing portal displays three gateway cards designed with interactive glowing auras on hover:
1. **Patient Gateway:** Cyan glow, user glyph icon, links to `/login/patient`.
2. **Doctor Gateway:** Violet glow, stethoscope glyph icon, links to `/login/doctor`.
3. **Management Gateway:** Emerald glow, admin grid icon, links to `/login/management`.

### 7.2 Auth Screen (`Login.jsx`)
Floating centered login card (`.login-panel`) with a subtle top cyan laser border line (`background: linear-gradient(90deg, transparent, var(--cyan), transparent)`), back link navigation, and role-tailored hints.

---

## 8. CSS Keyframe Animations

| Animation Name | Duration / Timing | Description |
| :--- | :--- | :--- |
| `pulse` | `2s infinite` | Breathing pulse on the sidebar database connectivity status indicator. |
| `modalSlideUp` | `0.3s cubic-bezier(0.4, 0, 0.2, 1)` | Smooth upwards entrance with slight scale for dialog windows. |
| `fadeIn` | `0.2s ease` | Backdrop opacity transition for modal overlays. |
| `shimmer` | `1.5s ease-in-out infinite` | Moving gradient reflection on skeleton loader blocks. |
| `toastIn` / `slideInRight` | `0.22s - 0.3s ease` | Slide-and-fade in from the right edge for notification bubbles. |
| `spin` | `0.8s linear infinite` | 360-degree rotation for circular loading indicators. |

---

## 9. Design Checklist for New Features

When creating new pages or components for MediCore:
- [ ] Use `Outfit` for text and `DM Mono` for any IDs, dates, counts, or currencies.
- [ ] Apply `var(--bg-card)` or `var(--bg-card-elev)` with `var(--border)` for surfaces.
- [ ] Ensure buttons use `.btn` plus the variant (`.btn-primary`, `.btn-outline`, `.btn-danger`, etc.).
- [ ] Wrap data tables inside `.table-wrap.table-scroll`.
- [ ] Map department badges to their assigned color token (`cyan`, `violet`, `amber`, `emerald`).
- [ ] Provide a `.skeleton-card` or `.loading` state during async API calls.
- [ ] Trigger user feedback through `useToast()` on create, update, and delete actions.
- [ ] Support keyboard navigation (Escape to close modals, Enter for tag submission).
