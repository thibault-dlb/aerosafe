# Brand guidelines

Visual identity choices for AeroSafe: the logo, the two colour themes and the fonts. These choices are not applied to the code yet.

- Logo: [`aerosafe-logo.svg`](aerosafe-logo.svg), an Eye of Horus whose pupil is a radar.
- Interactive comparison page (five palettes, three font sets, flight tracking mock-up): https://claude.ai/artifact/AtqHFG8M3wJH8E8PmpoU3m

## 1. Logo

| Role | Name | Hex | Contrast on the background |
| --- | --- | --- | --- |
| Background | Brown night | `#1C110B` | reference |
| Eye, brow, spiral | Gold | `#E3B23C` | 9.4:1 |
| Iris, radar needle | Radar cyan | `#3DD6C4` | 10.2:1 |
| Radar grid | Deep green | `#296055` | 2.6:1 (decoration only) |
| AEROSAFE word | Cream | `#F1E6CF` | 15:1 |

The AEROSAFE word is set in widely spaced Roman capitals with flared serifs, in the spirit of the Trajan capitals.

Constraints that follow:

- Deep green is never used for text (2.6:1).
- Light gold is too weak on cream (about 1.6:1). A light theme uses a dark gold (`#7A5200`) for text and links, and keeps light gold for fills with brown text on top.
- Gold is the brand colour, so a yellow warning would look like an action. Warnings are orange (`#F28C28` dark, `#8F4A00` light), always with a shape (triangle) and a label, never colour alone.

## 2. Palettes

Tokens shared by every palette: background, surface, raised surface, border, text, secondary text, primary (button fill), button label, link, data, selection, decoration, danger, warning, plus map tokens (background, land, grid, bubble surface, text).

### A · Golden night (dark, faithful to the logo)

Not retained as such. Its interface tokens are the base of E.

| Token | Hex |
| --- | --- |
| Background / Surface / Raised surface / Border | `#1C110B` / `#2A1B12` / `#38251A` / `#4A3425` |
| Text / Secondary text | `#F1E6CF` (14.95:1) / `#B0A08A` (7.3:1) |
| Primary (fill) / label on it | `#E3B23C` / `#1C110B` (9.4:1) |
| Link, selection | `#E3B23C` |
| Data | `#3DD6C4` (10.2:1) |
| Decoration | `#296055` |
| Danger / Warning | `#E5604D` (5.4:1) / `#F28C28` (7.5:1) |
| Map: background / land | `#150C07` / `#231610` |

### B · Papyrus: retained light theme

Light first for documentation, exports and printing.

The background is a papyrus cream and the text is the logo brown. Green `#1F6F63` plays the role that cyan plays in the dark theme (primary buttons, tracked aircraft, normal state). Whenever gold carries text (links), it becomes the dark gold `#7A5200`, because the logo's light gold only reaches 1.8:1 on cream.

The light primary button is green rather than gold, so that both themes share the same identity.

| Token | Hex | Contrast (on background `#FBF5E6`, on surface `#F1E6CF`) |
| --- | --- | --- |
| Background | `#FBF5E6` | reference |
| Surface | `#F1E6CF` | |
| Raised surface | `#FFFDF6` | |
| Border | `#D9C9A5` | 1.5:1 (separator, not text) |
| Text | `#1C110B` | 17.0:1 / 14.95:1 |
| Secondary text | `#6B5A48` | 6.1:1 / 5.3:1 |
| Primary (button fill) | `#1F6F63` | 5.5:1 / 4.8:1 |
| Label on primary | `#FBF5E6` | 5.5:1 |
| Link | `#7A5200` | 6.4:1 / 5.6:1 |
| Selection | `#7A5200` | 6.4:1 / 5.6:1 |
| Data (normal state, "In flight") | `#1F6F63` | 5.5:1 / 4.8:1 |
| Decoration | `#296055` | |
| Danger | `#A8341F` | 6.1:1 / 5.3:1 |
| Warning | `#8F4A00` | 6.1:1 / 5.4:1 |

Light map: same principle as E (altitude as shades of gold, selection in the primary colour), with dark golds to stay readable on cream. Every shade of the ramp reaches at least 3:1 on the map background. Low is golden and high is dark brown, the reverse of E, because the darker a shade, the more it stands out on a light background.

| Element | Hex | Contrast on the map background |
| --- | --- | --- |
| Map background | `#EADFC2` | reference |
| Land | `#F7F0DC` | |
| Grid | `#D9C9A5` | |
| Bubble surface | `#FFFDF6` | |
| Map text | `#6B5A48` | 5.0:1 |
| Low aircraft, below FL150 | `#9A7000` | 3.4:1 |
| Mid aircraft, FL150 to FL300 | `#7F5F00` | 4.5:1 |
| High aircraft, above FL300 | `#4F3A00` | 8.2:1 |
| Selected aircraft, trajectory, ring, bubble edge | `#1F6F63` | 4.5:1 |
| Radar beam | `#1F6F63` at 22% (outline 50%, axis 70%) | |
| Radar rings (gold) | `#9A7420` | 3.2:1 |
| Danger | `#A8341F` | 5.0:1 |

Components in the mock-up:

- Buttons: primary as a green `#1F6F63` fill with a cream label, secondary as an outline with a `#D9C9A5` border, danger as a red `#A8341F` outline.
- Alert: background tinted with 14% danger over the surface, red border.
- Selected table row: tinted with 12% of the selection colour.
- States: round dot for "In flight" (`#1F6F63`), triangle for a warning (`#8F4A00`), diamond for an emergency (`#A8341F`), always with a label.
- Logo: it stays on its brown tile (the delivered logo has a `#1C110B` background), which stands out on cream.

### C · Radar (dark green tint, cyan first)

Not retained.

| Token | Hex |
| --- | --- |
| Background / Surface / Raised surface / Border | `#0A1F1E` / `#12302E` / `#1A3D3A` / `#28524E` |
| Text / Secondary text | `#F1E6CF` (13.8:1) / `#9DB5AE` (7.9:1) |
| Primary (fill) / label on it | `#3DD6C4` / `#0A1F1E` (9.5:1) |
| Data | `#3DD6C4` |
| Selection (gold) | `#E3B23C` (8.7:1) |
| Danger / Warning | `#FF7A66` (6.7:1) / `#F28C28` |

Drawback: the logo's brown background clashes with the green-black background. It would need a logo version without background, or a frame.

### D · Radar night: A's interface with C's map and buttons

Not retained as such. Its interface and buttons are the base of E.

- Interface: every token of A (brown background, cream text, gold links and selection).
- Primary buttons ("Filter", "Track this flight"): cyan `#3DD6C4`, label `#0A1F1E` (9.5:1).
- Map: background `#071716`, land `#0E2827`, grid `#28524E`, bubble `#1A3D3A`, map text `#9DB5AE`.
- Issue: cyan is used both for actions and for aircraft, so a button and an aircraft look alike.

### E · Golden radar: retained dark theme (default)

Same interface and buttons as D. Only the map changes:

| Map element | Hex | Contrast on the map background |
| --- | --- | --- |
| Map background | `#130E04` | reference |
| Land | `#221808` | |
| Grid | `#4A3A12` | 1.7:1 (deliberately discreet) |
| Bubble surface | `#2B2008` | |
| Map text | `#C2A560` | 8.1:1 |
| Radar rings (gold) | `#A07A25` | |
| Low aircraft, below FL150 (bronze) | `#B07A1C` | 5.2:1 |
| Mid aircraft, FL150 to FL300 (logo gold) | `#E3B23C` | 9.8:1 |
| High aircraft, above FL300 (pale gold) | `#F5D77E` | 13.7:1 |
| Selected aircraft, trajectory, ring, bubble edge | `#3DD6C4` | above 10:1 |
| Radar beam | `#3DD6C4`, sector at 22% opacity, outline 50%, axis 70% | |
| Aircraft in emergency | `#E5604D` | 5.6:1 |

Map rules:

- Altitude is read from the shade of gold (a legend is shown on the map).
- The selected aircraft takes the radar cyan, like the buttons, and stays at the exact centre of the radar rings.
- The radar beam starts from the aircraft in its direction (heading 58° in the mock-up), in transparent cyan, up to the outer ring.
- The radar rings are gold.
- Cyan is reserved for buttons, the normal state ("In flight") and the tracked aircraft.

In the mock-up, the trace centred on the aircraft and the beam also apply to A, B, C and D, in their "data" colour. Only E has gold rings.

## 3. The two retained themes

- Dark theme, default: E · Golden radar.
- Light theme: B · Papyrus.

Token mapping between the two themes (same token names, different values):

| Token | Dark (E · Golden radar) | Light (B · Papyrus) |
| --- | --- | --- |
| Background | `#1C110B` | `#FBF5E6` |
| Surface | `#2A1B12` | `#F1E6CF` |
| Raised surface | `#38251A` | `#FFFDF6` |
| Border | `#4A3425` | `#D9C9A5` |
| Text | `#F1E6CF` | `#1C110B` |
| Secondary text | `#B0A08A` | `#6B5A48` |
| Primary (fill) | `#3DD6C4` (cyan) | `#1F6F63` (green) |
| Label on primary | `#0A1F1E` | `#FBF5E6` |
| Link | `#E3B23C` | `#7A5200` |
| Selection (list) | `#E3B23C` | `#7A5200` |
| Data (normal state) | `#3DD6C4` | `#1F6F63` |
| Danger | `#E5604D` | `#A8341F` |
| Warning | `#F28C28` | `#8F4A00` |
| Map: background | `#130E04` | `#EADFC2` |
| Map: land | `#221808` | `#F7F0DC` |
| Map: grid | `#4A3A12` | `#D9C9A5` |
| Map: text | `#C2A560` | `#6B5A48` |
| Map: selected aircraft | `#3DD6C4` | `#1F6F63` |
| Map: low / mid / high aircraft | `#B07A1C` / `#E3B23C` / `#F5D77E` | `#9A7000` / `#7F5F00` / `#4F3A00` |
| Map: radar beam | `#3DD6C4` at 22% | `#1F6F63` at 22% |
| Map: radar rings (gold) | `#A07A25` | `#9A7420` |

Planned implementation: tokens defined on `:root` for one theme and redefined for the other under `prefers-color-scheme` and a `data-theme` attribute (dark by default), so that no component uses a literal colour.

## 4. Fonts

Retained: **1 · Inscription** (Cinzel, Inter, JetBrains Mono). Options 2 and 3 are rejected and kept below for the record.

Roles (values from the mock-up):

- Cinzel, weight 600: the AeroSafe name (capitals, `letter-spacing: 0.2em`, 15 px in the top bar) and every heading. Headings follow the "Live flights" heading of the mock-up: Cinzel 600 in sentence case (initial capital, then lower case, which renders as small capitals), `letter-spacing: 0.06em`, 14 px for a panel heading. Larger headings keep the same font, weight and letter spacing at a larger size. Never for long text or long labels: Cinzel has no true lower case.
- Inter, weights 400 to 600: the whole interface (body text, labels, buttons, tables).
- JetBrains Mono, weights 400 and 500: data (callsigns, ICAO24 codes, flight-level altitudes, speeds, coordinates, time), with `font-variant-numeric: tabular-nums`. It tells zero and the letter O apart.
- Fallback stacks: Cinzel, then `'Trajan Pro'`, serif; Inter, then `system-ui`, sans-serif; JetBrains Mono, then `ui-monospace`, Consolas, monospace.

| Option | Headings | Interface | Data | Note |
| --- | --- | --- | --- | --- |
| 1 · Inscription (retained) | Cinzel | Inter | JetBrains Mono | Closest to the logo. Cinzel only has capitals (lower case as small capitals): reserved for the name and short headings, tracking `0.15–0.2em`. |
| 2 · Technical humanist | Marcellus | IBM Plex Sans | IBM Plex Mono | Keeps true lower case, so longer headings. Technical instrument feel. |
| 3 · Plain | Space Grotesk | Inter | JetBrains Mono | Most readable and modern, but the link with the logo disappears (word mark only as an image). |

For all three:

- Fonts under the OFL licence.
- Installed locally through `@fontsource-variable/*` with pnpm rather than the Google CDN, to avoid external calls (GDPR) and to work offline in Docker.
- `font-variant-numeric: tabular-nums` to align altitudes and speeds.

## 5. Decisions and open points

Decided:

- Default dark theme: E · Golden radar (D's base: A's brown interface with C's map and buttons; then a map in shades of gold, selected aircraft in radar cyan, transparent cyan radar beam in the aircraft's direction, aircraft at the centre of the gold rings).
- Light theme: B · Papyrus.
- Primary buttons: cyan `#3DD6C4` in dark, green `#1F6F63` in light (cream label `#FBF5E6`).
- Light map: altitude ramp in dark golds, as in E.
- Warning: orange with a triangle and a label.
- A, C and D are rejected (kept in the comparison page for the record).
- Fonts: 1 · Inscription (Cinzel, Inter, JetBrains Mono).

Still open:

- Check how Cinzel renders French accents (capital headings) before freezing the font choice.
- Warning colour and shape (orange with a triangle proposed).
- Replace the current map colours in `src/front/src/services/MapService.ts` (blue `#1d4ed8` / `#3b82f6`, red `#dc2626`) with the "data", "selection" and altitude colours of the retained palette.
- On the real map: dark tiles that match the chosen palette.
