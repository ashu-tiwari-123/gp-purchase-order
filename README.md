# Purchase Order Builder

A purchase order generator with two panels, same split used by the invoice generator: a plain editable **form** on the left, and a read-only **preview** on the right that live-mirrors it. Click **Download PDF** and your browser's print dialog saves the preview as a PDF (no PDF library, just `window.print()` + print CSS targeting an A4 page).

The preview is built entirely from static text — no `<input>`/`<select>`/`<textarea>` elements exist inside it — so the printed PDF never shows dropdown arrows, empty input boxes, or placeholder hint text. Only what you've actually filled in appears.

No build step, no backend, no dependencies. Just 4 static files:

- `index.html`
- `style.css`
- `app.js`
- `logo.png` — default Gift Plus logo shown in the header

## Run it locally

Open `index.html` directly in a browser, or serve the folder:

```bash
python3 -m http.server 8080
```

## Host it

Upload the 3 files to any static host — no server-side code required:

- **Netlify / Vercel**: drag-and-drop the folder (or connect the repo)
- **GitHub Pages**: push to a repo, enable Pages on the branch
- **Firebase Hosting**: `firebase init hosting` → point public dir here → `firebase deploy`

## Features

- **Form + Preview split**: fill fields in normal bordered form inputs on the left; the right panel is a plain-text, read-only rendering of the same data — the only thing that prints. Desktop shows them side by side (form sticky-scrolls independently); narrow screens stack the form above the preview.
- Pre-filled with your company details (editable) and defaults to GST-compliant India fields (GSTIN, PAN, State) for both your company and the vendor
- Automatic **CGST + SGST** (same state) or **IGST** (different state) split and summary table, based on comparing your company's State to the vendor's State — same logic as the invoice generator
- Dynamic line-items table: add/remove rows, and add/remove **columns** (Text, Number, Quantity, Rate, Discount %, GST %, Amount) via "Manage Columns". Columns are **hidden, not deleted** — toggle any column (including the default ones) back on later without losing data entered in it
- Auto-calculated Subtotal / GST / Round Off / Grand Total, shown only in the preview (they're outputs, not inputs)
- Shipping, other charges, and overall discount fields
- Default logo (`logo.png`) shown on load; click it to upload your own and replace it
- Auto-saves your draft to the browser's local storage (nothing leaves your machine)
- Both the form's and preview's item tables automatically shrink their font size to stay on one line and never wrap/break, no matter how many columns you add
- Preview page scales to fit any screen width (desktop, tablet, mobile) without horizontal scrolling; print output is always true-size A4
- Downloaded PDF filename is set to `<Company Name> <dd-mm-yyyy>.pdf` (e.g. `Gift Plus 18-10-2026.pdf`) via the browser's print dialog — rename it there if your browser doesn't honor the suggested name

## Notes

- Default company details (name, address, GSTIN, PAN, state) are pulled from the invoice generator's seed data. Everything is editable.
- `logo.png` was sourced from thegiftplus.in and cropped to remove its whitespace margins. Upload a different file via the logo box to override it (your upload is saved in the browser draft; `logo.png` stays as the fallback on "New" / a cleared draft).
