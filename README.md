# DoReMix — PWA (SvelteKit) — Esqueleto

Proyecto mínimo para una app tipo DoReMix basada en **frases MIDI** con:
- SvelteKit + Vite
- PWA (manifest + service worker con `vite-plugin-pwa`)
- AudioWorklet con un sinte muy básico (seno) y un scheduler minimal

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

## Próximos pasos sugeridos

- Transposición diatónica (tonalidad global) y cuantización por barra/beat
- Exportar a **SMF** y a **WAV** (OfflineAudioContext)
- Integrar **FluidSynth WASM** + SoundFont GM
