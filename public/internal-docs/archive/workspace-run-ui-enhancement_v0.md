<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# Terraform Workspace Run UI Enhancement Plan

## Overview

This document outlines the plan to enhance the Terraform workspace run detail view by combining the timeline and output sections into a unified, space-efficient layout inspired by Terraform Enterprise's design.

## Current State

### Current Layout (RunDetail.tsx)

The current implementation displays:
1. **Left Sidebar**: `VerticalRunTimeline` component showing run phases (Created → Planning → Planned → Applying → Applied)
2. **Main Content Area**: Separate collapsible sections for:
   - Plan Phase output (`OutputViewer`)
   - Apply Phase output (`ApplyOutputViewer`)
   - Resource graph (if available)

### Issues with Current Design

1. **Space Inefficiency**: Timeline and outputs are displayed side-by-side, wasting horizontal space
2. **Disconnected Flow**: Timeline and outputs are visually separated, making it hard to see the relationship between phases and their outputs
3. **Redundant Information**: The timeline shows phases, but users need to scroll to find corresponding outputs

## Proposed Design

### Terraform Enterprise-Inspired Unified Layout

The new design will integrate the timeline directly into the output flow:

```
┌─────────────────────────────────────────────────┐
│  Run Header (Status, Actions, Metadata)        │
└─────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────┐
│  ┌─● Created                                    │
│  │  [timestamp]                                 │
│  │  │                                           │
│  └─● Planning                                   │
│     [timestamp]                                 │
│     │                                           │
│     ▼                                           │
│  ┌──────────────────────────────────────────┐  │
│  │  Plan Phase                               │  │
│  │  [Plan Output Content]                    │  │
│  │  • Resource changes                       │  │
│  │  • Output changes                         │  │
│  │  • Plan summary                           │  │
│  └──────────────────────────────────────────┘  │
│     │                                           │
│     ▼                                           │
│  ┌─● Planned                                    │
│  │  [timestamp]                                 │
│  │  │                                           │
│  │  [Apply/Discard Buttons]                    │
│  │  │                                           │
│  └─● Applying                                   │
│     [timestamp]                                 │
│     │                                           │
│     ▼                                           │
│  ┌──────────────────────────────────────────┐  │
│  │  Apply Phase                              │  │
│  │  [Apply Output Content]                   │  │
│  │  • Resource creation/updates              │  │
│  │  • Real-time log streaming                │  │
│  │  • Apply summary                          │  │
│  └──────────────────────────────────────────┘  │
│     │                                           │
│     ▼                                           │
│  ┌─● Applied                                    │
│     [timestamp]                                 │
└─────────────────────────────────────────────────┘
```

### Key Design Elements

1. **Timeline Nodes as Section Headers**
   - Each phase (Created, Planning, Planned, Applying, Applied) becomes a circular node in the timeline
   - Nodes are positioned above their corresponding output sections
   - Active phase nodes show animated spinners
   - Completed phases show green checkmarks

2. **Vertical Flow**
   - Timeline flows vertically from top to bottom
   - Lines connect timeline nodes to output boxes
   - Output boxes are visually connected to their phase nodes

3. **Integrated Output Sections**
   - Plan output appears directly below "Planning" phase
   - Apply output appears directly below "Applying" phase
   - Resource graph (if available) can be integrated into the output sections

4. **Progressive Disclosure**
   - Output sections can be collapsed/expanded
   - Collapsed sections show summary information
   - Expanded sections show full output

## Implementation Plan

### Phase 1: Component Architecture

#### 1.1 Create New Unified Timeline Component

**File**: `frontend/src/components/runs/UnifiedRunTimeline.tsx`

**Features**:
- Combines timeline nodes with output sections
- Handles phase-to-output mapping
- Manages expand/collapse state for each section
- Supports real-time updates during run execution

**Props**:
```typescript
interface UnifiedRunTimelineProps {
  run: Run;
  planOutput?: PlanOutput | null;
  applyOutput?: string | null;
  planOutputLoading?: boolean;
  applyOutputLoading?: boolean;
  onSectionToggle?: (phase: string, expanded: boolean) => void;
  defaultExpanded?: { [phase: string]: boolean };
}
```

#### 1.2 Create Timeline Node Component

**File**: `frontend/src/components/runs/TimelineNode.tsx`

**Features**:
- Renders a single timeline node (circular icon with status)
- Shows phase label and timestamp
- Handles node state (active, completed, failed)
- Connects to output section below via vertical line

#### 1.3 Create Timeline Output Section Component

**File**: `frontend/src/components/runs/TimelineOutputSection.tsx`

**Features**:
- Wraps output viewers with timeline integration
- Shows connection line from timeline node
- Handles expand/collapse with smooth transitions
- Displays phase-appropriate output (plan, apply, etc.)

### Phase 2: Layout Refactoring

#### 2.1 Update RunDetail.tsx

**Changes**:
- Remove separate `VerticalRunTimeline` from sidebar
- Remove separate collapsible sections for plan/apply outputs
- Integrate `UnifiedRunTimeline` as main content area
- Update state management to support unified timeline
- Maintain existing functionality (apply buttons, discard, etc.)

#### 2.2 Responsive Design

**Considerations**:
- Timeline should stack vertically on mobile
- Output sections should remain full-width
- Timeline nodes should remain visible during scroll
- Consider sticky timeline nodes for very long outputs

### Phase 3: Enhanced Features

#### 3.1 Resource Graph Integration

**Current State**: Resource graph is separate from outputs

**Proposed**: 
- Integrate resource graph into Plan Phase output section
- Show graph alongside plan output (tabbed or split view)
- Update graph in real-time during apply phase

#### 3.2 Output Summary Cards

**Feature**:
- When output sections are collapsed, show summary cards:
  - Plan Phase: "X resources to add, Y to change, Z to delete"
  - Apply Phase: "X resources created, Y updated, Z deleted"
- Clicking summary expands full output

#### 3.3 Progressive Loading

**Feature**:
- Show timeline nodes immediately when run starts
- Load output sections as phases complete
- Use skeleton loaders for pending outputs
- Animate transitions between phases

### Phase 4: Styling and Polish

#### 4.1 Visual Design

**Timeline Nodes**:
- Size: 32px diameter (larger than current 24px for better visibility)
- Colors:
  - Active: Blue border, blue spinner
  - Completed: Green border, green checkmark
  - Failed: Red border, red X
  - Pending: Gray border, gray icon

**Connection Lines**:
- Width: 2px
- Colors:
  - Active phase: Blue
  - Completed phases: Gray
  - Failed: Red (only for failed runs)

**Output Sections**:
- Rounded corners connecting to timeline
- Subtle left border accent matching timeline color
- Clear separation between sections
- Smooth expand/collapse animations

#### 4.2 Animation and Transitions

**Animations**:
- Smooth line drawing when phase transitions
- Fade-in for output sections when phase completes
- Collapse/expand with height transition
- Pulsing effect for active phase nodes

### Phase 5: State Management

#### 5.1 Section State

**State Structure**:
```typescript
interface TimelineSectionState {
  expanded: {
    planning: boolean;
    planned: boolean;
    applying: boolean;
    applied: boolean;
  };
  scrollPosition?: number; // For scroll restoration
}
```

#### 5.2 Default Expansion Rules

- Active phase: Always expanded
- Latest completed phase: Expanded by default
- Previous phases: Collapsed by default
- User preferences: Remember expansion state per run

### Phase 6: Testing and Refinement

#### 6.1 Test Scenarios

1. **Plan-only runs**: Timeline shows Created → Planning → Planned
2. **Plan-and-apply runs**: Full timeline with both outputs
3. **Apply-only runs**: Timeline shows Created → Started → Completed
4. **Destroy runs**: Similar to apply-only
5. **Failed runs**: Timeline stops at failed phase with error display
6. **Running runs**: Real-time updates and animations

#### 6.2 Performance Considerations

- Lazy load output content for collapsed sections
- Virtual scrolling for very long outputs
- Debounce scroll position updates
- Memoize expensive output parsing

## Technical Considerations

### Component Dependencies

**Current Components to Reuse**:
- `OutputViewer`: Plan output display
- `ApplyOutputViewer`: Apply output display with real-time streaming
- `CollapsibleSection`: Base collapsible functionality (may need modification)

**New Components to Create**:
- `UnifiedRunTimeline`: Main container component
- `TimelineNode`: Individual timeline node
- `TimelineOutputSection`: Output section with timeline integration
- `TimelineConnection`: Visual line connecting nodes

### Data Flow

```
RunDetail.tsx
  ├─ Fetch run data, plan output, apply output
  ├─ Manage section expansion state
  └─ UnifiedRunTimeline
       ├─ TimelineNode (Created)
       ├─ TimelineOutputSection (Planning output - empty/hidden)
       ├─ TimelineNode (Planning)
       ├─ TimelineOutputSection (Plan output)
       ├─ TimelineNode (Planned)
       ├─ [Apply/Discard Buttons]
       ├─ TimelineNode (Applying)
       ├─ TimelineOutputSection (Apply output)
       └─ TimelineNode (Applied)
```

### Backward Compatibility

- Maintain existing API contracts
- No changes to backend data structures
- Gradual rollout: feature flag for new vs. old UI
- Allow users to toggle between layouts (if desired)

## Implementation Steps

### Step 1: Create New Components (Week 1)
- [ ] Create `TimelineNode.tsx`
- [ ] Create `TimelineOutputSection.tsx`
- [ ] Create `UnifiedRunTimeline.tsx`
- [ ] Write unit tests for new components

### Step 2: Integrate into RunDetail (Week 2)
- [ ] Update `RunDetail.tsx` to use `UnifiedRunTimeline`
- [ ] Remove old `VerticalRunTimeline` from sidebar
- [ ] Refactor output section rendering
- [ ] Maintain all existing functionality

### Step 3: Styling and Polish (Week 2-3)
- [ ] Apply design system colors and spacing
- [ ] Implement smooth animations
- [ ] Add responsive breakpoints
- [ ] Polish visual details

### Step 4: Enhanced Features (Week 3-4)
- [ ] Add output summary cards
- [ ] Integrate resource graph
- [ ] Implement progressive loading
- [ ] Add section state persistence

### Step 5: Testing and Refinement (Week 4)
- [ ] Test all run types and scenarios
- [ ] Performance optimization
- [ ] User feedback collection
- [ ] Bug fixes and refinements

## Success Criteria

1. **Space Efficiency**: Timeline and outputs use full width instead of side-by-side layout
2. **Visual Flow**: Clear visual connection between timeline phases and their outputs
3. **User Experience**: Faster comprehension of run progress and results
4. **Feature Parity**: All existing functionality maintained
5. **Performance**: No degradation in load times or interactions
6. **Responsiveness**: Works well on all screen sizes

## References

- Terraform Enterprise UI: Similar timeline-to-output flow design
- Current implementation: `frontend/src/pages/RunDetail.tsx`
- Timeline component: `frontend/src/components/runs/VerticalRunTimeline.tsx`
- Output components: `frontend/src/components/runs/OutputViewer.tsx`, `ApplyOutputViewer.tsx`

## Open Questions

1. Should we maintain the option to view old layout vs. new layout?
2. How should we handle very long outputs (virtual scrolling vs. pagination)?
3. Should timeline nodes be sticky while scrolling through outputs?
4. How to handle resource graph integration - tabbed view or side-by-side?
5. Should we add keyboard shortcuts for expanding/collapsing sections?

