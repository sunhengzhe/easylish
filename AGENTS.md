# Repository Guidelines

## Project Structure & Module Organization
- App code lives in `src/app` (App Router: `page.tsx`, `layout.tsx`, styles in `globals.css`).
- Static assets are in `public/` (e.g., `public/*.svg`).
- Configuration lives at the root: `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `postcss.config.mjs`.
- Favor colocated modules (component + styles) within `src/app` when adding new UI.

## Build, Test, and Development Commands
- `pnpm dev` — Run the local dev server with Turbopack.
- `pnpm build` — Production build with Turbopack.
- `pnpm start` — Start the production server (after build).
- `pnpm lint` — Lint the codebase using `eslint-config-next`.
Note: If you prefer npm or yarn, translate commands (e.g., `npm run dev`).

## Coding Style & Naming Conventions
- TypeScript throughout; use 2‑space indentation and descriptive names.
- Components: PascalCase (e.g., `UserCard.tsx`); hooks/utilities: camelCase (e.g., `useFeature.ts`).
- Keep files small and focused; colocate component-specific CSS in the same folder when applicable.
- Rely on ESLint for style and correctness; run `pnpm lint --fix` before opening a PR.

## Testing Guidelines
- No test runner is configured yet. If adding tests, prefer Vitest + React Testing Library.
- Place tests alongside source as `*.test.ts(x)` (e.g., `src/app/UserCard.test.tsx`).
- Aim for meaningful coverage on UI logic and pure functions; mock network/browser APIs as needed.

## Commit & Pull Request Guidelines
- Use Conventional Commits (e.g., `feat: add onboarding card`, `fix: correct null state`).
- PRs should include: clear scope/summary, screenshots for UI changes, and reproduction steps if fixing bugs.
- Link related issues (e.g., `Closes #123`) and keep PRs small, focused, and reviewable.

## Security & Configuration Tips
- Store secrets in environment files (`.env.local`); do not commit them.
- Changes to runtime configuration belong in `next.config.ts` with a brief rationale in the PR.
