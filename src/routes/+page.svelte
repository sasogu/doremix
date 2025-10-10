<script lang="ts">
  import { onMount } from 'svelte';
  import {
    phrasePacks,
    initPhrasePackStore,
    saveNewPack,
    addPhraseToPack,
    getPhrase,
    deletePack,
    type Phrase,
    type PhraseEvent
  } from '$lib/storage/phrasePacks';
  import { parseSMF, type SMFMetadata } from '$lib/midi/smf';

  let ac: AudioContext;
  let worklet: AudioWorkletNode;
  let bpm = 120;
  let isPlaying = false;

  const defaultEvents: PhraseEvent[] = [
    { beat: 0, type: 'noteon', note: 60, velocity: 0.8 },
    { beat: 0.5, type: 'noteoff', note: 60 },
    { beat: 1, type: 'noteon', note: 64, velocity: 0.8 },
    { beat: 1.5, type: 'noteoff', note: 64 },
    { beat: 2, type: 'noteon', note: 67, velocity: 0.8 },
    { beat: 2.5, type: 'noteoff', note: 67 },
    { beat: 3, type: 'noteon', note: 72, velocity: 0.8 },
    { beat: 3.5, type: 'noteoff', note: 72 }
  ];

  let currentPhrase: Phrase = {
    id: 'default-phrase',
    name: 'Clip demo',
    bpm,
    events: cloneEvents(defaultEvents)
  };

  let clip = currentPhrase.events;
  let storageReady = false;
  let storageError: string | null = null;
  let newPackName = 'Pack demo';
  let newPhraseName = currentPhrase.name;
  let appendPackId = '';
  let savingNewPack = false;
  let addingPhrase = false;
  let loadingPhraseKey: string | null = null;
  let deletingPackId: string | null = null;
  let midiLoadError: string | null = null;
  let midiMetadata: SMFMetadata | null = null;
  let midiLoading = false;
  let midiFileName = '';

  $: packsCount = $phrasePacks.length;
  $: currentPhraseLabel = currentPhrase?.name ?? 'Clip actual';
  $: if (storageReady && !appendPackId && packsCount > 0) {
    appendPackId = $phrasePacks[0].id;
  }

  function cloneEvents(events: PhraseEvent[]) {
    return events.map((ev) => ({ ...ev }));
  }

  function snapshotCurrentPhrase(nameOverride?: string): Phrase {
    return {
      id: crypto.randomUUID(),
      name: nameOverride?.trim() || currentPhraseLabel,
      bpm,
      events: cloneEvents(clip)
    };
  }

  async function setup() {
    if (!ac) {
      ac = new AudioContext({ latencyHint: 'interactive' });
      await ac.audioWorklet.addModule('/engine.worklet.js');
      worklet = new AudioWorkletNode(ac, 'doremix-synth');
      worklet.connect(ac.destination);
    }
  }

  function scheduleClip() {
    if (!clip.length) return;
    const secPerBeat = 60 / bpm;
    const start = ac.currentTime + 0.1; // small offset
    const events = clip.map((ev) => ({
      t: start + ev.beat * secPerBeat,
      type: ev.type,
      note: ev.note,
      velocity: ev.velocity ?? 0
    }));
    worklet.port.postMessage({ type: 'schedule', events });
  }

  async function play() {
    await setup();
    await ac.resume();
    isPlaying = true;
    scheduleClip();
  }

  function stop() {
    if (!ac) return;
    worklet.port.postMessage({ type: 'allnotesoff' });
    isPlaying = false;
  }

  async function handleSaveNewPack() {
    if (!storageReady || savingNewPack) return;
    savingNewPack = true;
    storageError = null;
    try {
      const phrase = snapshotCurrentPhrase(newPhraseName);
      const pack = await saveNewPack({
        name: newPackName.trim() || 'Pack sin nombre',
        phrases: [phrase]
      });
      appendPackId = pack.id;
    } catch (err) {
      storageError = (err as Error).message ?? 'Error guardando pack';
    } finally {
      savingNewPack = false;
    }
  }

  async function handleAddPhraseToPack() {
    if (!appendPackId || addingPhrase) return;
    addingPhrase = true;
    storageError = null;
    try {
      const phrase = snapshotCurrentPhrase(newPhraseName);
      await addPhraseToPack(appendPackId, phrase);
    } catch (err) {
      storageError = (err as Error).message ?? 'Error guardando frase';
    } finally {
      addingPhrase = false;
    }
  }

  async function loadPhraseFromPack(packId: string, phraseId: string) {
    if (loadingPhraseKey) return;
    loadingPhraseKey = `${packId}:${phraseId}`;
    storageError = null;
    try {
      const phrase = await getPhrase(packId, phraseId);
      if (!phrase) return;
      const phraseBpm = phrase.bpm ?? bpm;
      currentPhrase = {
        ...phrase,
        bpm: phraseBpm,
        events: cloneEvents(phrase.events)
      };
      clip = currentPhrase.events;
      bpm = phraseBpm;
      newPhraseName = phrase.name;
      if (isPlaying) {
        stop();
        await play();
      }
    } catch (err) {
      storageError = (err as Error).message ?? 'Error cargando frase';
    } finally {
      loadingPhraseKey = null;
    }
  }

  async function handleDeletePack(packId: string) {
    if (deletingPackId) return;
    deletingPackId = packId;
    storageError = null;
    try {
      await deletePack(packId);
      if (appendPackId === packId) {
        appendPackId = '';
      }
    } catch (err) {
      storageError = (err as Error).message ?? 'Error eliminando pack';
    } finally {
      deletingPackId = null;
    }
  }

  async function handleMidiFileSelect(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input?.files?.[0];
    if (!file) return;
    midiLoading = true;
    midiLoadError = null;
    midiMetadata = null;
    midiFileName = file.name;
    try {
      const buffer = await file.arrayBuffer();
      const parsed = parseSMF(buffer);
      if (!parsed.events.length) {
        throw new Error('El archivo no contiene notas.');
      }
      const phraseBpm = parsed.metadata.tempoBpm ?? bpm ?? 120;
      const phraseName =
        parsed.metadata.trackNames[0] ||
        file.name.replace(/\.(mid|midi)$/i, '') ||
        'Frase desde SMF';
      const events = cloneEvents(parsed.events);
      clip = events;
      currentPhrase = {
        id: crypto.randomUUID(),
        name: phraseName,
        bpm: phraseBpm,
        events
      };
      bpm = phraseBpm;
      newPhraseName = phraseName;
      if (isPlaying) {
        stop();
        await play();
      }
      midiMetadata = parsed.metadata;
      input.value = '';
    } catch (err) {
      midiLoadError =
        (err as Error).message ?? 'No fue posible leer el archivo MIDI.';
    } finally {
      midiLoading = false;
    }
  }

  onMount(async () => {
    try {
      await initPhrasePackStore();
      storageReady = true;
    } catch (err) {
      storageError =
        (err as Error).message ??
        'No fue posible inicializar el almacenamiento local.';
    }
  });
</script>

<main class="p-6 min-h-screen" style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, sans-serif; background:#0b0b0b; color:#f2f2f2;">
  <h1 style="font-size:2rem; font-weight:700; margin-bottom:1rem;">DoReMix — PWA (SvelteKit)</h1>
  <p style="opacity:0.8; margin-bottom:1.5rem;">Demo: reproduce un pequeño "clip" de 1 compás con un sintetizador en AudioWorklet.</p>

  <div style="display:flex; gap:1rem; align-items:center; margin-bottom:1rem;">
    <label for="bpm-input">BPM</label>
    <input id="bpm-input" type="number" bind:value={bpm} min="40" max="240" style="width:5rem; padding:0.4rem; background:#181818; color:#fff; border:1px solid #333; border-radius:8px;" />
    <button on:click={play} disabled={isPlaying} style="padding:0.6rem 1rem; border-radius:10px; background:#2c7efc; color:#fff; border:0;">Play</button>
    <button on:click={stop} disabled={!isPlaying} style="padding:0.6rem 1rem; border-radius:10px; background:#444; color:#fff; border:0;">Stop</button>
  </div>

  <p style="opacity:0.7; margin-bottom:1.5rem;">Frase actual: {currentPhraseLabel}</p>

  <section style="border:1px solid #333; border-radius:12px; padding:1.2rem; max-width:820px; margin-bottom:2rem;">
    <h2 style="font-size:1.2rem; margin:0 0 0.8rem 0;">Importar SMF (.mid)</h2>
    <p style="opacity:0.75; margin-bottom:0.8rem;">Carga un archivo MIDI estándar para convertirlo en la frase activa.</p>
    <div style="display:flex; flex-wrap:wrap; gap:0.8rem; align-items:center; margin-bottom:0.8rem;">
      <label for="smf-file" style="min-width:8rem;">Archivo SMF</label>
      <input
        id="smf-file"
        type="file"
        accept=".mid,.midi"
        on:change={handleMidiFileSelect}
        disabled={midiLoading}
        style="flex:1 1 240px; min-width:220px; padding:0.45rem; background:#181818; color:#fff; border:1px solid #333; border-radius:8px;"
      />
      {#if midiLoading}
        <span style="opacity:0.7;">Procesando…</span>
      {:else if midiFileName}
        <span style="opacity:0.7;">Último archivo: {midiFileName}</span>
      {/if}
    </div>
    {#if midiLoadError}
      <p style="color:#ff6b6b; margin:0 0 0.8rem 0;">{midiLoadError}</p>
    {/if}
    {#if midiMetadata}
      <div style="border:1px solid #2a2a2a; border-radius:10px; padding:0.8rem;">
        <h3 style="margin:0 0 0.5rem 0; font-size:1rem;">Metadatos extraídos</h3>
        <ul style="margin:0; padding-left:1.2rem; line-height:1.6;">
          <li>Formato: {midiMetadata.formatType} ({midiMetadata.trackCount} pistas)</li>
          <li>Resolución: {midiMetadata.ticksPerQuarter} ticks por negra</li>
          <li>BPM detectado: {midiMetadata.tempoBpm ?? 'sin meta tempo (usando actual)'}</li>
          <li>Duración (compases aprox.): {Math.max(0, midiMetadata.durationBeats / 4).toFixed(2)}</li>
          {#if midiMetadata.trackNames.length}
            <li>Nombres de pista: {midiMetadata.trackNames.join(', ')}</li>
          {/if}
        </ul>
      </div>
    {/if}
  </section>

  <section style="border:1px solid #333; border-radius:12px; padding:1.2rem; max-width:820px; margin-bottom:2rem;">
    <h2 style="font-size:1.2rem; margin:0 0 0.8rem 0;">Packs de frases (IndexedDB / OPFS)</h2>
    {#if !storageReady}
      <p style="opacity:0.7;">Inicializando almacenamiento local…</p>
    {:else}
      {#if storageError}
        <p style="color:#ff6b6b; margin-bottom:0.8rem;">{storageError}</p>
      {/if}
      <div style="display:grid; gap:1rem; margin-bottom:1.2rem;">
        <form on:submit|preventDefault={handleSaveNewPack} style="display:flex; flex-wrap:wrap; gap:0.6rem; align-items:center;">
          <strong style="min-width:12rem;">Nuevo pack desde el clip actual</strong>
          <input
            type="text"
            bind:value={newPackName}
            placeholder="Nombre del pack"
            style="flex:1 1 160px; min-width:160px; padding:0.45rem; background:#181818; color:#fff; border:1px solid #333; border-radius:8px;"
          />
          <input
            type="text"
            bind:value={newPhraseName}
            placeholder="Nombre de la frase"
            style="flex:1 1 160px; min-width:160px; padding:0.45rem; background:#181818; color:#fff; border:1px solid #333; border-radius:8px;"
          />
          <button
            type="submit"
            disabled={savingNewPack}
            style="padding:0.55rem 1.2rem; border-radius:10px; background:#27ae60; color:#fff; border:0;"
          >
            {savingNewPack ? 'Guardando…' : 'Guardar como nuevo pack'}
          </button>
        </form>

        <form on:submit|preventDefault={handleAddPhraseToPack} style="display:flex; flex-wrap:wrap; gap:0.6rem; align-items:center;">
          <strong style="min-width:12rem;">Añadir al pack seleccionado</strong>
          <select
            bind:value={appendPackId}
            style="flex:0 1 220px; min-width:160px; padding:0.45rem; background:#181818; color:#fff; border:1px solid #333; border-radius:8px;"
          >
            <option value="" disabled selected={appendPackId === '' || packsCount === 0}>Selecciona un pack</option>
            {#each $phrasePacks as pack}
              <option value={pack.id}>{pack.name}</option>
            {/each}
          </select>
          <input
            type="text"
            bind:value={newPhraseName}
            placeholder="Nombre de la frase"
            style="flex:1 1 160px; min-width:160px; padding:0.45rem; background:#181818; color:#fff; border:1px solid #333; border-radius:8px;"
          />
          <button
            type="submit"
            disabled={!appendPackId || addingPhrase}
            style="padding:0.55rem 1.2rem; border-radius:10px; background:#f39c12; color:#fff; border:0;"
          >
            {addingPhrase ? 'Añadiendo…' : 'Añadir frase al pack'}
          </button>
        </form>
      </div>

      <div>
        <h3 style="font-size:1rem; margin:0 0 0.5rem 0;">Mis packs guardados</h3>
        {#if !$phrasePacks.length}
          <p style="opacity:0.7;">No hay packs guardados todavía. Guarda el clip de ejemplo para crear el primero.</p>
        {:else}
          <ul style="list-style:none; padding:0; margin:0; display:flex; flex-direction:column; gap:0.8rem;">
            {#each $phrasePacks as pack}
              <li style="border:1px solid #2a2a2a; border-radius:10px; padding:0.8rem;">
                <div style="display:flex; justify-content:space-between; align-items:center; gap:0.6rem; margin-bottom:0.6rem;">
                  <div>
                    <strong>{pack.name}</strong>
                    <span style="opacity:0.6; font-size:0.85rem; margin-left:0.4rem;">{new Date(pack.updatedAt).toLocaleString()}</span>
                  </div>
                  <button
                    type="button"
                    on:click={() => handleDeletePack(pack.id)}
                    disabled={deletingPackId === pack.id}
                    style="padding:0.4rem 0.9rem; border-radius:8px; background:#c0392b; color:#fff; border:0;"
                  >
                    {deletingPackId === pack.id ? 'Eliminando…' : 'Eliminar'}
                  </button>
                </div>
                {#if !pack.phrases.length}
                  <p style="opacity:0.6; margin:0;">No hay frases en este pack.</p>
                {:else}
                  <ul style="list-style:none; padding:0; margin:0; display:flex; flex-direction:column; gap:0.4rem;">
                    {#each pack.phrases as phrase}
                      <li style="display:flex; align-items:center; gap:0.6rem;">
                        <button
                          type="button"
                          on:click={() => loadPhraseFromPack(pack.id, phrase.id)}
                          disabled={loadingPhraseKey === `${pack.id}:${phrase.id}`}
                          style="padding:0.35rem 0.9rem; border-radius:8px; background:#2c7efc; color:#fff; border:0;"
                        >
                          {loadingPhraseKey === `${pack.id}:${phrase.id}` ? 'Cargando…' : 'Cargar'}
                        </button>
                        <span>{phrase.name}</span>
                        {#if phrase.bpm}
                          <span style="opacity:0.6; font-size:0.85rem;">{phrase.bpm} BPM</span>
                        {/if}
                      </li>
                    {/each}
                  </ul>
                {/if}
              </li>
            {/each}
          </ul>
        {/if}
      </div>
    {/if}
  </section>

  <div style="border:1px solid #333; border-radius:12px; padding:1rem; max-width:720px;">
    <h2 style="font-size:1.2rem; margin:0 0 0.5rem 0;">Qué incluye este esqueleto</h2>
    <ul style="line-height:1.6;">
      <li>AudioWorklet con sintetizador simple (seno) y <em>scheduler</em> básico</li>
      <li>VitePWA: manifest & service worker (instalable/offline)</li>
      <li>Página de prueba + controles</li>
    </ul>
  </div>
</main>
