<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { phraseToQuantizedSequence } from '$lib/ai/noteSequenceAdapters';
  import type { PhraseEvent } from '$lib/storage/phrasePacks';

  const STEPS_PER_BEAT = 4;
  const BEATS_PER_BAR = 4;
  const STEPS_PER_BAR = STEPS_PER_BEAT * BEATS_PER_BAR;
  const DEFAULT_STEP_PX = 22;
  const MIN_STEP_PX = 12;
  const MAX_STEP_PX = 48;
  const DEFAULT_ROW_PX = 26;
  const MIN_ROW_PX = 10;
  const MAX_ROW_PX = 64;
  const BASE_PITCH_COUNT = 25;
  const PITCH_MIN_LIMIT = 21; // A1
  const PITCH_MAX_LIMIT = 108; // C8 aprox

  type RollNote = {
    id: string;
    pitch: number;
    start: number;
    end: number;
    velocity: number;
  };

  export let events: PhraseEvent[] = [];
  export let bpm = 120;
  export let bars = 4;
  export let playheadBeat = 0;
  export let playheadTotalBeats = 0;
  export let isPlaying = false;

  const dispatch = createEventDispatcher<{
    change: { events: PhraseEvent[] };
    play: void;
    stop: void;
  }>();
  let noteLengthSteps = 4;
  let velocity = 0.85;
  let localNotes: RollNote[] = [];
  let cachedKey = '';
  let scrollArea: HTMLDivElement | null = null;
  let stepPx = DEFAULT_STEP_PX;
  let rowPx = DEFAULT_ROW_PX;
  let playheadX = 0;
  let pitchRange: number[] = [];

  $: syncNotesFromEvents();
  $: totalSteps = Math.max(
    bars * STEPS_PER_BAR,
    localNotes.reduce((max, n) => Math.max(max, n.end), 0),
    Math.ceil(playheadTotalBeats * STEPS_PER_BEAT),
    STEPS_PER_BAR
  );
  $: barCount = Math.ceil(totalSteps / STEPS_PER_BAR);
  $: playheadX = playheadBeat * STEPS_PER_BEAT * stepPx;
  $: maybeAutoscrollPlayhead();
  $: pitchRange = computePitchRange(rowPx);

  function syncNotesFromEvents() {
    const key = serialize(events);
    if (key === cachedKey) return;
    cachedKey = key;
    localNotes = eventsToNotes(events);
  }

  function serialize(evts: PhraseEvent[]) {
    if (!evts?.length) return '';
    return JSON.stringify(evts.map((ev) => [ev.beat, ev.type, ev.note, ev.velocity ?? null]));
  }

  function makeId() {
    return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
  }

  function eventsToNotes(evts: PhraseEvent[]): RollNote[] {
    if (!evts?.length) return [];
    const phrase = { id: 'tmp', name: 'tmp', bpm, events: evts };
    const seq = phraseToQuantizedSequence(phrase);
    return seq.notes.map((n) => ({
      id: makeId(),
      pitch: n.pitch,
      start: n.quantizedStartStep,
      end: n.quantizedEndStep,
      velocity: Math.max(0.1, Math.min(1, (n.velocity ?? 100) / 127))
    }));
  }

  function notesToEvents(notes: RollNote[]): PhraseEvent[] {
    const evs: PhraseEvent[] = [];
    for (const n of notes) {
      evs.push({
        beat: n.start / STEPS_PER_BEAT,
        type: 'noteon',
        note: n.pitch,
        velocity: n.velocity
      });
      evs.push({
        beat: n.end / STEPS_PER_BEAT,
        type: 'noteoff',
        note: n.pitch
      });
    }
    evs.sort((a, b) => {
      if (a.beat === b.beat) {
        if (a.type === b.type) return a.note - b.note;
        return a.type === 'noteoff' ? 1 : -1;
      }
      return a.beat - b.beat;
    });
    return evs;
  }

  function emitChange(notes: RollNote[]) {
    const evs = notesToEvents(notes);
    cachedKey = serialize(evs);
    dispatch('change', { events: evs });
  }

  function requestPlay() {
    dispatch('play');
  }

  function requestStop() {
    dispatch('stop');
  }

  function findNoteAt(pitch: number, step: number) {
    return localNotes.find((n) => n.pitch === pitch && step >= n.start && step < n.end);
  }

  function handleRowClick(event: MouseEvent, pitch: number) {
    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const scrollLeft = scrollArea?.scrollLeft ?? 0;
    const x = event.clientX - rect.left + scrollLeft;
    const step = Math.max(0, Math.floor(x / stepPx));
    const existing = findNoteAt(pitch, step);
    if (existing) {
      localNotes = localNotes.filter((n) => n.id !== existing.id);
      emitChange(localNotes);
      return;
    }
    const start = step;
    const end = Math.min(start + noteLengthSteps, totalSteps);
    const note: RollNote = { id: makeId(), pitch, start, end, velocity };
    localNotes = [...localNotes, note];
    emitChange(localNotes);
  }

  function handleRowKey(event: KeyboardEvent, pitch: number) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    const fakeMouse = {
      ...event,
      currentTarget: event.currentTarget
    } as unknown as MouseEvent;
    handleRowClick(fakeMouse, pitch);
  }

  function maybeAutoscrollPlayhead() {
    if (!scrollArea) return;
    if (playheadTotalBeats <= 0) return;
    const viewLeft = scrollArea.scrollLeft;
    const viewWidth = scrollArea.clientWidth;
    const targetLeft = Math.max(0, playheadX - viewWidth * 0.4);
    if (Math.abs(targetLeft - viewLeft) < 4) return;
    scrollArea.scrollTo({ left: targetLeft, behavior: 'auto' });
  }

  function removeNote(id: string) {
    localNotes = localNotes.filter((n) => n.id !== id);
    emitChange(localNotes);
  }

  function handleNoteKey(event: KeyboardEvent, id: string) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    removeNote(id);
  }

  function clearAll() {
    localNotes = [];
    emitChange(localNotes);
  }

  function formatNote(pitch: number) {
    const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const name = names[pitch % 12] ?? '?';
    const octave = Math.floor(pitch / 12) - 1;
    return `${name}${octave}`;
  }

  function clamp(value: number, min: number, max: number) {
    return Math.max(min, Math.min(max, value));
  }

  function computePitchRange(rowHeight: number) {
    const factor = DEFAULT_ROW_PX / Math.max(rowHeight, 1);
    const desired = Math.round(BASE_PITCH_COUNT * factor);
    const count = clamp(desired, BASE_PITCH_COUNT, 96);
    const center = 60; // C4
    let minPitch = center - Math.floor((count - 1) / 2);
    let maxPitch = minPitch + count - 1;
    if (minPitch < PITCH_MIN_LIMIT) {
      minPitch = PITCH_MIN_LIMIT;
      maxPitch = minPitch + count - 1;
    }
    if (maxPitch > PITCH_MAX_LIMIT) {
      maxPitch = PITCH_MAX_LIMIT;
      minPitch = maxPitch - count + 1;
    }
    return Array.from({ length: maxPitch - minPitch + 1 }, (_, idx) => maxPitch - idx);
  }
</script>

  <div class="panel" style={`--row:${rowPx}px;`} aria-label="Editor piano roll">
  <div class="controls">
    <label>
      Longitud nueva nota
      <input type="range" min="1" max="32" step="1" bind:value={noteLengthSteps} />
      <span>{(noteLengthSteps / STEPS_PER_BEAT).toFixed(2)} beats</span>
    </label>
    <label>
      Velocidad
      <input type="range" min="0.2" max="1" step="0.05" bind:value={velocity} />
      <span>{Math.round(velocity * 127)} / 127</span>
    </label>
    <label>
      Zoom horizontal
      <input
        type="range"
        min={MIN_STEP_PX}
        max={MAX_STEP_PX}
        step="1"
        bind:value={stepPx}
      />
      <span>{Math.round((stepPx / DEFAULT_STEP_PX) * 100)} %</span>
    </label>
    <label>
      Zoom vertical
      <input
        type="range"
        min={MIN_ROW_PX}
        max={MAX_ROW_PX}
        step="1"
        bind:value={rowPx}
      />
      <span>{Math.round((rowPx / DEFAULT_ROW_PX) * 100)} %</span>
    </label>
    <label>
      Compases visibles
      <input type="range" min="1" max="8" step="1" bind:value={bars} />
      <span>{barCount} compases</span>
    </label>
    <div class="controls__actions">
      <button
        type="button"
        on:click={requestPlay}
        class="btn btn--primary"
        aria-label="Reproducir frase"
        disabled={isPlaying}
      >
        ▶ Play
      </button>
      <button
        type="button"
        on:click={requestStop}
        class="btn"
        aria-label="Parar reproducción"
        disabled={!isPlaying}
      >
        Stop
      </button>
      <button type="button" on:click={clearAll} class="btn">Vaciar notas</button>
    </div>
  </div>

  <div class="roll">
    <div class="piano">
      {#each pitchRange as pitch}
        <div class="key">{formatNote(pitch)}</div>
      {/each}
    </div>
    <div
      class="grid-shell"
      bind:this={scrollArea}
      style={`--step:${stepPx}px; --beat:${stepPx * STEPS_PER_BEAT}px; --bar:${stepPx * STEPS_PER_BAR}px;`}
    >
      <div class="grid" style={`min-width:${totalSteps * stepPx}px;`}>
        {#if playheadTotalBeats > 0}
          <div
            class="playhead"
            style={`left:${playheadX}px; height:${pitchRange.length * rowPx}px;`}
          ></div>
        {/if}
        {#each pitchRange as pitch}
          <div
            class={`row ${pitch % 12 === 1 || pitch % 12 === 3 || pitch % 12 === 6 || pitch % 12 === 8 || pitch % 12 === 10 ? 'row--black' : ''}`}
            style={`height:${rowPx}px;`}
            role="button"
            tabindex="0"
            aria-label={`Fila ${formatNote(pitch)}`}
            on:click={(event) => handleRowClick(event, pitch)}
            on:keydown={(event) => handleRowKey(event, pitch)}
          >
            {#each localNotes.filter((n) => n.pitch === pitch) as note (note.id)}
              <div
                class="note"
                style={`left:${note.start * stepPx}px; width:${Math.max(
                  stepPx,
                  (note.end - note.start) * stepPx - 2
                )}px; height:${rowPx - 8}px;`}
                title={`Eliminar ${formatNote(note.pitch)} (${(note.end - note.start) / STEPS_PER_BEAT} beats)`}
                role="button"
                tabindex="0"
                aria-label={`Eliminar ${formatNote(note.pitch)}`}
                on:click|stopPropagation={() => removeNote(note.id)}
                on:keydown|stopPropagation={(event) => handleNoteKey(event, note.id)}
              >
                <span>{formatNote(note.pitch)}</span>
              </div>
            {/each}
          </div>
        {/each}
      </div>
    </div>
  </div>
  <p class="hint">
    Click para añadir/quitar notas. Usa los controles superiores para definir longitud y velocidad de las nuevas notas.
    El grid es cuantizado a {STEPS_PER_BEAT} pasos por beat (16 pasos por compás).
  </p>
</div>

<style>
  .panel {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }
  .controls {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 0.6rem;
    align-items: center;
  }
  .controls label {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    font-size: 0.9rem;
    opacity: 0.9;
  }
  .controls input[type='range'] {
    width: 100%;
  }
  .controls span {
    opacity: 0.7;
    font-size: 0.85rem;
  }
  .controls button {
    align-self: flex-start;
    padding: 0.5rem 1rem;
    border-radius: 10px;
    border: 1px solid #333;
    background: #1f1f1f;
    color: #fff;
    cursor: pointer;
  }
  .controls__actions {
    display: flex;
    gap: 0.4rem;
    flex-wrap: wrap;
    align-items: center;
  }
  .btn {
    padding: 0.5rem 0.9rem;
    border-radius: 10px;
    border: 1px solid #333;
    background: #1f1f1f;
    color: #fff;
    cursor: pointer;
  }
  .btn--primary {
    background: linear-gradient(135deg, #2c7efc, #22d3ee);
    border: 0;
    color: #0b0b0b;
  }
  .roll {
    display: grid;
    grid-template-columns: 80px 1fr;
    gap: 0.4rem;
  }
  .piano {
    display: flex;
    flex-direction: column;
  }
  .key {
    height: var(--row);
    display: flex;
    align-items: center;
    justify-content: flex-end;
    padding: 0 0.5rem;
    background: #0f0f0f;
    border-bottom: 1px solid #1b1b1b;
    font-size: 0.85rem;
    opacity: 0.8;
  }
  .grid-shell {
    position: relative;
    overflow: auto;
    border: 1px solid #2a2a2a;
    border-radius: 10px;
    background: #0e0e0f;
  }
  .grid {
    position: relative;
    display: flex;
    flex-direction: column;
    background-image:
      linear-gradient(to right, rgba(255, 255, 255, 0.02) 1px, transparent 1px),
      linear-gradient(to right, rgba(255, 255, 255, 0.04) 1px, transparent 1px),
      linear-gradient(to right, rgba(255, 255, 255, 0.08) 1px, transparent 1px);
    background-size: var(--step) 100%, var(--beat) 100%, var(--bar) 100%;
  }
  .playhead {
    position: absolute;
    top: 0;
    width: 2px;
    background: linear-gradient(to bottom, #22d3ee, #8b5cf6);
    opacity: 0.95;
    pointer-events: none;
    box-shadow: 0 0 8px rgba(34, 211, 238, 0.7);
    z-index: 5;
  }
  .row {
    position: relative;
    border-bottom: 1px solid #131313;
    background: rgba(255, 255, 255, 0.01);
  }
  .row--black {
    background: rgba(255, 255, 255, 0.02);
  }
  .row:hover {
    background: rgba(255, 255, 255, 0.04);
  }
  .note {
    position: absolute;
    top: 4px;
    background: linear-gradient(135deg, #2c7efc, #8b5cf6);
    color: #fff;
    border-radius: 6px;
    padding: 0 0.4rem;
    display: flex;
    align-items: center;
    height: calc(var(--row) - 8px);
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.35);
    cursor: pointer;
    border: 1px solid rgba(255, 255, 255, 0.1);
    font-size: 0.8rem;
    white-space: nowrap;
  }
  .note:hover {
    filter: brightness(1.08);
  }
  .hint {
    margin: 0;
    opacity: 0.7;
    font-size: 0.9rem;
  }
</style>
