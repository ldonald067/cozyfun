# Audio Foundation

Audio is part of the product feel, not a decoration. The default direction is procedural, local, and low-cost: no bundled music files, no accounts, and no paid APIs. Desk Radio is the one optional external path, and it stays visible, user-provided, and replaceable by generated music when YouTube will not embed a link.

## Module Boundaries

`app/src/audio.ts` is the public entrypoint used by React. It re-exports the controller, preference helpers, and shared types.

Focused implementation modules live under `app/src/audio`:

- `types.ts`: shared audio types.
- `preferences.ts`: localStorage shape, defaults, channel list, and normalization.
- `moods.ts`: reusable sound moods shared by the controller and UI.
- `providers.ts`: generated/external music provider definitions and availability rules.
- `mixer.ts`: Web Audio graph for `master`, `ambience`, and `music`.
- `ambience.ts`: rain, room hush, low room tone, and occasional window drips.
- `music.ts`: procedural lo-fi jazz music bed.
- `cues.ts`: short native paint cues for material interaction feedback.
- `buffers.ts`: reusable generated noise buffers.
- `utils.ts`: small shared helpers.
- `controller.ts`: lifecycle and public methods used by the app.

## Runtime Rules

- Audio starts only after a user clicks the sound button.
- The app must fully work without sound.
- Preferences persist, but `enabled` always reloads as false so browsers do not autoplay.
- Mute and stop should fade through mixer gain instead of tearing down every node.
- Music and ambience stay on separate channels so the panel remains simple but useful.
- Mood changes should restart long-running ambience/music layers cleanly.
- External music must be optional. The generated music provider remains the default and fallback.

## Music Direction

The music layer should feel like rainy lo-fi desk music:

- swung jazz chord comping with seventh/ninth color
- a soft walking bass line
- small restrained melodic phrases
- brushed hat/snare texture, rim clicks, ghost notes, and low thump
- hip-hop pocket variation through quiet pickup kicks and fills
- vinyl dust
- quiet Rhodes-like color answers, texture layers, and sparse brushed fills
- low volume by default

Avoid dramatic pads, arcade leads, busy melodies, or anything that fights the sandbox sounds. Generated music should feel composed, but it should stay humble enough to sit behind painting and rain.

## Sound Moods

Sound moods are small procedural presets, not different audio files:

- Rain: balanced rain, vinyl dust, warm chords, and brushed beat.
- Window: louder rain, softer/slower music, and a more study-like feel.
- Stardust: lighter ambience, airier chords, and occasional shimmer.

Mood definitions live in `moods.ts`. Keep mood names user-facing and calm; keep implementation details inside the preset config.

## Music Providers

The music provider boundary keeps generated music and Desk Radio separate:

- Generated provider: local procedural lo-fi jazz bed owned by `music.ts`.
- External provider: visible Desk Radio drawer for a user-provided YouTube video or playlist link.

`app/src/deskRadio.ts` owns YouTube URL parsing, source validation, watch URL creation, and local source persistence. It accepts regular YouTube watch links, `youtu.be` links, raw video IDs, playlist links, embed/live/shorts links, and `youtube-nocookie.com` links; it does not search YouTube, call the Data API, scrape pages, hide playback, auto-select playlists, or require a server. If a watch URL includes `list=...`, Desk Radio treats it as a playlist source; otherwise a valid watch/embed/live/shorts URL is treated as a single video. Timestamped video links preserve their start time when embedded.

`DeskRadioPanel` renders the source through the YouTube player API so the app can detect embed failures such as error `101` or `150`. When YouTube blocks in-game playback, the app clears persisted Desk Radio state, returns the music provider to generated lo-fi jazz, keeps the attempted URL editable, and leaves the drawer open for another user-provided link.

The provider boundary exposes calm app-level methods:

- `start`
- `pause`
- `setVolume`
- `setMood` or `setSource`
- `dispose`

External music replaces only the music layer. Ambience stays native so the sandbox remains coherent even if YouTube is blocked, unavailable, or showing ads. Future realistic Foley should stay native too.

## Audio QA

Use the listening harness when generated music, ambience, or material cues change:

```powershell
.\scripts\audio-qa.ps1
```

It writes deterministic WAV references and a manifest to `.tmp/audio-qa`. The renderer is an offline reference built from the checked-in mood settings; browser Web Audio routing, autoplay behavior, and Desk Radio embedding are still covered by browser checks.

Reference tracks can guide taste, but do not sample, copy, scrape, or embed hidden audio from them. YouTube links remain user-provided Desk Radio sources only.

## Adding Audio

Add new sounds in the narrowest module:

- long environmental loop: `ambience.ts`
- musical pattern, rhythm, or harmonic change: `music.ts`
- new mood preset: `moods.ts`
- short material cue: `cues.ts`, routed through the ambience channel and throttled by `controller.ts`.
- provider switching or external music hooks: keep YouTube-specific parsing and persistence isolated in `deskRadio.ts`.
- channel/routing behavior: `mixer.ts`
- preference shape: `preferences.ts`

For long-running layers, return an `AudioLayerHandle` with a `stop` method so the controller can dispose cleanly. Add one-shot Foley only when there is a clear sound source and a live UI need.
