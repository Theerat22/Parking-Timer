---
name: Parking Timer
description: A quiet Thai parking utility with clear time, cost, and state.
colors:
  bg: "#fff"
  surface: "#f7f4f6"
  ink: "#29212a"
  muted: "#71646c"
  accent: "#a72f55"
  accent-hover: "#8b2345"
  pink: "#fcecf1"
  green: "#246f56"
  green-soft: "#eaf5ef"
  line: "#e9e1e5"
  warning: "#8c4e14"
  warning-bg: "#fff3e4"
  dark-bg: "#1e1b20"
  dark-surface: "#28242a"
  dark-ink: "#f4edf2"
  dark-muted: "#bdb0bb"
  dark-accent: "#f29bb8"
  dark-accent-hover: "#ffc3d6"
  dark-pink: "#39252f"
  dark-green: "#8cd6b4"
  dark-green-soft: "#20372d"
  dark-line: "#443b43"
  dark-warning: "#efbc80"
  dark-warning-bg: "#3a2c20"
typography:
  headline:
    fontFamily: "IBM Plex Sans, IBM Plex Sans Thai, sans-serif"
    fontSize: "30px"
    fontWeight: 600
    lineHeight: 1.45
    letterSpacing: "-0.025em"
  title:
    fontFamily: "IBM Plex Sans, IBM Plex Sans Thai, sans-serif"
    fontSize: "19px"
    fontWeight: 600
    lineHeight: 1.5
  body:
    fontFamily: "IBM Plex Sans, IBM Plex Sans Thai, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "IBM Plex Sans, IBM Plex Sans Thai, sans-serif"
    fontSize: "13px"
    fontWeight: 500
  timer:
    fontFamily: "IBM Plex Sans, IBM Plex Sans Thai, sans-serif"
    fontSize: "clamp(36px, 4vw, 56px)"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "-0.03em"
rounded:
  field: "9px"
  control: "12px"
  panel: "16px"
spacing:
  compact: "8px"
  control-gap: "12px"
  standard: "16px"
  inset: "24px"
  section: "28px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.bg}"
    rounded: "{rounded.control}"
    padding: "12px 20px"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "12px 20px"
  input:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
    padding: "9px 12px"
---
# Design System: Parking Timer

## Overview

**Creative North Star: "Quiet parking utility"**

Parking Timer adapts the user-pinned Figma screen 2:89 in file 2DI44d3YnJjiyhJCdxj4Aa to parking tasks; it does not reproduce the scam product. This authority supersedes unrelated concept directions. The interface is quiet, concise, and practical: white space, plum ink, rose actions, and precise dividing rules support Thai reading and quick operation.

The implemented world uses IBM Plex Sans with its Thai companion, Lucide outlines, gently rounded controls, and flat separation. Light and dark themes preserve the same semantic roles. No gradients, emoji, or decorative imagery are part of this system.

**Key Characteristics:**
- Concise Thai copy and legible bilingual typography.
- Rose actions, green allowance states, and amber warnings.
- Flat surfaces, rounded controls, and tabular time and money.

## Colors

Rose and plum define the identity; green and amber communicate operational state. The frontmatter records the exact light and dark values extracted from `app/globals.css`.

### Primary
- **Rose action** (`accent`, `accent-hover`): primary buttons, active navigation, links, focus, and inline errors.
- **Soft pink** (`pink`): restrained interaction feedback on actual controls; not a default container fill.

### Secondary
- **Allowance green** (`green`, `green-soft`): free allowance and successful status text; soft fill is reserved for the security-sensitive token reveal.
- **Warning amber** (`warning`, `warning-bg`): paid allowance, pending, and connection warnings.

### Neutral
- **Plum ink** (`ink`): headings, values, and body content.
- **Quiet supporting ink** (`muted`): explanation, timestamps, units, and inactive navigation.
- **Canvas and quiet surface** (`bg`, `surface`): page and grouped panels.
- **Soft divider** (`line`): rows, field borders, and section boundaries.

**The Semantic Pair Rule.** Keep foreground and soft-background roles paired when switching themes; use the matching `dark-` values rather than reusing light colors.

## Typography

**Display and body font:** IBM Plex Sans, IBM Plex Sans Thai, sans-serif. Locally bundled weights are regular, medium, and semibold. Thai text follows the same hierarchy as Latin text rather than becoming a separate decorative voice.

### Hierarchy
- **Headline:** page headings use the frontmatter headline role, reduced to (26px) on mobile.
- **Title:** section headings use the title role; smaller subheadings use (17px).
- **Body:** the body role reduces to (14px) on mobile. Supporting copy commonly uses (12–14px); compact units and footnotes use (10–12px).
- **Label:** medium-weight labels and navigation remain concise; field text is (16px).
- **Timer:** medium-weight tabular numerals, with muted lighter separators. Responsive overrides use (44px) at compact desktop, (60px) at tablet, (56px) on mobile, and (64px) from the wide breakpoint. At (370px) and below it reduces to (47px).

**The Stable Numbers Rule.** Use tabular numerals for elapsed time, costs, history amounts, and summary values so changing digits do not shift alignment.

## Layout

Desktop uses a fixed navigation rail (250px), narrowing to (218px) below the compact breakpoint and (190px) at tablet widths. Main content is centered with a maximum width of (1240px), normally inset (44px). The timer and summary form an asymmetric two-column grid; tablet and phone collapse the main task into one column.

At (760px) and below, the rail becomes four fixed bottom tabs with safe-area padding. Main content keeps a (24px) horizontal inset and a maximum width of (600px). Space is reserved below content for navigation. At (370px) and below, content and header insets reduce to (18px). History rows wrap on mobile; Siri setup becomes one column. Repeated gaps follow the compact, standard, inset, and section spacing in the frontmatter.

## Elevation & Depth

Tonal surfaces and fine separators provide everyday depth. Cards are flat. Selected statistics segments use a small ambient shadow (`0 2px 6px #29212a0d`); native dialogs use a broad modal shadow (`0 20px 80px #0003`) over a dimmed backdrop (`#1e172580`). Do not spread modal elevation to ordinary panels.

## Shapes

Page sections have no outer box or radius. Dialogs use the panel radius and actions use the control radius. Fields use the smaller field radius. Status text and dots sit directly on the page. Lucide icons use a light (1.75) stroke and inherit semantic color; no glyph substitutes.

## Components

### Buttons

Primary actions are solid rose, medium weight, with (48px) minimum height; the full-width parking action is (54px). Secondary actions use the quiet surface and turn soft pink on hover. Text actions retain an accent foreground and underline on hover. Icon buttons generally occupy (44px) squares. Disabled buttons reduce opacity to (0.5). Keyboard focus uses a (3px) accent outline with (4px) offset.

### Status badges

Idle uses muted text and a dot; free allowance uses green text; paid status uses ink. Each includes text, so color is supplemental. No background, frame or badge padding.

### Cards / Containers

The timer is an open region on the page with 12px top padding and no outer container. History uses rows separated by fine rules, with no outer border. Setup, Siri introduction and the Siri entry link have no colored fill or rounded frame. Notices use an icon and colored text without a surrounding box.

### Inputs / Fields

Fields use a one-pixel divider-colored border, canvas background, ink foreground, and a (44px) minimum height. Labels remain outside fields. Errors and success messages use their semantic foreground/background pairs. Native date controls remain native.

### Navigation

Desktop navigation pairs icons with text; the current item uses accent and stronger weight with no filled tile. Mobile uses four icon-and-label bottom tabs with the same active treatment and `aria-current`. Statistics switches and theme options expose selected state with `aria-pressed`.

### Timer and statistics

The timer shows hours, minutes, and seconds with separate unit labels, a state badge, a start timestamp, cost, and remaining allowance. Statistics use accent bars with labels plus an expandable accessible data table. Empty states use icon, heading, and short explanation rather than placeholder records.

### Dialogs and motion

Native dialogs have a labeled heading, close action, constrained scrollable height, and a maximum width of (460px). Buttons transition color over (160ms); guide chevrons rotate over (150ms); loading indicators spin over (1s). Reduced-motion rules reduce animation to one (0.01ms) iteration, remove transitions, and restore automatic scrolling.

## Do's and Don'ts

### Do:
- **Do** use the semantic CSS variables so light and dark themes stay paired.
- **Do** use tabular numerals for time and money, and Lucide SVG icons.
- **Do** preserve the 24px mobile content inset and concise Thai labels.
- **Do** show text alongside semantic color and retain keyboard focus.

### Don't:
- **Don't** use gradients, emoji, or decorative imagery.
- **Don't** invent parking records to fill a live empty state.
- **Don't** introduce an unrelated visual identity in place of the pinned Figma authority.

## Copy and price revision

Remove repeated tariff, zone, history and stats helper text requested by the user. Keep essential state/errors and setup access. The visible timer heading is omitted in idle; a semantic sr-only heading labels the timer region. Cost label is ค่าจอด, whole amounts omit decimal zeros, while fractional historical costs and averages retain necessary precision. New sessions charge hourly steps at exact 120/180/240-minute boundaries; each session snapshots its billing model.

Research: NN/g Cards: UI-Component Definition (https://www.nngroup.com/articles/cards-component/) and GOV.UK spacing (https://design-system.service.gov.uk/styles/spacing/). These support choosing spacing and hierarchy rather than defaulting to boxed containers; the flat parking layout is our application of that guidance.

## Single-owner settings
The settings dialog contains display theme controls and setup help only. No account, email, password, signup, login or logout controls. The app loads the shared owner data immediately.
