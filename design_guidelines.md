# Design Guidelines: Jiachun Competitive Experience Field Reality Game System

## Design Approach

**Reference-Based Design**: This project draws inspiration from military tactical interfaces and modern gaming UIs. Think Call of Duty HUD meets Airbnb's clean card layouts, with a dark, tactical aesthetic optimized for outdoor mobile gameplay.

**Core Principles**:
- **Intuitive Mobile-First**: Players use phones outdoors - every interaction must be instantly clear
- **Military Tactical Aesthetic**: Dark backgrounds with high-contrast elements for visibility
- **Information Hierarchy**: Critical game data (score, timer, objectives) always prominent

## Color System

**Primary Palette**:
- **Military Orange** (#d97706): Primary actions, progress bars, active states
- **Tactical Green** (#059669): Success states, completion markers, correct answers
- **Alert Red** (#dc2626): Errors, warnings, countdowns, danger zones
- **Dark Gray Backgrounds** (#1f2937 base, #111827 deeper): All backgrounds and cards
- **Light Gray Text** (#f9fafb primary, #d1d5db secondary): Text hierarchy

**Application**:
- Backgrounds: Deep grays (#111827, #1f2937, #374151)
- CTAs and emphasis: Orange gradient buttons
- Success feedback: Green badges and checkmarks
- Urgency/errors: Red alerts and timers

## Typography

**Font Stack**:
- **Headlines & Buttons**: Rajdhani (bold, uppercase, futuristic)
- **Body & Interface**: Noto Sans TC (readable, professional)
- **Scores & Timers**: Orbitron (digital, monospaced aesthetic)

**Hierarchy**:
- Page Titles: Rajdhani 2xl-3xl, Bold
- Content Headers: Noto Sans TC xl-2xl, Semibold  
- Body Text: Noto Sans TC base-lg, Normal
- Scores/Stats: Orbitron 2xl-4xl, Bold
- Button Labels: Rajdhani base-lg, Semibold, UPPERCASE

## Layout & Spacing

**Spacing System**: Use Tailwind units of 2, 4, 8, 12, 16, 20, 24, 32 for consistent rhythm
- Component padding: p-4 to p-6
- Section spacing: py-8 to py-12
- Card gaps: gap-4 to gap-6

**Container Strategy**:
- Mobile: Full-width with px-4 padding
- Desktop: max-w-7xl centered for content areas
- Cards: Rounded corners (12px), subtle elevation with dark shadows

## Key Components

**Buttons**:
- Primary: Orange gradient (#d97706 to #b45309), rounded-lg, 2px transparent border, uppercase text, shadow on hover
- Secondary: Transparent with orange border, fills orange on hover
- Danger: Red gradient, same styling as primary
- All buttons: 12px 32px padding, smooth transitions, lift on hover (-2px translateY)

**Cards**:
- Background: #1f2937
- Border: 1px solid #374151
- Radius: 12px
- Shadow: 0 4px 16px rgba(0,0,0,0.3)
- Hover: Increase shadow, lift slightly

**Input Fields**:
- Background: #111827
- Border: 2px solid #4b5563, changes to orange on focus
- Radius: 8px
- Padding: 12px 16px
- Focus ring: 3px orange glow (rgba(217,119,6,0.2))

**Progress Bars**:
- Track: #374151, 8px height, rounded
- Fill: Orange gradient with animated shimmer overlay
- Smooth width transitions (0.5s ease)

## Page-Specific Layouts

### Player Game Interface
```
Fixed Header (h-16):
- Menu icon (left)
- Mission title (center)
- Score display (right, Orbitron font)

Progress Bar (h-2):
- Full-width orange gradient

Scrollable Content:
- Dynamic page modules (text cards, dialogue, video, etc.)
- White space between modules (my-8)

Fixed Action Bar (h-20):
- Primary action button (full-width or split for multiple actions)
```

### Map View
```
Fixed Header (h-16):
- Back button, "Map Navigation" title, Chat icon

Full-Screen Map:
- Leaflet.js integration
- Custom markers for player (blue pulse) and targets (orange icons)
- Distance indicators on markers

Fixed Tool Bar (h-16):
- Re-center button, Compass toggle
```

### Game Lobby
```
Hero Section (min-h-screen/2):
- Large hero image of shooting range/tactical field
- Semi-transparent dark overlay (bg-black/60)
- Centered title (text-4xl, Rajdhani, white)
- Subtitle with glow effect
- CTA button with blur background

Game Grid:
- 2-column on mobile, 3-column on desktop
- Cards with cover images
- Difficulty badges (green/orange/red)
- Hover: Scale up slightly, increase brightness
```

### Admin Dashboard
```
Sidebar (w-64, fixed):
- Logo at top
- Navigation items with icons
- Dark background (#111827)

Main Content:
- Stats grid (4 columns desktop, 2 mobile)
- Charts with orange/green accents
- Recent activity table
```

### Game Editor
```
3-Column Layout (desktop):
- Left: Page list (w-64, scrollable, drag-drop enabled)
- Center: Preview pane (flex-1, simulated phone frame)
- Right: Properties panel (w-80, form inputs)

Mobile: Tabbed interface
```

## Visual Effects

**Animations** (minimal, purposeful):
- Button hover: Gentle lift, shadow expansion (0.3s ease)
- Page transitions: Fade (0.2s)
- Score updates: Pulse effect
- Loading states: Shimmer overlay on cards

**Shadows**:
- Cards: 0 4px 16px rgba(0,0,0,0.3)
- Buttons: 0 4px 12px rgba(217,119,6,0.3)
- Modals: 0 20px 40px rgba(0,0,0,0.5)

## Images

**Hero Images**:
- Game Lobby: Wide-angle tactical shooting range photo with orange targets, dramatic lighting
- Landing sections: Players in action, equipment close-ups, aerial venue shots

**In-Game**:
- Character avatars for dialogue (military/tactical styled)
- Mission icons (stylized, monochrome with orange accents)
- Achievement badges (shield shapes with military insignia)

**Placement**:
- Lobby hero: Full-width, min-h-[50vh], overlay with blur for text readability
- Game cards: 16:9 ratio cover images
- Profile avatars: Circular, 48px-64px
- Map markers: Custom PNG icons, 32x32px

## Responsive Behavior

- **Mobile (default)**: Single column, full-width elements, larger touch targets (min 44px)
- **Tablet (md:)**: 2-column grids, sidebar appears
- **Desktop (lg:)**: 3-column layouts, hover states active, larger spacing

## Accessibility Notes

- Maintain 4.5:1 contrast ratio (light text on dark backgrounds achieves this)
- Focus indicators: Orange ring on all interactive elements
- Touch targets: Minimum 44x44px
- Loading states: Clear visual feedback
- Error messages: Red with icon, clear placement below inputs