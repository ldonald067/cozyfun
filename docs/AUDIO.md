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
- External music must be optional. The generated music provider remains the default and fallback.

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

## Music Providers

Phase 3 should prepare a provider boundary before adding YouTube:

- Generated provider: current procedural lo-fi bed owned by `music.ts`.
- External provider: future wrapper for a visible third-party player, such as YouTube.

The provider boundary should expose calm app-level methods:

- `start`
- `pause`
- `setVolume`
- `setMood` or `setSource`
- `dispose`

External music should replace only the music layer. Ambience and effects stay procedural so the sandbox remains coherent even if YouTube is blocked, unavailable, or showing ads.

YouTube-specific implementation belongs in Phase 5. It should use a visible mini-player/drawer and the official IFrame Player API. Do not scrape YouTube, hide the player, require an API key, or make YouTube the only music path.

## Adding Audio

Add new sounds in the narrowest module:

- material or UI one-shots: `effects.ts`
- long environmental loop: `ambience.ts`
- musical pattern, rhythm, or harmonic change: `music.ts`
- new mood preset: `moods.ts`
- provider switching or external music hooks: add a provider boundary first, then keep YouTube-specific code isolated.
- channel/routing behavior: `mixer.ts`
- preference shape: `preferences.ts`

Keep source creation short-lived for one-shots. For long-running layers, return an `AudioLayerHandle` with a `stop` method so the controller can dispose cleanly.
