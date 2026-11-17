# Plan: pixels, motion, dots

Baseline shot 2026-11-12 with `npm run qa`. design-critic: FAIL on all five looks. motion-reviewer: FAIL.
Branch: `looks-rebuild`. Order: pixels, then motion, then dots. Each pass ends with QA, both reviewers, and a local commit.

## What is wrong

### Silhouette
- Trot and stand: barrel too deep, legs about 40% of height (reads as a pony), short thick neck with no withers dip, blunt muzzle, ear missing or one cell.
- Tail and mane are drawn as thin strands. On a grid they turn into frayed blobs and loose cells.
- Gallop (Muybridge frames): the head and neck read, but the four legs fuse into one mass in the gathered frames because the grid is too coarse.

### Pixel look
- It is a blurred downsample, not a sprite. Edge cells are drawn at partial brightness, so everything looks feathered.
- Tone comes from the old classic skins (thermal, chrome, type) underneath. That is where the random dark holes in the shoulder come from. There is no light side.
- About 30 to 38 cells long on wide (target 40 to 60) and about 30 on TV. Legs fall to 1 cell and break.
- The grid is attached to each horse, so it travels with the horse instead of staying fixed on screen.
- Done state is random dropout. It looks broken, not asleep. On wide it stops reading as a horse.
- Sprint is not the brightest state. Ice working outshines amber sprint.
- The trail is 2+ body lengths of confetti, clips the top edge, and runs over the labels on TV.
- A soft reflection under each horse adds more blur. CRT scanlines stripe the cells unevenly and the rolling band lifts the black.

### Dots look
- Same shape and tone problems.
- Gaps between dots are filled with haze, not black. Halo fuzz around the whole outline. Bloom everywhere.
- Brightness is a centre glow, not a light side. Dropouts inside working horses. Done is nearly invisible on wide.

### Motion
- State changes take about 2.7 s with an abrupt start. Spec is 0.6 to 1.0 s ease-in-out.
- Horses moonwalk when they change track position: the ground scroll ignores the horse's own drift along the lane.
- Agents pop in and out. Nothing fades or walks in.
- Trot is too fast (1.55/s, spec 1.3 to 1.5), has no body rise in suspension, and the hind hooves skate a few cm per step.
- The drawn-to-photograph gallop handover dims and ghosts. The gallop lift fires twice per stride.
- Breath is 4.4 s (spec 2 to 4) and too small to see on a grid. Ear flick too frequent.
- Reduced motion still shows the rolling band and has no calmer idle.
- Watchdog drops bloom and reflections together. Spec says bloom, then reflections, then resolution.
- Frames longer than 50 ms slow the motion. Trail emission is per frame, not per second.

## How each gets fixed

### Pass 1: pixels (silhouette and grid first, effects last)
1. Anatomy pass on the drawn horse: longer legs, shallower barrel, longer neck with a withers dip, tapered muzzle, a 2-cell ear in every state, tail and mane as single solid masses.
2. New sampler shared by pixels and dots: one fixed screen lattice per lane, silhouette supersampled and thresholded to hard on/off cells. No partial cells.
3. Cleanup on the cell mask: remove orphans, fill pinholes, hold legs at 2 cells minimum and connected down to a full-tone hoof block.
4. Cell count: about 50 long on wide, about 36 on TV. Horses scale up in the lane to get there.
5. Tones from a light model, not from skins: shadow, body, light, rare highlight, one hue, light from top left on every lane. Far legs in the shadow tone so the gallop reads as four legs.
6. States: done is an even ordered thin-out inside a solid outline with a slow twinkle of one tone step. Working is full and steady. Sprint is brightest, levelled across hues.
7. Trail: under one body length, peels off the tail and croup, on the lattice, gone in under a second, clipped to the track. Ground dust row removed.
8. No bloom and no soft reflection on pixels. CRT scanlines locked to the cell pitch. Rolling band no longer lifts black.
9. Layout: top margin for lane 1 on wide, narrower label column and smaller name on TV.
10. V cycles pixels and dots only. Help text updated. `?style=dither|ascii|classic` still works by URL.

### Pass 2: motion
1. 0.8 s ease-in-out state blend with continuous phase.
2. Ground scroll compensates for track drift. Track position on a critically damped spring.
3. Arrive and leave: fade plus walk in from the left, 0.8 s.
4. Trot: 1.4/s, suspension rise, fore and hind sweep matched to ground speed, small head nod.
5. Gallop: clean handover, single lift per stride. The 11 traced frames stay as they are.
6. Stand: 3.4 s breath sized to move at least one cell row, ear flick every 6 to 12 s.
7. Reduced motion: no band, calmer idle. Watchdog in three steps. Time step fixed for slow frames.

### Pass 3: dots
Reuse the pass 1 mask and tones. Small hot core, tight halo, black at the midpoint between dots, no halo outside the outline, bloom only in dense interior. Done state visible on wide.

### QA script
`qa/shoot.mjs` gets native-resolution crops per horse, per-state films that cover one full gait cycle, and a transition film. The current sheets cover half a second of mixed lanes and cannot show a full trot or any transition.

## Not doing
Dither, ASCII and classic stay untouched and hidden. No new traced artwork. Nothing pushed.
