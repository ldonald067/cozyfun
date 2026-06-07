# Audio Foundation

Audio is part of the product feel, not a decoration. The native direction is local and ambience-first: credited rain/thunder, creek water, and fireplace crackle recordings, generated room tone and fallback layers, and sparse material cues. There is no generated lo-fi music bed.

Desk Radio is the one optional external playback path. It stays visible, user-provided, and replaceable by native ambience when YouTube will not embed a link.

## Module Boundaries

`app/src/audio.ts` is the public entrypoint used by React. It re-exports the controller, preference helpers, provider definitions, and shared types.

Focused implementation modules live under `app/src/audio`:

- `types.ts`: shared audio types.
- `preferences.ts`: localStorage shape, defaults, channel list, and normalization.
- `moods.ts`: native ambience moods for Rain + Creek, Light Thunder, and Fireplace.
- `rooms.ts`: room-linked ambience profiles that bias native ambience without adding controls.
- `providers.ts`: native/Desk Radio source definitions and compatibility rules.
- `mixer.ts`: Web Audio graph for `master` and `ambience`.
- `assets.ts`: local ambience recording metadata and browser decode cache.
- `ambience.ts`: recorded rain, creek, and fire loops plus generated room hush, hum, drips, and fallback layers.
- `cues.ts`: short native paint and reaction cues for material feedback.
- `reactions.ts`: post-tick reaction detector for sparse audio cues.
- `buffers.ts`: reusable generated noise buffers.
- `utils.ts`: small shared helpers.
- `controller.ts`: lifecycle and public methods used by the app.

## Runtime Rules

- Audio starts only after a user clicks the sound button.
- The app must fully work without sound.
- Preferences persist, but `enabled` always reloads as false so browsers do not autoplay.
- Mute and stop should fade through mixer gain instead of tearing down every node.
- Native ambience owns the Web Audio graph. Desk Radio plays through its visible YouTube player.
- Mood changes restart the ambience layer cleanly.
- Room changes may restart the ambience layer with a backdrop-specific profile, but they should not add more visible audio controls.
- If Desk Radio is blocked or cleared, return to native ambience and keep the attempted link editable when useful.

## Sound Moods

Sound moods are small balance presets over local ambience recordings and generated support layers:

- Rain: recorded rain/thunder and creek forward, with window drips and restrained room tone.
- Thunder: recorded rain/thunder and hush forward, with creek lower in the room.
- Fire: recorded chimney/fireplace crackle forward, with warm room tone and light weather still present.

Mood definitions live in `moods.ts`. Keep mood names user-facing and calm; keep implementation details inside the preset config.

Room ambience profiles live in `rooms.ts`. They quietly bias rain, creek, thunder, and fire crackle when the room backdrop changes.

## Desk Radio

Desk Radio is optional and user-controlled. It accepts regular YouTube watch links, `youtu.be` links, raw video IDs, playlist links, embed/live/shorts links, and `youtube-nocookie.com` links. It does not search YouTube, call the Data API, scrape pages, hide playback, auto-select playlists, or require a server.

`DeskRadioPanel` renders the source through the YouTube player API so the app can detect embed failures such as error `101` or `150`. When YouTube blocks in-game playback, the app clears persisted Desk Radio state, returns to native ambience, keeps the attempted URL editable, and leaves the drawer open for another user-provided link.

## Audio QA

Use the listening harness when native ambience or material cues change:

```powershell
.\scripts\audio-qa.ps1
```

It writes deterministic WAV references and a manifest to `.tmp/audio-qa`. The offline renderer covers generated support layers, fallback layers, and material cues from the checked-in mood and room settings; browser smoke checks verify that local OGG ambience assets are served and decodable. Browser Web Audio routing, autoplay behavior, and Desk Radio embedding are still covered by browser checks.

Reference tracks can guide taste, but do not sample, copy, scrape, or embed hidden audio from them. YouTube links remain user-provided Desk Radio sources only.

## Adding Audio

Add new sounds in the narrowest module:

- local ambience recording: `assets.ts`, `ambience.ts`, and `ASSET_CREDITS.md`
- long generated fallback loop: `ambience.ts`
- new mood preset: `moods.ts`
- room-specific ambience balance: `rooms.ts`
- short material cue: `cues.ts`, routed through the ambience channel and throttled by `controller.ts`
- reaction cue detection: `reactions.ts`
- provider switching or external playback hooks: keep YouTube-specific parsing and persistence isolated in `deskRadio.ts`
- channel/routing behavior: `mixer.ts`
- preference shape: `preferences.ts`

For long-running layers, return an `AudioLayerHandle` with a `stop` method so the controller can dispose cleanly. Add one-shot Foley only when there is a clear sound source and a live UI need.
