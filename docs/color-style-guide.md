# Komensa Color Style Guide: "Balanced Harmony" Palette

## Current Styling Implementation

Komensa uses Tailwind CSS (v4) for styling, with minimal custom CSS in `globals.css`. The current implementation:

- Relies heavily on Tailwind's utility classes for styling components
- Uses gradient backgrounds (primarily purple/teal/rose) for visual interest
- Implements a simple light/dark mode toggle via CSS variables
- Uses Geist Sans and Geist Mono as the primary fonts

## Color Palette

| Color Name | Hex Code | RGB | Description |
|------------|----------|-----|-------------|
| Dusty Rose | #D8A7B1 | rgb(216, 167, 177) | Primary warm accent |
| Teal | #7BAFB0 | rgb(123, 175, 176) | Primary cool accent |
| Soft Gold | #D9C589 | rgb(217, 197, 137) | Secondary accent |
| Charcoal | #3C4858 | rgb(60, 72, 88) | Text & UI elements |
| Off-White | #F9F7F4 | rgb(249, 247, 244) | Background |

## Hierarchy & Usage Guidelines

### Primary Background
- **Off-White (#F9F7F4)**
  - Use for main application background
  - Creates a clean, neutral canvas that feels open and uncluttered
  - Promotes readability and reduces eye strain during longer sessions
  - Tailwind class: `bg-[#F9F7F4]`

### Primary Text
- **Charcoal (#3C4858)**
  - Use for all body text, headers, and important UI elements
  - Provides sufficient contrast against the off-white background (WCAG AA compliant)
  - Softer than pure black, creating a more gentle reading experience
  - Tailwind class: `text-[#3C4858]`

### Primary Accents (for balance)
- **Dusty Rose (#D8A7B1)** - Partner A / Warm element
  - Use for representing one partner in shared screens
  - Primary CTA buttons
  - Progress indicators
  - Important highlights
  - Active states
  - Tailwind class: `text-[#D8A7B1]` or `bg-[#D8A7B1]`

- **Teal (#7BAFB0)** - Partner B / Cool element
  - Use for representing the other partner in shared screens  
  - Secondary buttons
  - Navigation elements
  - Selection states
  - Links and interactive elements
  - Tailwind class: `text-[#7BAFB0]` or `bg-[#7BAFB0]`

### Secondary Accent
- **Soft Gold (#D9C589)**
  - Use sparingly as a highlight color
  - For celebration moments (completion, milestones, achievements)
  - Neutral third color when both partners need distinct representation
  - "AI moderator" elements to distinguish from either partner
  - Alerts and notifications (non-critical)
  - Tailwind class: `text-[#D9C589]` or `bg-[#D9C589]`

## Accessibility Considerations
- Maintain proper contrast ratios:
  - Text elements should always use Charcoal on lighter backgrounds
  - When using accent colors for interactive elements, ensure 4.5:1 contrast ratio
  - Provide visual cues beyond color alone for colorblind users

## Gradient Usage
When gradients are needed:
- Dusty Rose → Soft Gold: For warm, encouraging UI elements
  - Tailwind class: `bg-gradient-to-r from-[#D8A7B1] to-[#D9C589]`
- Teal → Soft Gold: For cool, calming UI elements
  - Tailwind class: `bg-gradient-to-r from-[#7BAFB0] to-[#D9C589]`
- Subtle gradient of Off-White: For dimensional background elements
  - Tailwind class: `bg-gradient-to-br from-[#F9F7F4] to-[#EAE8E5]`

## Dark Mode Variant
If implementing dark mode:
- Replace Off-White with a dark Charcoal variant (#2A333F)
  - Tailwind class: `dark:bg-[#2A333F]`
- Lighten Charcoal text to Off-White
  - Tailwind class: `dark:text-[#F9F7F4]`
- Increase saturation of accent colors by 10-15% for better visibility
  - Dusty Rose: #E0A1AE
  - Teal: #6BB3B5
  - Soft Gold: #E6C869
- Maintain the same functional color hierarchy

## State Colors
- Success: A slightly greener variant of Teal (#6DB0AD)
  - Tailwind class: `text-[#6DB0AD]` or `bg-[#6DB0AD]`
- Warning/Alert: A slightly more orange variant of Soft Gold (#E5C068)
  - Tailwind class: `text-[#E5C068]` or `bg-[#E5C068]`
- Error: A slightly more red variant of Dusty Rose (#E39AA7)
  - Tailwind class: `text-[#E39AA7]` or `bg-[#E39AA7]`

## Implementation with Tailwind CSS

### Adding Custom Colors to Tailwind

To implement the "Balanced Harmony" palette in Tailwind, modify the Tailwind configuration to include these custom colors:

```js
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        'dusty-rose': '#D8A7B1',
        'teal-custom': '#7BAFB0',
        'soft-gold': '#D9C589',
        'charcoal': '#3C4858',
        'off-white': '#F9F7F4',
        'success': '#6DB0AD',
        'warning': '#E5C068',
        'error': '#E39AA7',
        'dark-bg': '#2A333F',
      },
    },
  },
  // other config...
};
```

### CSS Variables Alternative

For more flexibility, you can set up CSS variables in your globals.css:

```css
:root {
  /* Base palette */
  --color-dusty-rose: #D8A7B1;
  --color-teal: #7BAFB0;
  --color-soft-gold: #D9C589;
  --color-charcoal: #3C4858;
  --color-off-white: #F9F7F4;
  
  /* State colors */
  --color-success: #6DB0AD;
  --color-warning: #E5C068;
  --color-error: #E39AA7;
  
  /* Functional assignments */
  --color-background: var(--color-off-white);
  --color-text: var(--color-charcoal);
  --color-partner-a: var(--color-dusty-rose);
  --color-partner-b: var(--color-teal);
  --color-moderator: var(--color-soft-gold);
}

@media (prefers-color-scheme: dark) {
  :root {
    --color-background: #2A333F;
    --color-text: var(--color-off-white);
    --color-dusty-rose: #E0A1AE;
    --color-teal: #6BB3B5;
    --color-soft-gold: #E6C869;
  }
}
```

## Migration Strategy

To migrate the current design to the "Balanced Harmony" palette:

1. **Update the color configuration** with the new palette
2. **Audit existing components** to ensure consistent application
3. **Apply the new colors systematically** according to their semantic purpose:
   - User interfaces: Off-White background with Charcoal text
   - Partner A elements: Dusty Rose
   - Partner B elements: Teal
   - Moderator elements: Soft Gold
4. **Ensure accessibility** by verifying contrast ratios with the new palette

## Example UI Components with New Palette

### Primary Button
```html
<button class="px-4 py-2 bg-[#D8A7B1] hover:bg-[#C99BA4] text-white rounded-lg">
  Primary Action
</button>
```

### Secondary Button
```html
<button class="px-4 py-2 bg-[#7BAFB0] hover:bg-[#6D9E9F] text-white rounded-lg">
  Secondary Action
</button>
```

### Highlighted Element (Moderator)
```html
<div class="bg-[#D9C589] bg-opacity-20 p-4 rounded-lg border border-[#D9C589]">
  <p class="text-[#3C4858]">Moderator message or highlight</p>
</div>
```

### Partner Messages
```html
<!-- Partner A Message -->
<div class="bg-[#D8A7B1] bg-opacity-15 p-3 rounded-lg border-l-4 border-[#D8A7B1]">
  <p class="text-[#3C4858]">Message from Partner A</p>
</div>

<!-- Partner B Message -->
<div class="bg-[#7BAFB0] bg-opacity-15 p-3 rounded-lg border-l-4 border-[#7BAFB0]">
  <p class="text-[#3C4858]">Message from Partner B</p>
</div>
```

### Alert States
```html
<!-- Success Alert -->
<div class="bg-[#6DB0AD] bg-opacity-15 p-3 rounded-lg border border-[#6DB0AD]">
  <p class="text-[#3C4858]">Success message</p>
</div>

<!-- Warning Alert -->
<div class="bg-[#E5C068] bg-opacity-15 p-3 rounded-lg border border-[#E5C068]">
  <p class="text-[#3C4858]">Warning message</p>
</div>

<!-- Error Alert -->
<div class="bg-[#E39AA7] bg-opacity-15 p-3 rounded-lg border border-[#E39AA7]">
  <p class="text-[#3C4858]">Error message</p>
</div>
``` 