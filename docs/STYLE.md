# Agent Derby: art direction

Written from a mood board of digital, pixel and LED horses. The board set the direction only. Nothing from it is traced, sampled or copied.

## The bar
This hangs on a 49-inch screen in a design studio for hours. It should read like a premium piece of generative art, the kind a Swiss type studio would make: few elements, exact spacing, one idea executed perfectly. If a frame looks like a tech demo, a filter, or a default effect, it fails.

## The idea
The horse is built from light. A precise grid of light points sampled from a moving, well-drawn silhouette. The silhouette must be anatomically right first (head, neck, withers, barrel, legs with real joints, hooves), because no render style can rescue a bad shape. The gallop silhouette is traced from Eadweard Muybridge's 1878 photographs *The Horse in Motion* (public domain, credited in the README); the trot and the standing horse are drawn by code.

## Looks, in priority order
1. **Pixels (hero, default).** The phone view's horse, so the big screen and the phone read as one design. Rules: a fixed integer grid that never shimmers between frames; clean, readable outline with no orphan pixels or broken legs; one flat lane color in square cells with a thin gap (about a sixth of a cell); the far legs one step toward the ground so four legs always read; legs stay at least 2 cells wide and never disconnect; the head and ear read at a glance. Think of the best hand-made sprite work, achieved procedurally.
2. **Glowing dots (second).** An LED matrix: round points on a strict grid, a small hot core, a tight halo, real dark gaps between dots. Bloom only where light crowds. No muddy haze, no fuzz around the edge.
3. **Dither, ASCII, classic.** Hidden from the V-key cycle and settings until each meets this bar. Do not spend time on them until pixels and dots pass.

## Grid and scale
- Cell size scales with lane height and snaps to whole device pixels. At 5120x1440 a horse is roughly 40 to 60 cells long; at 1024x768 roughly 30 to 40. Pick per layout so the horse always reads.
- Every point sits on the grid. Motion moves the silhouette under the grid; the grid itself never moves.

## Color
- The phone view (`phone.html`) is the reference. Both pages share the backgrounds, palettes, inks and type, so an agent looks the same on either screen.
- Four grounds, all on the same cell lattice as the horses so nothing shimmers. **Grass** (the default): mowed turf in two greens, a band every 12 cells, cream ink. **Off-white** (`paper`): `#EEEAE0` with a faint weave, near-black ink, deeper lane colors. **Oil**: soft color blobs drifting and blending, drawn into coarse dithered cells, with the type on dark glass. **Black** (`#000`, the night track): warm off-white ink, a black-glass floor that mirrors the hooves. Only black has reflections.
- An agent's color comes from its id, the same rule as the phone: grass `#FFB547 #CFE8FF #FFF1CC #FF6B5A #5FE3FF #FFD36B #D7C4FF #FF9FD6`; off-white `#C2410C #1D4ED8 #15803D #B91C1C #0E7490 #A16207 #6D28D9 #BE185D`; oil and black `#FFB547 #CFE8FF #6BFF8E #FF6B5A #5FE3FF #FFD36B #B48CFF #FF8FD0`. Open and demo lanes go by lane number.
- An open lane's horse is opaque and muted, mixed from the ground toward the ink, never see-through, so it reads as empty and still has four legs.
- Tones within a horse are steps of the same hue, never a second hue.

## State is light
- **Done:** standing and quieter, at about 60% like the phone (the dots look thins out evenly with a slow twinkle). Should feel asleep, not broken.
- **Working:** full density, steady light. Trot.
- **Full sprint:** brightest, crisp, with a short trail of points peeling off behind that fades in under a second. Gallop.
- Changes of state crossfade over 0.6 to 1.0 s. Nothing pops.

## Screen texture (CRT)
About 15% overall on wide screens, 25% on 4:3: fine scanlines aligned to device pixels, a soft vignette, a very slow rolling band, flicker under 2%. Felt more than seen. It must never blur the grid or tint the black.

## Type and layout
Labels are the phone view's row, in Helvetica Neue: the name in semibold, the task under it in the dimmer ink, then the state word (amber when it is waiting on you) and how long it has held. The footer is the phone's header: the name in small spaced capitals, then the counts. Tight, aligned, generous margins, no badges; only oil puts the type on glass. The horse is the hero; type never competes.

## Never
Drop shadows. Gradients on type. Glow on text. Blurry or soft-edged pixels. Shimmering grids. Disconnected legs. Random noise passed off as texture. Copied artwork. Unlabeled demo horses.
