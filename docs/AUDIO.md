# Audio Foundation

Audio is part of the product feel, not a decoration. The current direction is procedural, local, and low-cost: no streaming dependency, no bundled music files, no accounts, and no paid APIs.

## Module Boundaries

`app/src/audio.ts` is the public entrypoint used by React. It re-exports the controller, preference helpers, and shared types.

Focused implementation modules live under `app/src/audio`:

- `types.ts`: shared audio types.
- `preferences.ts`: localStorage shape, defaults, channel list, and normalization.
- `moods.ts`: reusable sound moods shared by the controller and UI.
- `providers.ts`: generated/external music provider definitions and availability rules.
- `mixer.ts`: Web Audio graph for `master`, `ambience`, `music`, and the reserved `effects` channel.
- `ambience.ts`: rain, room hush, low room tone, and occasional window drips.
- `music.ts`: rainy lo-fi procedural music bed.
- `effects.ts`: prototype material paint sounds, reaction cues, and UI cues. This module is currently disabled because the synthetic one-shots felt too arcade-like.
- `buffers.ts`: reusable generated noise buffers.
- `utils.ts`: small shared helpers.
- `controller.ts`: lifecycle and public methods used by the app.

## Runtime Rules

- Audio starts only after a user clicks the sound button.
- The app must fully work without sound.
- Preferences persist, but `enabled` always reloads as false so browsers do not autoplay.
- Mute and stop should fade through mixer gain instead of tearing down every node.
- Music, ambience, and future realistic Foley stay on separate channels so the simple panel can become a fuller mixer later.
- Mood changes should restart long-running ambience/music layers cleanly.
- One-shot sources should disconnect themselves after their `ended` event so long play sessions do not keep stale Web Audio nodes around.
- External music must be optional. The generated music provider remains the default and fallback.
- One-shot effects are disabled in the current build. Re-enable them only after a more realistic Foley/sample direction replaces the prototype synth cues.

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

Phase 3 has the provider boundary in place before adding YouTube:

- Generated provider: current procedural lo-fi bed owned by `music.ts`.
- External provider: future wrapper for a visible third-party player, such as YouTube. The current UI shows this as the planned Desk Radio path, but does not start external playback yet.

The provider boundary should expose calm app-level methods:

- `start`
- `pause`
- `setVolume`
- `setMood` or `setSource`
- `dispose`

External music should replace only the music layer. Ambience stays native so the sandbox remains coherent even if YouTube is blocked, unavailable, or showing ads. Future realistic Foley should stay native too.

YouTube-specific implementation belongs in Phase 5. It should use a visible mini-player/drawer and the official IFrame Player API. Do not scrape YouTube, hide the player, require an API key, or make YouTube the only music path.

## Reaction Cues

The app detects broad simulation changes after each tick and maps them to a small set of calm cues:

- `steam`: water, moonwater, or fire becoming steam.
- `cool`: lava cooling into stone.
- `growth`: seeds, soil, or wood turning into moss/fungus.
- `spark`: meteor/stardust changes.

Detection lives in `app/src/reactions.ts`. Playback is currently disabled at the controller boundary until the effect palette has a more realistic Foley direction.

## Adding Audio

Add new sounds in the narrowest module:

- material or UI one-shots: `effects.ts`, but only after a natural Foley/sample-like direction is ready
- long environmental loop: `ambience.ts`
- musical pattern, rhythm, or harmonic change: `music.ts`
- new mood preset: `moods.ts`
- provider switching or external music hooks: add a provider boundary first, then keep YouTube-specific code isolated.
- channel/routing behavior: `mixer.ts`
- preference shape: `preferences.ts`

Keep source creation short-lived for one-shots. For long-running layers, return an `AudioLayerHandle` with a `stop` method so the controller can dispose cleanly.
