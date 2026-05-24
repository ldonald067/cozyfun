# Audio Foundation

Audio is part of the product feel, not a decoration. The current direction is procedural, local, and low-cost: no streaming dependency, no bundled music files, no accounts, and no paid APIs.

## Module Boundaries

`app/src/audio.ts` is the public entrypoint used by React. It re-exports the controller, preference helpers, and shared types.

Focused implementation modules live under `app/src/audio`:

- `types.ts`: shared audio types.
- `preferences.ts`: localStorage shape, defaults, channel list, and normalization.
- `moods.ts`: reusable sound moods shared by the controller and UI.
- `mixer.ts`: Web Audio graph for `master`, `ambience`, `music`, and `effects`.
- `ambience.ts`: rain, room hush, and low room tone.
- `music.ts`: rainy lo-fi procedural music bed.
- `effects.ts`: material paint sounds and UI cues.
- `buffers.ts`: reusable generated noise buffers.
- `utils.ts`: small shared helpers.
- `controller.ts`: lifecycle and public methods used by the app.

## Runtime Rules

- Audio starts only after a user clicks the sound button.
- The app must fully work without sound.
- Preferences persist, but `enabled` always reloads as false so browsers do not autoplay.
- Mute and stop should fade through mixer gain instead of tearing down every node.
- Music, ambience, and effects stay on separate channels so the simple panel can become a fuller mixer later.
- Mood changes should restart long-running ambience/music layers cleanly, without changing the one-shot effects API.

## Music Direction

The music layer should feel like rainy lo-fi desk music:

- slow chord changes
- soft low thump
- brushed hat/snare texture
- vinyl dust
- low volume by default

Avoid dramatic pads, arcade leads, busy melodies, or anything that fights the sandbox sounds.

## Sound Moods

Sound moods are small procedural presets, not different audio files:

- Rain: balanced rain, vinyl dust, warm chords, and brushed beat.
- Window: louder rain, softer/slower music, and a more study-like feel.
- Stardust: lighter ambience, airier chords, and occasional shimmer.

Mood definitions live in `moods.ts`. Keep mood names user-facing and calm; keep implementation details inside the preset config.

## Adding Audio

Add new sounds in the narrowest module:

- material or UI one-shots: `effects.ts`
- long environmental loop: `ambience.ts`
- musical pattern, rhythm, or harmonic change: `music.ts`
- new mood preset: `moods.ts`
- channel/routing behavior: `mixer.ts`
- preference shape: `preferences.ts`

Keep source creation short-lived for one-shots. For long-running layers, return an `AudioLayerHandle` with a `stop` method so the controller can dispose cleanly.
