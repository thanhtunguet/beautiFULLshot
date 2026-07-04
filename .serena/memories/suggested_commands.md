# Suggested Commands

## Development
```bash
npm run dev         # Frontend dev server (Vite on port 1420)
npm run tauri dev   # Tauri dev mode (starts Vite + Rust backend)
```

## Build
```bash
npm run build             # TypeScript check + Vite production build
npm run tauri build       # Tauri production build (binary)
npm run tauri:build:local # Build with local Tauri config (dev signing)
```

## Testing
```bash
npm test            # Vitest (headless)
npm run test:ui     # Vitest UI
npm run test:coverage  # Vitest with coverage
```

## Type Checking
```bash
npx tsc --noEmit    # TypeScript compile check (no ESLint configured)
```

## Preview
```bash
npm run preview     # Vite preview of production build
```

## Tauri Utilities
```bash
npm run tauri:gen:dev-key  # Generate Tauri dev signing key
```

## Cleanup / Reset
```bash
rm -rf node_modules dist src-tauri/target
npm install
```
