# Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Desktop framework | Tauri | v2 |
| Backend language | Rust | edition 2021 |
| Frontend framework | React | ~18.3 (React 19) |
| Language | TypeScript | ~5.8.3 (strict mode) |
| Bundler | Vite | ^7.0 |
| Canvas library | Konva | ^9.3 + react-konva ^18.2 |
| State management | Zustand | ^5.0 |
| CSS framework | Tailwind CSS | v4 |
| CSS plugin | @tailwindcss/vite | ^4 |
| Test framework | Vitest | ^4.0 |
| Test environment | jsdom | ^27.4 |
| Test utilities | @testing-library/react | ^16.3 |
| Package manager | npm | (Node 18+) |
| Screenshot lib | xcap | ^0.8 (Rust) |
| Image encoding | image | ^0.25 (Rust) |
| Clipboard | arboard | ^3.4 (Rust) |

## Key Dependencies

- **React 18** not React 19 yet despite docs mention (react-dom ^18.3)
- **Vite 7** (latest) with @vitejs/plugin-react
- **Vitest 4** with globals enabled, jsdom environment
- **Tailwind v4** via Vite plugin (no postcss config needed)
- No ESLint or Prettier configured — relies on TypeScript strict mode for linting
