# Design Guidelines: Bookmark Collection Manager

## Design Approach
**Design System Foundation**: Linear-inspired productivity interface with Material Design components
This utility-focused application prioritizes efficiency, clarity, and data organization while maintaining visual polish through clean typography, purposeful spacing, and structured layouts.

## Core Design Elements

### Typography Hierarchy
**Font Family**: Inter via Google Fonts (primary), SF Mono (code/URLs)
- Page Title: text-2xl, font-semibold
- Section Headers: text-lg, font-medium
- Bookmark Titles: text-base, font-medium
- Body Text/Notes: text-sm, font-normal
- URLs/Meta: text-xs, font-mono
- Button Labels: text-sm, font-medium

### Layout System
**Spacing Primitives**: Tailwind units of 2, 4, 6, 8, 12, 16
- Component padding: p-4, p-6
- Section gaps: space-y-6, space-y-8
- Card internal spacing: p-6
- Button padding: px-4 py-2, px-6 py-3 (larger CTAs)
- List item gaps: space-y-4

**Container Strategy**:
- Main container: max-w-4xl mx-auto px-6 py-12
- Card containers: w-full with subtle borders
- Input areas: w-full with max constraints where needed

### Component Library

#### Authentication Header
- Full-width top bar with max-w-4xl centered content
- Left: Application logo/title (text-lg font-semibold)
- Right: User profile indicator with logout button
- Height: h-16, sticky positioning
- Divider border at bottom

#### URL Input Section
- Prominent placement directly below header
- Large drop zone area with dashed border (min-h-32)
- Center-aligned placeholder text with drag-and-drop icon
- Input field appears on click: rounded-lg border with focus ring
- "Add Bookmark" button (primary style, px-6 py-3)
- Visual feedback states: default, hover, dragging-over, processing
- Loading state with spinner during URL fetch

#### Bookmark Card Component
- Full-width cards with subtle shadow and border
- Grid layout: thumbnail (left) + content area (right)
- Thumbnail: Fixed 120x80px with rounded corners, object-cover
- Content section (flex-1):
  - Title (text-base font-medium, line-clamp-2)
  - URL display (text-xs font-mono, truncate)
  - Notes area (text-sm, expandable)
  - Action buttons row (Edit, Delete)
- Spacing: p-6 with gap-4 between elements

#### Edit Mode Interface
- Inline textarea expansion (min-h-24)
- Character count indicator (bottom-right, text-xs)
- Action buttons: Save (primary) + Cancel (secondary)
- Auto-focus on textarea when entering edit mode
- Smooth height transition

#### Empty States
- Center-aligned message when no bookmarks exist
- Illustrative icon (bookmark or folder icon, size-16)
- Helpful text: "No bookmarks yet. Add your first link above!"
- Secondary text with usage tip

#### Login/Authentication Screen
- Centered card on neutral background (max-w-md mx-auto)
- Logo/app name at top (text-2xl font-bold, mb-8)
- Social login buttons (full-width, mb-3 between each)
- "Or continue with email" divider
- Email/password form fields with labels above
- Primary CTA button (w-full)
- Sign up link at bottom

### Interaction Patterns

**Drag-and-Drop Behavior**:
- Visual highlight of drop zone on drag enter
- Dashed border animates to solid on hover
- Background subtle shift during drag-over
- Immediate feedback with URL extraction

**List Interactions**:
- Hover state on cards: subtle shadow lift
- Delete confirmation: modal dialog overlay
- Edit mode: card expands smoothly with textarea
- Loading states: skeleton placeholders during fetch

**Microinteractions**:
- Button press feedback (slight scale)
- Success toast notifications for actions
- Error messages inline with form validation
- Smooth transitions: duration-200 ease-in-out

### Data Visualization

**Bookmark Grid**:
- Single column on mobile (grid-cols-1)
- Maintain single column on desktop for optimal reading
- Consistent gap-4 between items
- Infinite scroll or pagination at 20+ items

**Metadata Display**:
- Favicon integration (16x16px inline with URL)
- Date added (text-xs, subtle)
- Last edited indicator when notes exist
- Tag system for categorization (optional chips)

### Responsive Behavior

**Mobile Optimizations**:
- Stack all elements vertically
- Thumbnail reduces to 80x60px
- Touch-friendly button sizes (min-h-11)
- Simplified edit mode with bottom action sheet
- Sticky header with reduced height

**Tablet/Desktop**:
- Maintain max-w-4xl constraint
- Larger drop zone for better targeting
- Keyboard shortcuts hints (tooltip on hover)
- Side-by-side Save/Cancel buttons in edit mode

### Accessibility Standards
- Semantic HTML structure throughout
- ARIA labels for all interactive elements
- Keyboard navigation support (Tab, Enter, Escape)
- Focus visible states on all focusable elements
- Screen reader announcements for dynamic content
- High contrast text ratios (WCAG AA minimum)
- Touch targets minimum 44x44px

### Images
No hero images required. This is a utility application where function takes priority. Use only:
- Bookmark thumbnails (fetched from URLs)
- User profile avatars (from auth service)
- Empty state illustration icons
- Favicon displays inline with URLs