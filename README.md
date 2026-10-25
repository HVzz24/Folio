# Folio — Local Resume Studio

A private, local-first CV editor built with React, TypeScript, Vite, Zustand, Zod, Tailwind CSS, and Lucide. Resume data stays in this browser's local storage. There is no account, backend, remote database, or external API.

## Windows setup

1. Install Node.js 20 or later.
2. Open PowerShell in this project folder.
3. Install dependencies: `npm install`
4. Start the local editor: `npm run dev`
5. Open the localhost URL printed by Vite.

Use `npm run build` to create the production bundle in `dist`. To make a PDF, choose **Export PDF** and select **Save as PDF** in the browser print dialog. Keep the print scale at 100% and turn off browser headers and footers for a clean page. The PDF is rendered from selectable document text, not a screenshot. Use **Export JSON** to create a backup or **Import** to restore one.

## GitHub Pages live preview

The included GitHub Actions workflow builds and deploys the site whenever changes are pushed to `main`. For this repository, the site URL is `https://hvzz24.github.io/Folio/`.

1. In the GitHub repository, open **Settings → Pages** and set **Build and deployment → Source** to **GitHub Actions**.
2. Push the project to the `main` branch, or run **Deploy GitHub Pages** from the repository's **Actions** tab.
3. Wait for the workflow's build and deploy jobs to finish, then open the site URL above.

GitHub Pages is public. The published app starts with fictional Jane Doe sample data. Each visitor's CV edits are kept in that visitor's own browser storage; the app has no server or external API and does not send CV contents to GitHub. Never commit real CVs, personal exports, or private data.

## Local data

The browser saves edits automatically in local storage. Clearing this site's browser data also clears the saved CV, so export a JSON backup when needed. Imported files are validated before replacing the current document. The default document data lives in `src/data/defaultResume.ts` and uses fictional Jane Doe sample content; headings, entries, subsections, and design settings are editable in the app.

The sample is safe to publish, but a browser's existing local storage is not part of the project and is not cleared by changing the sample. Personal CV PDFs, Word documents, JSON backups, LaTeX files, environment files, and build outputs are ignored by `.gitignore`. Keep private source documents out of tracked files.

## Features

- Edit profile, summary, education, experience, projects, list-style subsections, and custom sections.
- Rename, hide, reorder (drag), add, and delete sections and subsections.
- Add, remove, and reorder entries, list items, and achievement bullets.
- Live document preview, zoom, typography, page size, margins, spacing, and column controls.
- Persistent light and dark editor themes; the resume page stays white for accurate preview and printing.
- Browser print / save as PDF, validated JSON import/export, and a reset-to-default action.
- Local ATS-style comparison against a pasted job description, scanning all enabled CV content and normalizing common skill aliases (for example, MySQL/SQL, Git/GitHub, React.js/React, and WordPress/Word Press). Experience alignment includes professional experience and project descriptions. This rule-based estimate runs in the browser and is not an employer ATS prediction.
