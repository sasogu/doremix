# DoReMix — PWA (SvelteKit) — Esqueleto

Proyecto mínimo para una app tipo DoReMix basada en **frases MIDI** con:
- SvelteKit + Vite
- PWA (manifest + service worker con `vite-plugin-pwa`)
- AudioWorklet con un sinte muy básico (seno) y un scheduler minimal
- Modo opcional con **FluidSynth WASM** + SoundFont GM (carga manual desde la UI)
- Secuenciador multipista de 8 compases para combinar frases

## Requisitos
- Node 18+
- pnpm, npm o yarn

## Instalación
```bash
npm i
npm run dev
# abre http://localhost:5173
```

Para build:
```bash
npm run build
npm run preview
```

## FluidSynth + SoundFont GM

1. Descarga los binarios de FluidSynth compilados para WebAssembly (`libfluidsynth-*.js` + `libfluidsynth-*.wasm`, por ejemplo `libfluidsynth-2.3.0.{js,wasm}`) y colócalos en `static/fluidsynth/`.
2. Añade un SoundFont General MIDI (`gm.sf2` o `.sf3`) en la misma carpeta o cárgalo desde la app mediante el selector de archivos.
3. En la demo, selecciona el motor **FluidSynth + SoundFont GM**, carga el SoundFont y reproduce cualquier frase MIDI o pack almacenado.

## Secuenciador por pistas

- Cada fila representa una capa (percusión, bajo, acordes, lead). Cada columna equivale a un compás (4 beats).
- Puedes asignar frases base incluidas, la frase en edición o cualquier frase guardada en tus packs.
- El selector de reproducción permite alternar entre escuchar la secuencia completa o previsualizar solo la frase actual.
- El botón «Editar» copia la frase de la celda al editor para poder modificarla y volver a guardarla si lo necesitas.

## Próximos pasos sugeridos

- Transposición diatónica (tonalidad global) y cuantización por barra/beat
- Exportar a **SMF** y a **WAV** (OfflineAudioContext)
