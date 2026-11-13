# Agent Derby: motion

Motion quality matters more than any render effect. A beautifully lit horse that moves wrong looks cheap.

## Source of truth
Eadweard Muybridge, *The Horse in Motion* (1878, public domain). Use the published sequence for footfall order, leg angles and timing. If the photographs are available locally, study them; never trace them into the repo as artwork.

## Gaits
- **Stand (done):** weight on all four, slight idle life: a breath (2 to 4 s cycle, 1 to 2% body rise), an occasional head dip or ear flick every 6 to 12 s, a weight shift. Never perfectly still, never twitchy.
- **Trot (working):** two-beat diagonal: left hind with right fore, then right hind with left fore. About 1.3 to 1.5 strides per second. Short suspension between beats. The back stays level; the head nods slightly.
- **Gallop (full sprint):** four-beat, in Muybridge's order: trailing hind, leading hind, trailing fore, leading fore, then a gathered suspension with all four hooves off the ground and legs folded under the body (not stretched out like a rocking horse). About 2.0 to 2.4 strides per second. Neck and head swing forward and back with each stride; the back flexes.

## Physics
- Hooves in contact with the ground do not slide. Ground speed must match the stance legs' backward sweep (no moonwalking).
- Joints bend the right way: knees (carpus) forward on the front legs, hocks backward on the hind legs.
- The body rises in suspension and sinks under load, a few percent of body height.

## Transitions
- Stand to trot to gallop and back blend over 0.6 to 1.0 s with ease-in-out (cubic-bezier(0.65, 0, 0.35, 1) or a critically damped spring). Stride phase stays continuous through the blend, so legs never snap.
- Speed changes ease; a horse never jumps position along the track.
- A horse arriving or leaving fades and walks in or out. It never pops into existence.

## Frame budget
- Everything is driven by real elapsed time, never frame count, so a slow frame never changes speed.
- 60 fps at 5120x1440 and smooth on a Pi 4 at 1024x768. The watchdog drops bloom, then reflections, then resolution before it ever drops frames.
- Respect `prefers-reduced-motion`: no flicker or rolling band, calmer idle.

## How to check
`npm run qa` writes filmstrips to `docs/qa/` (12 frames, one gait cycle, for each state). Read them like a contact sheet: footfall order, no sliding hooves, no snapping joints, smooth transitions.
