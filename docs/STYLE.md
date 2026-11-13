# Agent Derby: art direction

Written from a mood board of digital, pixel and LED horses. The board set the direction only. Nothing from it is traced, sampled or copied.

## The bar
This hangs on a 49-inch screen in a design studio for hours. It should read like a premium piece of generative art, the kind a Swiss type studio would make: few elements, exact spacing, one idea executed perfectly. If a frame looks like a tech demo, a filter, or a default effect, it fails.

## The idea
The horse is built from light. A precise grid of light points sampled from a moving, well-drawn silhouette. The silhouette must be anatomically right first (head, neck, withers, barrel, legs with real joints, hooves), because no render style can rescue a bad shape.

## Looks, in priority order
1. **Pixels (hero, default once it passes).** A deliberate sprite, not a downsample. Rules: a fixed integer grid that never shimmers between frames; clean, readable outline with no orphan pixels or broken legs; 3 to 4 tones per horse from one hue (shadow, body, light, rare highlight); the light comes from one side consistently; legs stay at least 2 cells wide and never disconnect; the head and ear read at a glance. Think of the best hand-made sprite work, achieved procedurally.
2. **Glowing dots (second).** An LED matrix: round points on a strict grid, a small hot core, a tight halo, real dark gaps between dots. Bloom only where light crowds. No muddy haze, no fuzz around the edge.
3. **Dither, ASCII, classic.** Hidden from the V-key cycle and settings until each meets this bar. Do not spend time on them until pixels and dots pass.

## Grid and scale
- Cell size scales with lane height and snaps to whole device pixels. At 5120x1440 a horse is roughly 40 to 60 cells long; at 1024x768 roughly 30 to 40. Pick per layout so the horse always reads.
- Every point sits on the grid. Motion moves the silhouette under the grid; the grid itself never moves.

## Color
- Black ground (`#000`). Type in warm off-white at modest opacity.
- One hue per lane, spaced to tell apart at a glance: amber `#FFB547`, ice `#CFE8FF`, green `#6BFF8E`, coral `#FF6B5A`, cyan `#5FE3FF`, gold `#FFD36B`, violet `#B48CFF`, pink `#FF8FD0`. A single phosphor palette (amber, green, white, ice) or one hex is an option.
- Tones within a horse are steps of the same hue, never a second hue.

## State is light
- **Done:** standing, dim, sparse. Points thin out evenly (not noisy), with a slow, gentle twinkle. Should feel asleep, not broken.
- **Working:** full density, steady light. Trot.
- **Full sprint:** brightest, crisp, with a short trail of points peeling off behind that fades in under a second. Gallop.
- Changes of state crossfade over 0.6 to 1.0 s. Nothing pops.

## Screen texture (CRT)
About 15% overall on wide screens, 25% on 4:3: fine scanlines aligned to device pixels, a soft vignette, a very slow rolling band, flicker under 2%. Felt more than seen. It must never blur the grid or tint the black.

## Type and layout
Labels are a quiet race program in a mono face: number, name, task, state, timer. Tight, aligned, generous margins, no boxes, no badges. The horse is the hero; type never competes.

## Never
Drop shadows. Gradients on type. Glow on text. Blurry or soft-edged pixels. Shimmering grids. Disconnected legs. Random noise passed off as texture. Copied artwork. Unlabeled demo horses.
