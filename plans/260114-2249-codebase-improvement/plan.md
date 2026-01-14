# Codebase Improvement Plan

**Date:** 2026-01-14
**Status:** Draft
**Priority:** Medium

---

## Executive Summary

Full codebase review completed. **Overall Score: 8/10**. No critical bugs or security vulnerabilities. Main areas for improvement: component size reduction, accessibility gaps, and performance optimization via selectors.

---

## Review Reports

| Area | Score | Report |
|------|-------|--------|
| Rust Backend | 8.5/10 | [rust-backend.md](../reports/code-review-260114-2249-rust-backend.md) |
| React Components | 7.5/10 | [react-components.md](../reports/code-review-260114-2249-react-components.md) |
| Hooks & Utils | 8.5/10 | [hooks-utils.md](../reports/code-review-260114-2249-hooks-utils.md) |
| Zustand Stores | 7.5/10 | [stores.md](../reports/code-review-260114-2249-stores.md) |

---

## Key Findings

### Critical Issues: **None**

### High Priority (5)
1. **8 components exceed 200 LOC** - background-panel.tsx largest at 495 LOC
2. **Missing selectors** - 600+ store accesses causing unnecessary re-renders
3. **Accessibility gaps** - region-overlay, crop-overlay lack keyboard nav
4. **Cross-store coupling** - annotation/canvas/history tightly linked
5. **Linux grim PATH risk** - external binary without validation

### Medium Priority (8)
6. Missing memoization in expensive calculations
7. Code duplication (modal patterns, PNG encoding)
8. Error information leakage to frontend
9. Magic numbers scattered across files
10. Mutex poisoning handling needs documentation
11. No devtools middleware for debugging
12. Callback storage anti-pattern in annotation-store
13. UserAgent sniffing instead of Tauri platform API

---

## Improvement Phases

| Phase | Focus | Status | Link |
|-------|-------|--------|------|
| 01 | Security Hardening | Pending | [phase-01](./phase-01-security-hardening.md) |
| 02 | Component Splitting | Pending | [phase-02](./phase-02-component-splitting.md) |
| 03 | Performance Optimization | Pending | [phase-03](./phase-03-performance-optimization.md) |
| 04 | Accessibility | Pending | [phase-04](./phase-04-accessibility.md) |
| 05 | Code Quality | Pending | [phase-05](./phase-05-code-quality.md) |

---

## Quick Wins (Do Now)
- [ ] Add grim binary path validation (Linux)
- [ ] Extract magic numbers to constants
- [ ] Add devtools middleware to stores
- [ ] Remove unused `cropRect` from deps array

---

## Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Avg Component Size | 332 LOC | <200 LOC |
| Store Selector Usage | 0% | 80% |
| Accessibility Score | 5/10 | 8/10 |
| Type Coverage | 100% | 100% |
| Build Status | Clean | Clean |

---

## Unresolved Questions

1. Should wallpaper parsing move to Web Worker?
2. Is 150ms delay in region-overlay sufficient for all platforms?
3. What's the expected max annotations count? (affects memoization strategy)
4. Should implement virtual scrolling for large window lists?
5. Timeline for production error tracking (Sentry)?
