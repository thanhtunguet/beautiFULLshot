# Crop Aspect Ratio Bug Investigation Report

**Date:** 2026-01-14
**Status:** Root Cause Identified
**Severity:** High - Feature Broken

## Executive Summary

Crop aspect ratio buttons (1:1, 4:3, 16:9, etc.) fail to constrain crop rectangle. Root cause identified in `crop-store.ts` and missing implementation in `crop-overlay.tsx`. Three test failures confirm issue.

## Root Cause Analysis

### Primary Issue: Missing Aspect Ratio Enforcement in setAspectRatio

**File:** `/Users/dcppsw/Projects/beautyshot/src/stores/crop-store.ts`
**Line:** 58

```typescript
setAspectRatio: (ratio) => set({ aspectRatio: ratio }),
```

**Problem:** `setAspectRatio` only updates the `aspectRatio` state but does NOT adjust the existing `cropRect` to match the new aspect ratio. When user clicks aspect ratio button, the crop rectangle shape remains unchanged.

### Secondary Issue: applyCrop Clears State Prematurely

**File:** `/Users/dcppsw/Projects/beautyshot/src/stores/crop-store.ts`
**Lines:** 39-42

```typescript
applyCrop: () => {
  // After cropImage() is called, the image is actually cropped
  // Clear cropRect since it's no longer valid for the new cropped image
  set({ isCropping: false, cropRect: null, aspectRatio: null });
},
```

**Problem:** `applyCrop()` clears `cropRect` and `aspectRatio` immediately. However, tests expect these values to be preserved after applying crop. This creates inconsistency between implementation and expected behavior.

### Tertiary Issue: cancelCrop Doesn't Preserve aspectRatio

**File:** `/Users/dcppsw/Projects/beautyshot/src/stores/crop-store.ts`
**Lines:** 52-56

```typescript
cancelCrop: () =>
  set({
    isCropping: false,
    cropRect: null,
  }),
```

**Problem:** Unlike `applyCrop`, `cancelCrop` doesn't reset `aspectRatio`, creating behavioral inconsistency between the two exit paths.

## Test Failures

Three tests fail in `/Users/dcppsw/Projects/beautyshot/src/stores/__tests__/crop-store.test.ts`:

1. **Line 141**: `should preserve crop rect when applied`
   - Expected: `cropRect` preserved after `applyCrop()`
   - Actual: `cropRect` is `null`

2. **Line 148**: `should preserve aspect ratio when applied`
   - Expected: `aspectRatio` preserved after `applyCrop()`
   - Actual: `aspectRatio` is `null`

3. **Line 249**: `should handle complete crop workflow`
   - Expected: `cropRect` preserved in complete workflow
   - Actual: `cropRect` is `null`

## System Behavior Analysis

### Current Flow

1. User clicks "Start Crop" → `startCrop()` called → `isCropping = true`, `cropRect = null`
2. User clicks aspect ratio button (e.g., "1:1 Square") → `setAspectRatio(1)` called
3. `aspectRatio` state updates to `1`, but `cropRect` remains unchanged
4. `CropOverlay` reads `aspectRatio` and applies `keepRatio={aspectRatio !== null}` to Transformer
5. Transformer constrains **future resizes** to aspect ratio but doesn't retroactively adjust existing rectangle

### Why Aspect Ratios Appear Broken

The Transformer's `keepRatio` prop only affects **ongoing transformations**. When user:
- Switches from "Free" to "1:1 Square": existing crop rectangle doesn't reshape
- Drags handles: Transformer then enforces aspect ratio
- But initial visual feedback is missing - user doesn't see immediate change

### Correct Flow (Expected)

1. User clicks aspect ratio button
2. `setAspectRatio()` should:
   - Update `aspectRatio` state
   - Adjust existing `cropRect` dimensions to match new aspect ratio
   - Preserve crop area center or maximize fit within bounds
3. Visual feedback immediate - crop rectangle reshapes on button click

## Technical Evidence

### CropOverlay Implementation Analysis

**File:** `/Users/dcppsw/Projects/beautyshot/src/components/canvas/crop-overlay.tsx`
**Lines:** 184, 220-236

```typescript
// Line 184: Transformer keeps ratio only during transforms
keepRatio={aspectRatio !== null}

// Lines 220-236: boundBoxFunc enforces aspect ratio during resize
if (aspectRatio !== null) {
  const targetRatio = aspectRatio;
  if (width / height > targetRatio) {
    height = width / targetRatio;
    // Re-check bounds...
  } else {
    width = height * targetRatio;
    // Re-check bounds...
  }
}
```

This confirms aspect ratio enforcement works **during resize** but not when aspect ratio changes.

### CropPanel UI

**File:** `/Users/dcppsw/Projects/beautyshot/src/components/sidebar/crop-panel.tsx`
**Lines:** 65-79

```typescript
{ASPECT_RATIOS.map((ar) => (
  <button
    key={ar.id}
    onClick={() => setAspectRatio(ar.ratio)}
    className={`...${aspectRatio === ar.ratio ? 'bg-blue-500 text-white' : '...'}`}
  >
    {ar.name}
  </button>
))}
```

Button correctly calls `setAspectRatio()` and shows active state, but underlying function doesn't adjust crop rectangle.

## Impact Assessment

### User Experience
- **Severity:** High
- **Frequency:** Every crop operation using aspect ratio presets
- **Workaround:** Users must manually drag handles to approximate ratio (poor UX)
- **Perception:** Feature appears broken or non-functional

### Business Impact
- Core crop feature degraded
- User trust in application quality impacted
- May drive users to competitor tools

## Recommended Solutions

### Solution 1: Adjust cropRect in setAspectRatio (Recommended)

**Implementation:**
```typescript
setAspectRatio: (ratio) =>
  set((state) => {
    if (!state.cropRect) return { aspectRatio: ratio };

    const { x, y, width, height } = state.cropRect;
    let newWidth = width;
    let newHeight = height;

    if (ratio !== null) {
      // Adjust dimensions to match aspect ratio
      // Keep center point fixed
      const currentRatio = width / height;

      if (currentRatio > ratio) {
        // Too wide, reduce width
        newWidth = height * ratio;
      } else {
        // Too tall, reduce height
        newHeight = width / ratio;
      }

      // Recenter crop area
      const newX = x + (width - newWidth) / 2;
      const newY = y + (height - newHeight) / 2;

      // Clamp to image bounds (need originalWidth/Height from canvas store)
      // Implementation details depend on store architecture
    }

    return {
      aspectRatio: ratio,
      cropRect: { x: newX, y: newY, width: newWidth, height: newHeight },
    };
  }),
```

**Pros:**
- Immediate visual feedback
- Intuitive UX - rectangle reshapes on button click
- Matches user expectations

**Cons:**
- Requires access to `originalWidth`/`originalHeight` for bounds checking
- More complex implementation

### Solution 2: Keep Current Behavior, Fix Tests

Update test expectations to accept clearing behavior. Document that aspect ratio only affects future transforms.

**Pros:**
- Minimal code changes
- Preserves current architecture

**Cons:**
- Poor UX - no visual feedback on aspect ratio selection
- Doesn't solve user's problem

### Solution 3: Fix applyCrop and cancelCrop Consistency

Regardless of Solution 1/2, fix state clearing inconsistency:

```typescript
applyCrop: () => {
  set({ isCropping: false, cropRect: null, aspectRatio: null });
},

cancelCrop: () => {
  set({ isCropping: false, cropRect: null, aspectRatio: null });
},
```

Both should clear all state consistently.

## Next Steps

1. **Immediate:** Implement Solution 1 + Solution 3
   - Fix `setAspectRatio` to adjust cropRect
   - Fix state clearing consistency

2. **Testing:**
   - Run crop-store tests: `npm test src/stores/__tests__/crop-store.test.ts`
   - Manual testing of all aspect ratios
   - Edge case testing (crop near boundaries)

3. **Documentation:**
   - Update crop feature documentation
   - Add inline comments explaining aspect ratio logic

## Supporting Evidence

### File Structure
```
src/
├── components/
│   ├── canvas/
│   │   └── crop-overlay.tsx (Transformer with keepRatio)
│   └── sidebar/
│       └── crop-panel.tsx (Aspect ratio buttons)
├── stores/
│   ├── crop-store.ts (State management - BUG HERE)
│   └── __tests__/
│       └── crop-store.test.ts (3 failures)
└── data/
    └── aspect-ratios.ts (Ratio definitions)
```

### Test Output
```
FAIL  src/stores/__tests__/crop-store.test.ts
  ✓ 28 passed
  ✗ 3 failed
    - should preserve crop rect when applied
    - should preserve aspect ratio when applied
    - should handle complete crop workflow
```

## Unresolved Questions

1. Should aspect ratio adjustment prioritize:
   - Keeping center point fixed?
   - Maximizing crop area?
   - Maintaining top-left anchor?

2. What happens if aspect ratio adjustment pushes crop outside image bounds?
   - Shrink to fit?
   - Clamp and recalculate?

3. Should "Free" aspect ratio allow switching back without losing crop dimensions?
   - Current behavior: switches to freeform
   - Alternative: remember last freeform dimensions
