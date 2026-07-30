# Asset Credits

This project keeps external visuals local at runtime and tracks source pages here so future publishing, replacement, or license review stays straightforward.

Room images are used as subtle atmosphere behind the sandbox, not as standalone redistributed image packs. Pixabay images were downloaded on May 24, 2026; generated images are tracked separately below.

Audio ambience files are also kept local at runtime. They provide the native rain, cat purr, and fire beds; short material cues remain generated in Web Audio.

## Pixabay Room Backdrops

| App room | Local file | Source | Creator | License |
| --- | --- | --- | --- | --- |
| Rain Desk | `app/public/rooms/rain-desk.jpg` | [Rain Glass Window Night City Glass](https://pixabay.com/photos/rain-glass-window-night-city-glass-1516388/) | WikimediaImages | [Pixabay Content License](https://pixabay.com/service/license-summary/) |
| Moonlit Garden | `app/public/rooms/moonwater-garden.jpg` | [Night Moon Mountains Alps](https://pixabay.com/photos/night-moon-mountains-alps-4702174/) | jplenio | [Pixabay Content License](https://pixabay.com/service/license-summary/) |
| Stardust Hearth | `app/public/rooms/stardust-hearth.jpg` | [Cozy Home Bedroom Bed Fireplace](https://pixabay.com/photos/cozy-home-bedroom-bed-fireplace-7023760/) | 10634669 | [Pixabay Content License](https://pixabay.com/service/license-summary/) |

## Generated Room Backdrops

These images were generated for this project on May 26, 2026 using OpenAI image generation, then compressed locally for the browser build.

| App room | Local file | Source | Prompt summary |
| --- | --- | --- | --- |
| Cozy Fireplace | `app/public/rooms/cozy-fireplace.jpg` | OpenAI image generation | Cozy nighttime cabin interior with a glowing fireplace, dark UI-safe edges, no people or text. |
| Forest Hut | `app/public/rooms/forest-hut.jpg` | OpenAI image generation | Night forest clearing with a small warm hut/window glow, dark UI-safe edges, no people or text. |
| Snow Window | `app/public/rooms/snow-window.jpg` | OpenAI image generation | Snowy winter night viewed from a warm cabin window, dark UI-safe edges, no people or text. |

## Audio Ambience

| App sound | Local file | Source | Creator | License |
| --- | --- | --- | --- | --- |
| Fire crackle | `app/public/audio/fire-crackle.mp3` | [Fireplace with crackling sounds 2 min. RK](https://pixabay.com/sound-effects/film-special-effects-fireplace-with-crackling-sounds-2-min-rk-178392/) | RonKoster2023 | [Pixabay Content License](https://pixabay.com/service/license-summary/) |
| Cat purr | `app/public/audio/cat-purr.mp3` | User-provided local audio `catpurr.mp3` | User-provided | User-supplied |
| Rain | `app/public/audio/rain.mp3` | User-provided local audio `rain.mp3` | User-provided | User-supplied |

Fire crackle processing notes: downloaded on June 10, 2026 as `ronkoster2023-fireplace-with-crackling-sounds-2-min-rk-178392.mp3`, converted locally into a mono 32 kHz WAV, lightly leveled, and smoothed at the loop boundary. The output is about 119.95 seconds. The previous CC0 fire crackle file was not mixed into this asset.

Cat purr and rain processing notes: copied from user-provided local MP3 files on June 12, 2026 without mixing, scraping, or runtime network requests.

Compression pass, July 25, 2026: all three beds were re-encoded for web delivery so the app can be embedded on another site without a 19 MB download. Fire crackle went from a 7.3 MB mono WAV to a 1.15 MB mono 80 kbps MP3 (the file extension changed with it); rain from 8.5 MB at 256 kbps to 3.18 MB at 96 kbps; cat purr from 2.2 MB at 160 kbps to 0.89 MB at 64 kbps. Durations are unchanged to the millisecond, and each bed's measured mean level moved by at most 0.5 dB, so the `levelTrim` calibration in `assets.ts` still holds. The purr was deliberately kept stereo: downmixing it to mono raised its level 2.6 dB and would have invalidated that calibration. No content was edited, mixed, or re-timed — this is a format change only.

## Usage Notes

- The app serves these images from `app/public/rooms`; there are no runtime requests to Pixabay.
- The app serves ambience recordings from `app/public/audio`; there are no runtime requests to Pixabay or OpenGameArt.
- Attribution is kept here for traceability even when the source license does not require visible in-app credit.
- If a room image is replaced, update this file in the same change as the asset and scene metadata.
- If an audio ambience file is replaced, update this file in the same change as the asset and native ambience loader.
