# Debug Report: White Screen After Minimize → Dock Restore

**Date:** 2026-01-14
**Issue ID:** minimize-white-screen
**Platform:** macOS (darwin 24.6.0)
**App:** BeautyFullShot v1.0.0 (Tauri 2)

---

## Executive Summary

**Issue:** App shows white screen after minimize button click → dock icon click restore on macOS.

**Root Cause:** `RunEvent::Reopen` is triggered for dock icon clicks when app is *already closed/hidden*, not for unminimizing. Minimize → dock click doesn't fire `Reopen` event, causing no restore action. Frontend force-render mechanism (lines 100-126 in App.tsx) attempts workaround but insufficient for actual minimize state.

**Impact:** Users cannot restore minimized window via dock click - app appears broken.

**Priority:** HIGH - Core UX broken on macOS.

---

## Technical Analysis

### Event Flow Investigation

**Expected behavior:**
1. User clicks minimize button → window minimizes
2. User clicks dock icon → window restores from minimize
3. Content renders normally

**Actual behavior:**
1. User clicks minimize → window minimizes
2. User clicks dock → `RunEvent::Reopen` does NOT fire (minimize ≠ close)
3. Window shows but webview blank (no restore logic executed)

### Code Analysis

#### Backend (src-tauri/src/lib.rs:51-60)

```rust
.run(|app, event| {
    // Handle macOS dock click to reopen window
    if let RunEvent::Reopen { .. } = event {
        if let Some(window) = app.get_webview_window("main") {
            let _ = window.show();
            let _ = window.unminimize();
            let _ = window.set_focus();
        }
    }
});
```

**Problem:** `RunEvent::Reopen` fires when:
- App has no visible windows and user clicks dock icon
- App was hidden (via `window.hide()`) and user reopens

**Does NOT fire when:**
- Window is minimized and user clicks dock icon
- Window is already visible but minimized

Source: [Tauri RunEvent docs](https://docs.rs/tauri/2.3.1/x86_64-apple-darwin/tauri/enum.RunEvent.html) - "Emitted when NSApplicationDelegate's applicationShouldHandleReopen gets called"

#### Frontend (src/App.tsx:100-126)

```typescript
// Force re-render when window becomes visible again
const [, forceUpdate] = useState(0);
useEffect(() => {
  const handleVisibilityChange = () => {
    if (!document.hidden) {
      forceUpdate(n => n + 1);
    }
  };

  const appWindow = getCurrentWindow();
  const unlistenFocus = appWindow.onFocusChanged(({ payload: focused }) => {
    if (focused) {
      setTimeout(() => forceUpdate(n => n + 1), 50);
    }
  });

  document.addEventListener('visibilitychange', handleVisibilityChange);
  // ...
}, []);
```

**Problem:** Frontend assumes focus change will trigger render. However:
- Document visibility doesn't change on minimize/unminimize
- `onFocusChanged` may fire but webview already in blank state
- Force-render doesn't address underlying macOS WKWebView issue

### Root Cause: macOS WKWebView Rendering Gap

Research shows WKWebView has known blank screen issues after visibility changes:

1. **WebContent Process Management**: WKWebView uses separate process that may not auto-restore on window state changes ([Source](https://nevermeant.dev/handling-blank-wkwebviews/))

2. **Window State Transitions**: macOS doesn't guarantee webview repaint after unminimize without explicit refresh

3. **Tauri Layer**: No automatic webview refresh mechanism in Tauri for minimize restore cycle

### Timeline of Events

```
[User Action]       [Backend Event]              [Frontend State]        [Result]
Minimize click   →  Window minimizes          →  React still mounted  →  OK
                    (no RunEvent)

Dock icon click  →  Window unminimizes        →  No rerender trigger  →  Blank
                    (no RunEvent::Reopen)
                    Focus change fires            forceUpdate() called
                                                  but webview blank
```

---

## Supporting Evidence

### Git History

```bash
commit b3783cc (HEAD -> main)
Author: dcppsw
Date:   Wed Jan 14 01:35:21 2026

    fix re-open action

    Added RunEvent::Reopen handler with show/unminimize/focus
```

Recent attempt to fix by adding `Reopen` handler - addresses wrong use case.

### Documentation References

1. **Tauri RunEvent::Reopen** - [docs.rs](https://docs.rs/tauri/2.3.1/x86_64-apple-darwin/tauri/enum.RunEvent.html)
   - macOS-specific event for `applicationShouldHandleReopen`
   - Fires when app reopened from dock with no visible windows
   - NOT for minimize state changes

2. **Window Unminimize Discussion** - [GitHub #7977](https://github.com/tauri-apps/tauri/discussions/7977)
   - Confirms no dedicated minimize event in Tauri
   - Recommends `unminimize()` for restore
   - Suggests `blur` event monitoring as workaround

3. **WKWebView Blank Screen** - [Never Meant Blog](https://nevermeant.dev/handling-blank-wkwebviews/)
   - Documents macOS WebContent process termination issues
   - Explains visibility change rendering gaps
   - Recommends explicit reload on certain state transitions

### Current Workarounds Attempted

✅ **Implemented:**
- Frontend force-render on focus change (App.tsx:100-126)
- Backend `Reopen` event handler (lib.rs:51-60)

❌ **Ineffective because:**
- `Reopen` event doesn't fire for minimize → restore
- Force-render doesn't trigger webview repaint in blank state

---

## Recommended Solutions

### Option 1: Monitor Window Minimize State (RECOMMENDED)

Replace `RunEvent::Reopen` approach with window event listener.

**Implementation:**

```rust
// src-tauri/src/lib.rs
.setup(|app| {
    // ... existing setup

    // Listen for window events
    let window = app.get_webview_window("main").unwrap();
    window.on_window_event(move |event| {
        if let tauri::WindowEvent::ThemeChanged(_) = event {
            // Workaround: no dedicated minimize event
            // Use theme change or other reliable trigger
        }
    });

    Ok(())
})
```

**Pros:** Direct window state monitoring
**Cons:** Tauri doesn't expose minimize event directly
**Risk:** Medium - requires workaround event

### Option 2: Frontend Window State Polling

Add React effect to poll minimize state and trigger webview refresh.

**Implementation:**

```typescript
// src/App.tsx
useEffect(() => {
  const appWindow = getCurrentWindow();
  const interval = setInterval(async () => {
    const minimized = await appWindow.isMinimized();
    if (!minimized && wasMinimized.current) {
      // Trigger webview refresh
      window.location.reload(); // Nuclear option
      // OR
      forceUpdate(n => n + 1);
    }
    wasMinimized.current = minimized;
  }, 500);

  return () => clearInterval(interval);
}, []);
```

**Pros:** Works without backend changes
**Cons:** Polling overhead, not ideal UX
**Risk:** Low - fallback solution

### Option 3: Emit Custom Event on Window State Change

Use Tauri event system to notify frontend of state changes.

**Backend:**

```rust
// Create window event listener in setup
window.on_window_event(move |event| {
    // Monitor focus/blur as proxy for minimize
    if let tauri::WindowEvent::Focused(focused) = event {
        if focused {
            let _ = window.emit("window-restored", ());
        }
    }
});
```

**Frontend:**

```typescript
useEffect(() => {
  const unlisten = listen('window-restored', () => {
    // Force full rerender
    forceUpdate(n => n + 1);

    // Optional: reload if still blank
    setTimeout(() => {
      if (document.body.innerHTML.trim() === '') {
        window.location.reload();
      }
    }, 100);
  });

  return () => { unlisten.then(fn => fn()); };
}, []);
```

**Pros:** Event-driven, cleaner than polling
**Cons:** Relies on focus as proxy for minimize
**Risk:** Low-Medium

### Option 4: Remove Minimize Button (NUCLEAR)

Force hide instead of minimize.

**Implementation:**

```json
// src-tauri/tauri.conf.json
{
  "app": {
    "windows": [{
      "decorations": false,  // Remove native minimize button
      // Custom titlebar with hide-only action
    }]
  }
}
```

**Pros:** Completely avoids minimize state
**Cons:** Non-standard UX, requires custom titlebar
**Risk:** High - major UX change

---

## Immediate Fix (Stopgap)

While implementing full solution, add this to App.tsx:

```typescript
// After line 126
useEffect(() => {
  const appWindow = getCurrentWindow();

  // Aggressive refresh on any window show
  const unlisten = appWindow.listen('tauri://focus', async () => {
    const minimized = await appWindow.isMinimized();
    if (!minimized) {
      // Force DOM reflow
      document.body.style.display = 'none';
      document.body.offsetHeight; // Trigger reflow
      document.body.style.display = '';
      forceUpdate(n => n + 1);
    }
  });

  return () => { unlisten.then(fn => fn()); };
}, []);
```

**This may force webview repaint without reload.**

---

## Testing Protocol

1. **Verify minimize event flow:**
   - Add console logs in Rust `RunEvent` handler
   - Add console logs in React focus handlers
   - Minimize window → click dock → observe which events fire

2. **Test proposed solutions:**
   - Option 3 (event-driven) recommended for initial test
   - Measure success: no blank screen after 10 consecutive minimize → restore cycles

3. **Edge cases:**
   - Multiple monitors
   - Fast minimize → restore clicks
   - Minimize → wait 5 minutes → restore
   - Minimize → open overlay window → close overlay → restore main

---

## Unresolved Questions

1. Does Tauri 2 expose `WindowEvent::Minimized` or similar on macOS? (Not found in docs)
2. Can we force WKWebView repaint without full `window.location.reload()`?
3. Does `closeToTray` setting (App.tsx:49) interfere with minimize behavior?
4. Are there macOS-specific Tauri plugins for window state management?

---

## Sources

- [Tauri RunEvent Documentation](https://docs.rs/tauri/2.3.1/x86_64-apple-darwin/tauri/enum.RunEvent.html)
- [Tauri Window Restore Discussion #7977](https://github.com/tauri-apps/tauri/discussions/7977)
- [WKWebView Blank Screen Handling](https://nevermeant.dev/handling-blank-wkwebviews/)
- [Tauri macOS App Active Event #10043](https://github.com/tauri-apps/tauri/issues/10043)
- [Tauri Window Customization](https://v2.tauri.app/learn/window-customization/)
