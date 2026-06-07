# Asset Credits

This project keeps external visuals local at runtime and tracks source pages here so future publishing, replacement, or license review stays straightforward.

Room images are used as subtle atmosphere behind the sandbox, not as standalone redistributed image packs. Pixabay images were downloaded on May 24, 2026; generated images are tracked separately below.

Audio ambience files are also kept local at runtime. They support the native ambience bed; short material cues and fallback tones remain generated in Web Audio.

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

## OpenGameArt Audio Ambience

| App sound | Local file | Source | Creator | License |
| --- | --- | --- | --- | --- |
| Fire crackle | `app/public/audio/fire-crackle.ogg` | [Fire Crackling](https://opengameart.org/content/fire-crackling) | bart | CC0 |
| Rain and thunder | `app/public/audio/rain-thunder.ogg` | [Rain and Thunders](https://opengameart.org/content/rain-and-thunders) | dklon | CC0 |
| Creek water | `app/public/audio/creek-water.ogg` | [Water](https://opengameart.org/content/water) | Michel Baradari | [CC-BY 3.0](https://creativecommons.org/licenses/by/3.0/) |

## Usage Notes

- The app serves these images from `app/public/rooms`; there are no runtime requests to Pixabay.
- The app serves ambience recordings from `app/public/audio`; there are no runtime requests to OpenGameArt.
- Attribution is kept here for traceability even when the source license does not require visible in-app credit.
- If a room image is replaced, update this file in the same change as the asset and scene metadata.
- If an audio ambience file is replaced, update this file in the same change as the asset and native ambience loader.
