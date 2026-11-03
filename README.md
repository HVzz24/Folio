    # Folio

Folio is a simple, private CV editor for creating a clear, professional resume without fighting page layouts. Edit your content, see changes in a live preview, and adjust the design to make a focused one-page CV that is easy to read.

**[Open the live editor](https://hvzz24.github.io/Folio/)**

## What you can do

- Edit your profile, summary, experience, education, projects, skills, and custom sections.
- Hide, show, and reorder the built-in Professional Summary, Education, and Professional Experience sections.
- Create custom sections, then rename, hide, show, reorder, or delete them.
- Add multiple custom-labeled details to entries, such as technologies, tools, or responsibilities.
- Paste a Markdown CV, review detected sections and entries, then confirm before replacing the current content. Parsing runs locally in the browser.
- See your CV update as you edit.
- Choose A4 or Letter paper, one or two columns, and adjust typography, margins, and spacing.
- Print or save a selectable-text PDF from your browser.
- Export a JSON backup and import it later.
- Compare your CV with a job description using the optional, in-browser ATS-style analysis. Its score is an estimate, not a prediction of an employer's ATS results.

For a one-page CV, keep the most relevant details and adjust font size, margins, and spacing while checking the preview. Folio gives you control over the layout; it does not automatically guarantee that every CV will fit on one page.

## Get started

You can use the [live editor](https://hvzz24.github.io/Folio/) or run Folio locally.

### Run locally

**Requirements:** Node.js 20 or later and npm.

```bash
git clone https://github.com/hvzz24/Folio.git
cd Folio
npm install
npm run dev
```

Open the local URL shown in the terminal.

To create a production build:

```bash
npm run build
```

The built files are written to `dist`.

## Export a PDF

Select **Export PDF** and choose **Save as PDF** in the browser's print dialog. For a clean page, use 100% scale and turn off browser headers and footers. Check the print preview before saving.

## Your data and privacy

Folio saves your CV in local storage in the browser you are using. The app has no account or backend, and CV content is not sent to a remote service. Your browser's local data is separate from exported files.

Export a JSON backup if you want to move your CV to another browser or device. Clearing the browser's site data will delete the locally saved CV. Imported files are checked before they replace the current document.

Pasted CV text is parsed in your browser and is not uploaded. Replacing the document updates its profile and sections while keeping its design settings.

The live demo starts with fictional sample content. Edits you make in the demo are saved only in your own browser. Do not enter private information on a shared device, and do not commit personal CVs or exports to a public repository.

## Deploy to GitHub Pages

This repository includes a GitHub Actions workflow that builds and deploys the site when changes are pushed to `main`.

1. In your repository, open **Settings → Pages** and set the source to **GitHub Actions**.
2. Push to `main`, or run the **Deploy GitHub Pages** workflow from the **Actions** tab.
3. After the workflow succeeds, open your repository's Pages URL.

## Built with

React, TypeScript, Vite, Zustand, Zod, Tailwind CSS, and Lucide.
