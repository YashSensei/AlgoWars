# Design Reference

This folder contains HTML/CSS design references for the AlgoWars frontend implementation.

## Files

| File | Description |
|------|-------------|
| `login-signup.html` | Authentication page - glass panel login form with Japanese accents |
| `landing-v1.html` | Landing page variant 1 - "CODE. COMPETE. CONQUER." hero with glass panels |
| `landing-v2.html` | Landing page variant 2 - "Code. Battle. Win." with code editor preview, feature sections |

## Design System

### Colors
| Token | Value | Usage |
|-------|-------|-------|
| `primary` | `#ff3344` / `#ff4d4d` | Action buttons, accents, highlights |
| `secondary` | `#4f46e5` / `#a29bfe` | Gradient accents, depth |
| `background-dark` | `#0a0a0c` / `#1a1625` | Page background |
| `card-dark` / `surface-dark` | `#131316` | Panel/card backgrounds |
| `input-bg` | `#0f0f12` | Form field backgrounds |
| `border-dark` | `#27272a` | Subtle borders |
| `text-muted` | `#9ca3af` | Secondary text |
| `accent-gold` | `#fbbf24` | Special highlights |

### Typography
- **Primary Font**: `Space Grotesk` - headings, buttons, UI text
- **Japanese Font**: `Noto Sans JP` - decorative kanji, Japanese accents
- **Mono**: System mono - code, stats, technical text

### Key Visual Elements

1. **Glass Panels** (`.glass-panel`)
   ```css
   background: rgba(19, 19, 22, 0.6-0.85);
   backdrop-filter: blur(12-16px);
   border: 1px solid rgba(255, 255, 255, 0.05-0.08);
   ```

2. **Noise Texture Overlay**
   - SVG-based fractal noise at 5% opacity
   - Creates subtle grain effect

3. **Gradient Orbs**
   - Large blurred circles (`blur-[100-120px]`)
   - `mix-blend-screen` for glow effect
   - Primary (red) and secondary (indigo) colors

4. **Japanese Decorative Elements**
   - Large kanji watermarks (戦 = "war/battle")
   - Vertical text: アルゴリズム戦争・開始
   - Small katakana labels: アルゴウォーズ, 認証

5. **Corner Accents**
   - `border-t-2 border-l-2 border-primary/50` on top-left
   - `border-b-2 border-r-2 border-primary/50` on bottom-right

6. **Animated Elements**
   - Rotating geometric shapes (`animate-[spin_10s_linear_infinite]`)
   - Floating badges (`animate-float`)
   - Pulsing status indicators

### Button Styles

1. **Primary CTA** (White → Red on hover)
   ```html
   <button class="bg-white text-black hover:bg-primary hover:text-white">
   ```

2. **Bordered Button**
   ```html
   <button class="border border-border-dark hover:border-white/30 hover:bg-white/5">
   ```

3. **Retro Shadow Button** (v2 style)
   ```html
   <button class="shadow-[4px_4px_0px_0px_rgba(47,41,66,1)] hover:shadow-[2px_2px_0px_0px]">
   ```

### Input Fields
- Left icon box with border separator
- Focus state changes label + icon to primary color
- Bottom border highlight on focus
- Mono font for input text

## Implementation Notes

- Use Tailwind CSS with custom config
- Material Symbols Outlined for icons
- Mobile-first responsive design
- Dark mode only (no light mode needed)
