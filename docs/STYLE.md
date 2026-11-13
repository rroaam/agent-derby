# Agent Derby: style brief

Written from a mood board of digital and pixel horses. Nothing here copies a reference image: the board only set the direction.

## Idea
The horse is built from light, not drawn. Every horse is a field of points (dots, dither cells, glyphs or pixels) sampled from a moving silhouette, so it reads like a signal on a screen rather than an illustration.

## Looks
- **Glowing dots (default):** an LED dot-matrix. Round points on a fixed grid, a hot core and a soft halo, bloom where points crowd together. Dot size follows the body's light, so the shape has volume.
- **Dither:** a 1-bit ordered (Bayer 4x4) screen. Square cells, hard edges, no blur. Tone comes only from the pattern.
- **ASCII:** a glyph density ramp ` .:-=+*#%@` in a bold monospace, one glyph per cell. Dense glyphs on the lit side, sparse ones on the shadow side.
- **Pixels:** chunky square pixels with four brightness steps, like an early game sprite.
- **Classic:** the original painted skins, kept as an option.

## Color
One color per lane on black, picked to stay apart at a glance: amber, ice, green, coral, cyan, gold, violet, pink. The palette can be switched to a single phosphor color (amber, green, white, ice) or any hex.

## State
- **Done:** sparse, dim points that slowly twinkle. The horse stands.
- **Working:** the field fills in at full density. Trot.
- **Full sprint:** brightest, with extra bloom and a trail of points peeling off behind. Gallop.

## Motion
The gallop follows the footfall order Eadweard Muybridge photographed in 1878 ("The Horse in Motion"): hind, hind, fore, fore, then a moment with all four hooves off the ground and the legs gathered under the body.

## Screen texture
A retro CRT layer over everything at about 15% (heavier on 4:3 tube screens): scanlines, a soft vignette, a faint rolling band and a slight flicker. It should be felt more than seen.

## Don'ts
No drop shadows, no gradients on type, no copied artwork. Demo horses are always labeled DEMO.
