# Files Menu — Implementation Plan (Master Index)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:subagent-driven-development (recommended) or superpowers-extended-cc:executing-plans to implement this plan task-by-task.

**Goal:** Add a native File menu with project file (.bshot) support — Open, Save, Export, Close, Delete.

**Architecture:** Hybrid — Rust native menu bar emits Tauri events; React hooks handle all UI logic. Project files are ZIP archives (`.bshot`) with `project.json` + `screenshot.png`.

**Tech Stack:** Rust (Tauri v2, `zip` + `trash` crates), TypeScript (React 18, Zustand, Konva)

**Parts:**
- [Part 1](2026-07-04-files-menu-plan-p1.md) — Rust dependencies (zip, trash), TypeScript project types, Rust file operations
- [Part 2](2026-07-04-files-menu-plan-p2.md) — Rust File submenu, Zustand project store
- [Part 3](2026-07-04-files-menu-plan-p3.md) — Frontend file API wrappers, use-file-menu hook, delete confirmation modal
- [Part 4](2026-07-04-files-menu-plan-p4.md) — Drag-drop integration, App.tsx wiring

**Task Dependency Graph:**
```
Task 1 (zip/trash deps)
  └→ Task 3 (Rust file ops)

Task 2 (project types)
  ├→ Task 5 (project store)
  ├→ Task 6 (file-api wrappers)
  └→ Task 3 (Rust structs — already uses ProjectData from TS side)

Task 4 (File submenu) — independent, can run in parallel

Task 5 + Task 6
  └→ Task 7 (use-file-menu hook)
  └→ Task 8 (delete confirm modal)

Task 6
  └→ Task 9 (drag-drop)

Task 7 + Task 8
  └→ Task 10 (App.tsx wiring)
```

**Order of execution:**
1. Task 1 + Task 2 (parallel)
2. Task 3 + Task 4 (parallel, Task 3 needs Task 1)
3. Task 5 + Task 6 (parallel, both need Task 2)
4. Task 7 + Task 8 (parallel, need Tasks 5+6)
5. Task 9 (needs Task 6)
6. Task 10 (needs Tasks 7+8)

---
