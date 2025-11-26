# DoReMix — PWA (SvelteKit)

Esqueleto de PWA para mezclar **frases MIDI** en navegador (SvelteKit + Vite) con:
- Secuenciador de 4 pistas x 8 compases y previsualización por celda.
- Motor interno (AudioWorklet seno) y modo **FluidSynth WASM + SoundFont GM**.
- Importador SMF (.mid), packs locales (OPFS/IndexedDB) y demo de **IA Magenta** en worker con caché.
- PWA lista con manifest + service worker (`vite-plugin-pwa`).

## Requisitos
- Node 18+
- pnpm, npm o yarn

## Instalación y scripts
```bash
npm i
npm run dev    # http://localhost:5173
npm run build
npm run preview
```

## Flujo rápido de uso
1) Arranca `npm run dev` y abre la app.  
2) Elige motor:  
   - **Motor interno**: sinte de seno en AudioWorklet (no requiere assets).  
   - **FluidSynth + SoundFont GM**: carga un SoundFont `.sf2/.sf3` desde la UI o usa el botón para leer `/fluidsynth/GeneralUser-GS.sf2`.
3) Ajusta BPM y decide reproducir la **secuencia completa** o solo la **frase actual**.
4) En el secuenciador por pistas (Percusión, Bajo, Acordes, Lead) selecciona para cada compás:
   - Frases base incluidas, la frase en edición o frases guardadas en packs.
   - Botón **▶** para previsualizar la celda; **Editar** copia la celda a la frase actual.
5) Guarda frases:
   - **Nuevo pack** desde el clip actual o **añadir frase** a un pack existente. Se almacenan en OPFS si está disponible (sino IndexedDB).
6) Importa **SMF (.mid)** para convertirlo en la frase activa; se muestran BPM detectado, nombres de pista y duración estimada.
7) IA opcional (Magenta):
   - Descarga bajo demanda modelos Melody (MusicVAE 16 bars) o Drums (DrumRNN), mostrando progreso y cacheando tras el primer uso.
   - El resultado sustituye la frase actual y activa la previsualización.

## FluidSynth + SoundFont GM
1. Coloca `libfluidsynth-*.js` y `libfluidsynth-*.wasm` (p.ej. `libfluidsynth-2.3.0.{js,wasm}`) en `static/fluidsynth/`.
2. Añade un SoundFont GM (`.sf2` o `.sf3`) en la misma carpeta; la UI intentará cargar `/fluidsynth/GeneralUser-GS.sf2` si existe.
3. En la app, selecciona el modo **FluidSynth**, carga el SoundFont (o usa el predeterminado) y reproduce la secuencia o cualquier pack.

## Secuenciador y packs
- 8 compases por pista, con cálculo automático de duración según la frase más larga en cada columna.
- Los packs y frases se guardan localmente; se pueden borrar o volver a cargar desde la lista.

## PWA
- Manifest + service worker incluidos (via `vite-plugin-pwa`).  
- Tras el primer build/preview puedes instalar la app y usarla offline (excepto descarga inicial de modelos IA o SoundFonts externos).

## Próximos pasos sugeridos
- Transposición diatónica (tonalidad global) y cuantización por barra/beat.
- Exportar a **SMF** y a **WAV** (OfflineAudioContext).
