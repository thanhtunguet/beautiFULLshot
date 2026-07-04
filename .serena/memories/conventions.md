# Code Conventions

## File Naming
- **Components**: PascalCase (e.g., `CanvasEditor.tsx`, `BackgroundPanel.tsx`)
- **Hooks**: camelCase with `use` prefix (e.g., `useScreenshot.ts`, `useImage.ts`)
- **Stores**: camelCase with `-store` suffix (e.g., `canvas-store.ts`)
- **Types**: camelCase (e.g., `screenshot.ts`, `annotations.ts`)
- **Utils**: camelCase (e.g., `screenshot-api.ts`, `export-utils.ts`)
- **Data**: camelCase (e.g., `gradients.ts`, `wallpapers.ts`)
- **Constants**: camelCase (e.g., `canvas.ts`, `annotations.ts`)

## TypeScript
- `strict: true`, `noUnusedLocals: true`, `noUnusedParameters: true`
- No `any` type — use `unknown` with narrowing if needed
- Use `type` keyword for type-only imports (e.g., `import type { WindowInfo } from '...'`)
- Explicit return types on exported functions

## React Components
- Functional components with named exports (`export function ComponentName()`)
- Props interface declared before component (e.g., `interface CanvasEditorProps`)
- Component structure order: hooks → callbacks (`useCallback`) → effects (`useEffect`) → return
- Event handlers prefixed `handle` (e.g., `handleWheel`, `handleDragEnd`)
- Avoid inline function definitions in JSX

## Zustand Stores
- One file per store
- State interface first, then `create<StateInterface>()`
- Actions as methods on the state object
- Memory cleanup: revoke old blob URLs before setting new ones
- Use `persist` middleware for settings/background stores (localStorage keys prefixed `beautyshot-`)

## Tailwind CSS
- Utility-first approach (no custom CSS unless necessary)
- Dark mode: `dark:` prefix classes
- Custom glass/shadow effects via utility classes defined in `styles.css`

## Rust Backend
- Modules: one file per concern (`screenshot.rs`, `overlay.rs`, etc.)
- Tauri commands: `#[tauri::command]` with `Result<T, String>` return
- Image data: `Vec<u8>` (PNG bytes) or base64-encoded strings
- macOS-specific code behind `#[cfg(target_os = "macos")]`

## Commit Messages
- Format: `type(scope): description`
- Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`

## Test Files
- Tests in `__tests__/` subdirectories next to the code they test
- Vitest with `globals: true`, `environment: 'jsdom'`
