<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import {
    phrasePacks,
    initPhrasePackStore,
    saveNewPack,
    addPhraseToPack,
    getPhrase,
    deletePack,
    type Phrase,
    type PhraseEvent,
    type PhrasePack
  } from '$lib/storage/phrasePacks';
  import { parseSMF, type SMFMetadata } from '$lib/midi/smf';
  import { FluidSynthEngine, type FluidSynthStatus } from '$lib/audio/fluidSynthEngine';
  import {
    builtinPhrases,
    getBuiltinPhraseByKey,
    type PhraseCategory
  } from '$lib/sequencer/builtinPhrases';
  import {
    phraseToQuantizedSequence,
    quantizedSequenceToPhrase,
    type QuantizedNoteSequence
  } from '$lib/ai/noteSequenceAdapters';
  import PianoRoll from '$lib/components/PianoRoll.svelte';
  import { exportSMF } from '$lib/midi/exportSMF';

  type EngineMode = 'basic' | 'fluid';
  type PlaySource = 'arrangement' | 'phrase';
  type PhraseKey = string | null;

  const SLOT_COUNT = 8;
  const SLOT_BEATS = 16; // 4 compases de 4 beats por frase
  const slotIndices = Array.from({ length: SLOT_COUNT }, (_, idx) => idx);

  type TrackLane = {
    id: string;
    name: string;
    color: string;
    category: PhraseCategory | 'any';
    slots: PhraseKey[];
  };

  type PhraseOptionEntry = {
    key: string;
    label: string;
    category: PhraseCategory | 'any';
    source: 'builtin' | 'pack';
  };

  const builtinOptionEntries: PhraseOptionEntry[] = builtinPhrases
    .map((entry) => ({
      key: entry.key,
      label: entry.name,
      category: entry.category,
      source: 'builtin'
    }))
    .sort((a, b) => a.label.localeCompare(b.label, 'es', { sensitivity: 'base' }));

  let ac: AudioContext;
  let worklet: AudioWorkletNode;
  let fluidEngine: FluidSynthEngine | null = null;

  let engineMode: EngineMode = 'fluid';
  let playSource: PlaySource = 'arrangement';

  let fluidStatus: FluidSynthStatus = {
    ready: false,
    soundFontLoaded: false,
    soundFontName: undefined,
    lastError: null
  };
  let triedAutoLoadDefaultSf = false;
  let fluidError: string | null = null;
  let soundFontLoading = false;
  let lastSoundFontName = '';
  const defaultSoundFontPath = '/fluidsynth/GeneralUser-GS.sf2';

  let bpm = 120;
  let isPlaying = false;
  let loopMode = false;
  let semitoneOffset = 0;

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
  let rollBars = clampRollBars(Math.ceil(estimatePhraseDurationBeats(currentPhrase) / 4));

  let trackLanes: TrackLane[] = createInitialArrangement();
  let arrangementEvents: PhraseEvent[] = [];
  let arrangementActiveBars = 0;

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

  type AiProgressStage = 'idle' | 'downloading' | 'ready';
  type AiWorkerResponse =
    | { type: 'progress'; stage: 'downloading'; loaded: number; total: number }
    | { type: 'model-loaded'; bytes: number; fromCache: boolean }
    | { type: 'generated'; sequence: QuantizedNoteSequence }
    | { type: 'cancelled' }
    | { type: 'error'; message: string };

  let aiWorker: Worker | null = null;
  let aiModalOpen = false;
  let aiBusy = false;
  let aiError: string | null = null;
  let aiProgressStage: AiProgressStage = 'idle';
  let aiBytesLoaded = 0;
  let aiBytesTotal = 0;
  let aiProgressPercent = 0;
  let aiReadyForMode: AiMode | null = null;
  let pianoRollOpen = false;
  type AiMode = 'melody' | 'drums';
  type AiModelOption = {
    mode: AiMode;
    label: string;
    modelName: string;
    baseUrl: string;
    downloadUrl: string;
    modelType: 'vae' | 'rnn';
    sizeMb: number;
    disabled?: boolean;
    helper?: string;
  };

  const aiModels: AiModelOption[] = [
    {
      mode: 'melody',
      label: 'Melodía (MusicVAE 16 compases)',
      modelName: 'MusicVAE mel_16bar_small_q2',
      baseUrl: 'https://storage.googleapis.com/magentadata/js/checkpoints/music_vae/mel_16bar_small_q2',
      downloadUrl:
        'https://storage.googleapis.com/magentadata/js/checkpoints/music_vae/mel_16bar_small_q2/config.json',
      modelType: 'vae',
      sizeMb: 31
    },
    {
      mode: 'drums',
      label: 'Batería (DrumRNN)',
      modelName: 'Drums kit RNN',
      baseUrl: 'https://storage.googleapis.com/magentadata/js/checkpoints/music_rnn/drum_kit_rnn',
      downloadUrl:
        'https://storage.googleapis.com/magentadata/js/checkpoints/music_rnn/drum_kit_rnn/config.json',
      modelType: 'rnn',
      sizeMb: 11,
      helper: 'Genera baterías de 1-2 compases.'
    }
  ];

  let aiMode: AiMode = 'melody';
  let currentAiModel: AiModelOption = aiModels[0];

  let packList: PhrasePack[] = [];
  let packOptionEntries: PhraseOptionEntry[] = [];

  let packsCount = 0;
  let currentPhraseLabel = currentPhrase.name;
  let currentOptionLabel = `${currentPhraseLabel} (en edición)`;
  let currentSoundFontLabel = 'Sin SoundFont cargado';
  let hasEvents = clip.length > 0;
  let isPlayDisabled = false;

  let activeSlotIndex: number | null = null;
  let visualRafHandle: number | null = null;
  let visualStartTime = 0;
  let visualTotalBeats = 0;
  let slotDurations: number[] = Array(SLOT_COUNT).fill(0);
  let slotOffsets: number[] = Array(SLOT_COUNT).fill(0);
  let arrangementTotalBeats = 0;
  let previewLaneId: string | null = null;
  let previewSlotIndex: number | null = null;
  let previewTimer: ReturnType<typeof setTimeout> | null = null;
  let playStopTimer: ReturnType<typeof setTimeout> | null = null;
  let playheadBeat = 0;
  let playheadTotalBeats = 0;

  $: packList = $phrasePacks;
  $: packsCount = packList.length;
  $: currentPhraseLabel = currentPhrase?.name ?? 'Clip actual';
  $: currentOptionLabel = `${currentPhraseLabel} (en edición)`;
  $: if (storageReady && !appendPackId && packsCount > 0) {
    appendPackId = packList[0].id;
  }
  $: packOptionEntries = packList
    .flatMap((pack) =>
      pack.phrases.map((phrase) => ({
        key: `pack:${pack.id}:${phrase.id}`,
        label: `${pack.name} · ${phrase.name}`,
        category: 'any',
        source: 'pack'
      }))
    )
    .sort((a, b) => a.label.localeCompare(b.label, 'es', { sensitivity: 'base' }));
  $: slotDurations = computeSlotDurations(trackLanes, currentPhrase, packList);
  $: slotOffsets = computeSlotOffsets(slotDurations);
  $: arrangementTotalBeats = slotDurations.reduce((sum, len) => sum + len, 0);
  $: arrangementEvents = buildArrangementEvents(trackLanes, currentPhrase, packList, slotOffsets);
  $: arrangementActiveBars = computeActiveBars(trackLanes);
  $: hasEvents = playSource === 'arrangement' ? arrangementEvents.length > 0 : clip.length > 0;
  $: isPlayDisabled =
    !hasEvents ||
    (engineMode === 'fluid' && (!fluidStatus.ready || !fluidStatus.soundFontLoaded || soundFontLoading));
  $: currentSoundFontLabel = fluidStatus.soundFontLoaded
    ? fluidStatus.soundFontName ?? lastSoundFontName ?? 'SoundFont cargado'
    : 'Sin SoundFont cargado';
  $: aiProgressPercent =
    aiBytesTotal > 0 ? Math.min(100, Math.round((aiBytesLoaded / aiBytesTotal) * 100)) : 0;
  $: currentAiModel = aiModels.find((item) => item.mode === aiMode) ?? aiModels[0];
  $: if (!aiBusy && aiReadyForMode === aiMode && aiProgressStage !== 'ready') {
    aiProgressStage = 'ready';
    if (!aiBytesLoaded) {
      aiBytesLoaded = currentAiModel.sizeMb * 1_000_000;
      aiBytesTotal = aiBytesLoaded;
    }
  }
  $: if (aiReadyForMode && aiReadyForMode !== aiMode && aiProgressStage === 'ready') {
    aiProgressStage = 'idle';
    aiBytesLoaded = 0;
    aiBytesTotal = 0;
    aiReadyForMode = null;
  }

  function createInitialArrangement(): TrackLane[] {
    return [
      {
        id: 'track-perc',
        name: 'Percusión',
        color: '#f97316',
        category: 'perc',
        slots: createSlotsFromPattern(['builtin:perc-classic'])
      },
      {
        id: 'track-bass',
        name: 'Bajo',
        color: '#22d3ee',
        category: 'bass',
        slots: createSlotsFromPattern(['builtin:bass-pulse', 'builtin:bass-syncopated'])
      },
      {
        id: 'track-chords',
        name: 'Acordes',
        color: '#a855f7',
        category: 'chords',
        slots: createSlotsFromPattern(['builtin:chords-blocks', 'builtin:chords-rhythm'])
      },
      {
        id: 'track-lead',
        name: 'Lead',
        color: '#f472b6',
        category: 'melody',
        slots: createSlotsFromPattern([
          'builtin:lead-arp',
          'builtin:lead-counter',
          null,
          'builtin:lead-arp'
        ])
      }
    ];
  }

  function createSlotsFromPattern(pattern: (string | null)[]) {
    return Array.from({ length: SLOT_COUNT }, (_, idx) => pattern[idx % pattern.length] ?? null);
  }

  function cloneEvents(events: PhraseEvent[]) {
    return events.map((ev) => ({ ...ev }));
  }

  function clampRollBars(value: number) {
    if (!Number.isFinite(value)) return 4;
    return Math.min(8, Math.max(1, Math.round(value)));
  }

  function syncRollBarsToEvents(events: PhraseEvent[]) {
    const beats = estimatePhraseDurationBeats({
      id: 'tmp',
      name: 'tmp',
      bpm,
      events
    });
    rollBars = clampRollBars(Math.ceil(beats / 4));
  }

  function applyPhrase(phrase: Phrase) {
    const phraseBpm = phrase.bpm ?? bpm;
    currentPhrase = {
      ...phrase,
      bpm: phraseBpm,
      events: cloneEvents(phrase.events)
    };
    clip = currentPhrase.events;
    bpm = phraseBpm;
    newPhraseName = currentPhrase.name;
    syncRollBarsToEvents(clip);
  }

  function openPianoRoll() {
    pianoRollOpen = true;
  }

  function closePianoRoll() {
    pianoRollOpen = false;
  }

  function snapshotCurrentPhrase(nameOverride?: string): Phrase {
    return {
      id: crypto.randomUUID(),
      name: nameOverride?.trim() || currentPhraseLabel,
      bpm,
      events: cloneEvents(clip)
    };
  }

  function computeActiveBars(lanes: TrackLane[]) {
    const active = new Set<number>();
    for (const lane of lanes) {
      lane.slots.forEach((slot, idx) => {
        if (slot) active.add(idx);
      });
    }
    return active.size;
  }

  function resolvePhraseByKey(
    key: string | null,
    current: Phrase,
    packs: PhrasePack[]
  ): Phrase | null {
    if (!key) return null;
    if (key === 'current') return current;
    if (key.startsWith('builtin:')) {
      const entry = getBuiltinPhraseByKey(key.replace('builtin:', ''));
      return entry ? entry.phrase : null;
    }
    if (key.startsWith('pack:')) {
      const [, packId, phraseId] = key.split(':');
      const pack = packs.find((p) => p.id === packId);
      const phrase = pack?.phrases.find((p) => p.id === phraseId);
      return phrase ?? null;
    }
    return null;
  }

  function getPhraseLabel(
    key: string | null,
    currentLabel: string,
    packs: PhrasePack[]
  ): string {
    if (!key) return '— Vacío —';
    if (key === 'current') return `${currentLabel} (actual)`;
    if (key.startsWith('builtin:')) {
      return getBuiltinPhraseByKey(key.replace('builtin:', ''))?.name ?? 'Frase base';
    }
    if (key.startsWith('pack:')) {
      const [, packId, phraseId] = key.split(':');
      const pack = packs.find((p) => p.id === packId);
      const phrase = pack?.phrases.find((p) => p.id === phraseId);
      if (pack && phrase) return `${pack.name} · ${phrase.name}`;
      return 'Frase de pack';
    }
    return 'Frase';
  }

  function estimatePhraseDurationBeats(phrase: Phrase | null): number {
    if (!phrase || !phrase.events.length) return 0;
    let minBeat = Number.POSITIVE_INFINITY;
    let maxBeat = Number.NEGATIVE_INFINITY;
    for (const ev of phrase.events) {
      if (Number.isFinite(ev.beat)) {
        if (ev.beat < minBeat) minBeat = ev.beat;
        if (ev.beat > maxBeat) maxBeat = ev.beat;
      }
    }
    if (!Number.isFinite(maxBeat)) return 0;
    if (!Number.isFinite(minBeat)) minBeat = 0;
    const span = maxBeat - Math.min(minBeat, 0);
    const padding = 0.5; // pequeño margen para dejar respirar el loop
    return Math.max(span + padding, 1);
  }

  function computeSlotDurations(
    lanes: TrackLane[],
    current: Phrase,
    packs: PhrasePack[]
  ): number[] {
    return slotIndices.map((slotIndex) => {
      let hasPhrase = false;
      for (const lane of lanes) {
        const phrase = resolvePhraseByKey(lane.slots[slotIndex], current, packs);
        if (phrase) {
          hasPhrase = true;
          break;
        }
      }
      return hasPhrase ? SLOT_BEATS : 0;
    });
  }

  function computeSlotOffsets(durations: number[]): number[] {
    const offsets: number[] = [];
    let sum = 0;
    for (let i = 0; i < durations.length; i++) {
      offsets.push(sum);
      sum += durations[i];
    }
    return offsets;
  }

  function slicePhraseEvents(
    events: PhraseEvent[],
    bpmValue: number,
    baseName: string,
    chunkBeats = SLOT_BEATS
  ): Phrase[] {
    if (!events.length) return [];
    const maxBeat = events.reduce((max, ev) => Math.max(max, ev.beat), 0);
    const totalBeats = Math.max(chunkBeats, maxBeat);
    const phrases: Phrase[] = [];
    for (let start = 0, idx = 0; start <= totalBeats; start += chunkBeats, idx++) {
      const end = start + chunkBeats;
      const sliceEvents = events
        .filter((ev) => ev.beat >= start && ev.beat < end)
        .map((ev) => ({ ...ev, beat: ev.beat - start }));
      if (!sliceEvents.length) continue;
      phrases.push({
        id: crypto.randomUUID(),
        name: `${baseName} #${idx + 1}`,
        bpm: bpmValue,
        events: sliceEvents
      });
    }
    return phrases;
  }

  function optionAllowedForLane(option: PhraseOptionEntry, lane: TrackLane) {
    if (lane.category === 'any') return true;
    if (option.category === 'any') return true;
    return option.category === lane.category;
  }

  function startVisualTracking(source: PlaySource, startTime: number) {
    stopVisualTracking();
    clearPlayStopTimer();
    if (!ac) return;
    visualStartTime = startTime;
    const secPerBeat = 60 / bpm;
    const eventsSource = source === 'arrangement' ? arrangementEvents : clip;
    const lastBeat = eventsSource.reduce((max, ev) => Math.max(max, ev.beat), 0);
    const rawBeats =
      source === 'arrangement' ? arrangementTotalBeats : estimatePhraseDurationBeats(currentPhrase);
    const totalBeats = Math.max(rawBeats || 0, lastBeat + 1, 4);
    visualTotalBeats = totalBeats;
    playheadTotalBeats = totalBeats;
    playheadBeat = 0;
    if (totalBeats <= 0) return;
    schedulePlayStop(totalBeats);

    const tick = () => {
      if (!ac) {
        stopVisualTracking();
        return;
      }
      const now = ac.currentTime;
      const elapsedSeconds = now - visualStartTime;
      if (elapsedSeconds < 0) {
        activeSlotIndex = null;
        playheadBeat = 0;
      } else {
        const elapsedBeats = elapsedSeconds / secPerBeat;
        playheadBeat = Math.min(elapsedBeats, visualTotalBeats);
        if (elapsedBeats >= visualTotalBeats) {
          activeSlotIndex = null;
          playheadBeat = visualTotalBeats;
          isPlaying = false;
          clearPlayStopTimer();
          stopVisualTracking({ keepPlayhead: true });
          if (loopMode) {
            play();
          }
          return;
        }
        if (source === 'arrangement') {
          let foundIndex: number | null = null;
          for (let i = 0; i < slotOffsets.length; i++) {
            const startBeat = slotOffsets[i];
            const duration = slotDurations[i] ?? 0;
            const endBeat = startBeat + duration;
            if (duration <= 0) {
              continue;
            }
            if (elapsedBeats >= startBeat && elapsedBeats < endBeat) {
              foundIndex = i;
              break;
            }
            if (elapsedBeats < startBeat && foundIndex === null) {
              foundIndex = i;
              break;
            }
          }
          activeSlotIndex = foundIndex;
        }
      }
      visualRafHandle = requestAnimationFrame(tick);
    };

    visualRafHandle = requestAnimationFrame(tick);
  }

  function stopVisualTracking(options: { keepPlayhead?: boolean } = {}) {
    const { keepPlayhead = false } = options;
    if (visualRafHandle !== null) {
      cancelAnimationFrame(visualRafHandle);
      visualRafHandle = null;
    }
    activeSlotIndex = null;
    if (!keepPlayhead) {
      visualTotalBeats = 0;
      playheadTotalBeats = 0;
      playheadBeat = 0;
    }
  }

  function clearPlayStopTimer() {
    if (playStopTimer) {
      clearTimeout(playStopTimer);
      playStopTimer = null;
    }
  }

  function schedulePlayStop(totalBeats: number) {
    clearPlayStopTimer();
    if (!Number.isFinite(totalBeats) || totalBeats <= 0) return;
    const durationMs = (totalBeats * 60_000) / bpm + 200;
    playStopTimer = setTimeout(() => {
      stop({ keepPlayhead: true });
    }, durationMs);
  }

  function clearPreviewState() {
    if (previewTimer) {
      clearTimeout(previewTimer);
      previewTimer = null;
    }
    previewLaneId = null;
    previewSlotIndex = null;
  }

  function transposeEvent(ev: PhraseEvent, semitones: number): PhraseEvent {
    if (semitones === 0) return ev;
    // Canal 9 = percusión: no se transpone
    if ((ev.channel ?? 0) === 9) return ev;
    const note = Math.max(0, Math.min(127, ev.note + semitones));
    return { ...ev, note };
  }

  function buildArrangementEvents(
    lanes: TrackLane[],
    current: Phrase,
    packs: PhrasePack[],
    offsets: number[]
  ): PhraseEvent[] {
    const channelForLane = (lane: TrackLane) => (lane.category === 'perc' ? 9 : 0);
    const events: PhraseEvent[] = [];
    lanes.forEach((lane) => {
      lane.slots.forEach((key, slotIndex) => {
        const phrase = resolvePhraseByKey(key, current, packs);
        if (!phrase || !phrase.events.length) return;
        const offset = offsets[slotIndex] ?? 0;
        phrase.events.forEach((ev) => {
          const withCh: PhraseEvent = {
            type: ev.type,
            note: ev.note,
            velocity: ev.velocity,
            beat: ev.beat + offset,
            channel: ev.channel ?? channelForLane(lane)
          };
          events.push(transposeEvent(withCh, semitoneOffset));
        });
      });
    });
    events.sort((a, b) => {
      if (a.beat === b.beat) {
        if (a.type === b.type) return a.note - b.note;
        return a.type === 'noteoff' ? 1 : -1;
      }
      return a.beat - b.beat;
    });
    return events;
  }

  function updateTrackSlot(trackId: string, slotIndex: number, value: PhraseKey) {
    trackLanes = trackLanes.map((lane) => {
      if (lane.id !== trackId) return lane;
      const slots = lane.slots.map((slot, idx) => (idx === slotIndex ? value : slot));
      return { ...lane, slots };
    });
  }

  function clearTrack(trackId: string) {
    trackLanes = trackLanes.map((lane) =>
      lane.id === trackId ? { ...lane, slots: Array(SLOT_COUNT).fill(null) } : lane
    );
  }

  function setCurrentPhraseFromSlot(trackId: string, slotIndex: number) {
    const lane = trackLanes.find((item) => item.id === trackId);
    if (!lane) return false;
    const key = lane.slots[slotIndex];
    const phrase = resolvePhraseByKey(key, currentPhrase, packList);
    if (!phrase) return false;
    const phraseBpm = phrase.bpm ?? bpm;
    const channel = lane.category === 'perc' ? 9 : 0;
    applyPhrase({
      ...phrase,
      id: crypto.randomUUID(),
      bpm: phraseBpm,
      events: cloneEvents(phrase.events).map((ev) => ({
        ...ev,
        channel: ev.channel ?? channel
      }))
    });
    midiMetadata = null;
    midiFileName = '';
    return true;
  }

  function editSlotInPianoRoll(trackId: string, slotIndex: number) {
    const applied = setCurrentPhraseFromSlot(trackId, slotIndex);
    if (applied) {
      // Mientras se edita, la celda apunta al clip actual para que los cambios permanezcan.
      updateTrackSlot(trackId, slotIndex, 'current');
      playSource = 'phrase';
      pianoRollOpen = true;
    }
  }

  async function ensureFluidEngine() {
    if (!browser) throw new Error('FluidSynth solo está disponible en el navegador.');
    if (!ac) {
      ac = new AudioContext({ latencyHint: 'interactive' });
    }
    if (!fluidEngine) {
      fluidEngine = new FluidSynthEngine(ac);
    }
    try {
      await fluidEngine.ensureInitialized();
      fluidStatus = fluidEngine.getStatus();
      fluidError = fluidStatus.lastError ?? null;
      if (!fluidStatus.soundFontLoaded && !triedAutoLoadDefaultSf) {
        triedAutoLoadDefaultSf = true;
        try {
          await fluidEngine.loadSoundFontFromUrl(defaultSoundFontPath, 'GeneralUser-GS.sf2');
          fluidStatus = fluidEngine.getStatus();
          fluidError = fluidStatus.lastError ?? null;
          lastSoundFontName =
            fluidEngine.getSoundFontName() ?? fluidStatus.soundFontName ?? 'GeneralUser-GS.sf2';
        } catch (err) {
          fluidStatus = fluidEngine.getStatus();
          fluidError =
            (err as Error).message ??
            fluidStatus.lastError ??
            'No se pudo cargar automáticamente el SoundFont predeterminado.';
        }
      }
      if (fluidStatus.soundFontLoaded) {
        lastSoundFontName =
          fluidEngine.getSoundFontName() ?? fluidStatus.soundFontName ?? lastSoundFontName;
      }
    } catch (err) {
      fluidStatus = fluidEngine.getStatus();
      fluidError =
        (err as Error).message ?? fluidStatus.lastError ?? 'No fue posible inicializar FluidSynth.';
      throw err;
    }
  }

  async function changeEngineMode(mode: EngineMode) {
    if (engineMode === mode) return;
    await stop();
    const previous = engineMode;
    if (mode === 'fluid') {
      try {
        await ensureFluidEngine();
        engineMode = mode;
      } catch {
        engineMode = previous;
        return;
      }
    } else {
      engineMode = mode;
      fluidError = null;
    }
  }

  async function handleEngineModeChange(event: Event) {
    const select = event.currentTarget as HTMLSelectElement;
    const mode = (select.value as EngineMode) ?? 'basic';
    await changeEngineMode(mode);
  }

  async function handlePlaySourceChange(event: Event) {
    const select = event.currentTarget as HTMLSelectElement;
    const next = (select.value as PlaySource) ?? 'arrangement';
    if (playSource === next) return;
    playSource = next;
    if (isPlaying) {
      await stop();
    }
  }

  async function setup() {
    if (!browser) return;
    if (!ac) {
      ac = new AudioContext({ latencyHint: 'interactive' });
    }
    if (engineMode === 'fluid') {
      await ensureFluidEngine();
      return;
    }
    if (!worklet) {
      await ac.audioWorklet.addModule('/engine.worklet.js');
      worklet = new AudioWorkletNode(ac, 'doremix-synth');
      worklet.connect(ac.destination);
    }
  }

  function scheduleEvents(eventsSource: PhraseEvent[], bpmValue = bpm): number | null {
    if (!ac || !worklet || !eventsSource.length) return null;
    const secPerBeat = 60 / bpmValue;
    const start = ac.currentTime + 0.1;
    const events = eventsSource.map((ev) => {
      const transposed = transposeEvent(ev, semitoneOffset);
      return {
        t: start + transposed.beat * secPerBeat,
        type: transposed.type,
        note: transposed.note,
        velocity: transposed.velocity ?? 0
      };
    });
    worklet.port.postMessage({ type: 'schedule', events });
    return start;
  }

  async function play() {
    await stop();
    await setup();
    if (!ac) return;
    await ac.resume();
    const sourceEvents = playSource === 'arrangement' ? arrangementEvents : clip;
    if (!sourceEvents.length) return;
    if (engineMode === 'fluid') {
      if (!fluidEngine) {
        fluidError = 'FluidSynth no está inicializado.';
        return;
      }
      if (!fluidStatus.soundFontLoaded) {
        fluidError = 'Carga un SoundFont GM (.sf2) antes de reproducir.';
        return;
      }
      try {
        const start = await fluidEngine.playClip(sourceEvents, bpm);
        startVisualTracking(playSource, start);
        fluidStatus = fluidEngine.getStatus();
        fluidError = fluidStatus.lastError ?? null;
        isPlaying = true;
      } catch (err) {
        fluidError =
          (err as Error).message ??
          fluidEngine.getStatus().lastError ??
          'Error al reproducir con FluidSynth.';
      }
      return;
    }
    const start = scheduleEvents(sourceEvents);
    if (start !== null) {
      startVisualTracking(playSource, start);
      isPlaying = true;
    }
  }

  async function stop(options: { keepPlayhead?: boolean } = {}) {
    const keepPlayhead = options.keepPlayhead ?? false;
    clearPlayStopTimer();
    stopVisualTracking({ keepPlayhead });
    clearPreviewState();
    if (!ac) return;
    if (engineMode === 'fluid') {
      if (fluidEngine) {
        await fluidEngine.stop();
      }
      isPlaying = false;
      return;
    }
    if (!worklet) {
      isPlaying = false;
      return;
    }
    worklet.port.postMessage({ type: 'allnotesoff' });
    isPlaying = false;
  }

  async function previewTrackSlot(laneId: string, slotIndex: number) {
    const lane = trackLanes.find((item) => item.id === laneId);
    if (!lane) return;
    const key = lane.slots[slotIndex];
    const phrase = resolvePhraseByKey(key, currentPhrase, packList);
    if (!phrase || !phrase.events.length) return;
    const phraseBpm = phrase.bpm ?? bpm;
    const channel = lane.category === 'perc' ? 9 : 0;
    const events = cloneEvents(phrase.events).map((ev) => ({
      ...ev,
      channel: ev.channel ?? channel
    }));
    const durationBeats = estimatePhraseDurationBeats(phrase);
    const durationMs = durationBeats > 0 ? (durationBeats * 60_000) / phraseBpm : 0;

    await stop();
    await setup();
    if (!ac) return;
    await ac.resume();

    clearPreviewState();
    previewLaneId = laneId;
    previewSlotIndex = slotIndex;

    try {
      if (engineMode === 'fluid') {
        if (!fluidEngine) {
          fluidError = 'FluidSynth no está inicializado.';
          return;
        }
        await fluidEngine.playClip(events, phraseBpm);
        fluidStatus = fluidEngine.getStatus();
        fluidError = fluidStatus.lastError ?? null;
      } else {
        const start = scheduleEvents(events, phraseBpm);
        if (start === null) {
          previewLaneId = null;
          previewSlotIndex = null;
          isPlaying = false;
          return;
        }
      }
      isPlaying = true;
      const timeoutMs = Math.max(durationMs + 200, 600);
      previewTimer = setTimeout(() => {
        if (previewLaneId === laneId && previewSlotIndex === slotIndex) {
          previewLaneId = null;
          previewSlotIndex = null;
          isPlaying = false;
        }
        previewTimer = null;
      }, timeoutMs);
    } catch (err) {
      previewLaneId = null;
      previewSlotIndex = null;
      isPlaying = false;
      fluidError =
        (err as Error).message ??
        fluidEngine?.getStatus().lastError ??
        'Error al previsualizar la frase.';
    }
  }

  async function handleSoundFontSelect(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input?.files?.[0];
    if (!file) return;
    try {
      await ensureFluidEngine();
    } catch {
      input.value = '';
      return;
    }
    if (!fluidEngine) return;
    soundFontLoading = true;
    fluidError = null;
    try {
      await fluidEngine.loadSoundFontFromFile(file);
      fluidStatus = fluidEngine.getStatus();
      fluidError = fluidStatus.lastError ?? null;
      lastSoundFontName = fluidEngine.getSoundFontName() ?? file.name;
    } catch (err) {
      fluidStatus = fluidEngine.getStatus();
      fluidError =
        (err as Error).message ??
        fluidStatus.lastError ??
        'No fue posible cargar el SoundFont.';
    } finally {
      soundFontLoading = false;
      input.value = '';
    }
  }

  async function handleLoadDefaultSoundFont() {
    try {
      await ensureFluidEngine();
    } catch {
      return;
    }
    if (!fluidEngine) return;
    soundFontLoading = true;
    fluidError = null;
    try {
      await fluidEngine.loadSoundFontFromUrl(defaultSoundFontPath, 'GeneralUser-GS.sf2');
      fluidStatus = fluidEngine.getStatus();
      fluidError = fluidStatus.lastError ?? null;
      lastSoundFontName =
        fluidEngine.getSoundFontName() ??
        fluidStatus.soundFontName ??
        'GeneralUser-GS.sf2';
    } catch (err) {
      fluidStatus = fluidEngine.getStatus();
      fluidError =
        (err as Error).message ??
        fluidStatus.lastError ??
        'No se pudo cargar el SoundFont predeterminado.';
    } finally {
      soundFontLoading = false;
    }
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
      applyPhrase({ ...phrase });
      newPhraseName = phrase.name;
      if (isPlaying) {
        await stop();
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
      applyPhrase({
        id: crypto.randomUUID(),
        name: phraseName,
        bpm: phraseBpm,
        events
      });
      newPhraseName = phraseName;
      // Genera un pack automático de frases de 4 compases si hay material suficiente.
      try {
        await initPhrasePackStore();
        const slices = slicePhraseEvents(events, phraseBpm, phraseName, SLOT_BEATS);
        const percEvents = events.filter((ev) => (ev.channel ?? 0) === 9);
        const percSlices =
          percEvents.length > 0
            ? slicePhraseEvents(percEvents, phraseBpm, `${phraseName} Perc`, SLOT_BEATS)
            : [];
        const allSlices = [...slices, ...percSlices];
        if (allSlices.length > 1) {
          const pack = await saveNewPack({
            name: `${phraseName} (slices 4 compases)`,
            phrases: allSlices
          });
          appendPackId = pack.id;
        }
      } catch (err) {
        console.warn('[MIDI] No se pudo generar el pack auto', err);
      }
      if (isPlaying) {
        await stop();
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

  async function handlePianoRollChange(event: CustomEvent<{ events: PhraseEvent[] }>) {
    const nextEvents = cloneEvents(event.detail.events ?? []);
    applyPhrase({
      ...currentPhrase,
      events: nextEvents
    });
    midiMetadata = null;
    midiFileName = '';
    if (isPlaying) {
      await stop();
    }
  }

  async function ensureAiWorker() {
    if (aiWorker) return aiWorker;
    const worker = new Worker(new URL('$lib/ai/generatorWorker.ts', import.meta.url), {
      type: 'module'
    });
    worker.onmessage = (event: MessageEvent<AiWorkerResponse>) => {
      const msg = event.data;
      console.debug('[AI main] mensaje recibido del worker', msg);
      if (msg.type === 'progress') {
        aiProgressStage = msg.stage;
        aiBytesLoaded = msg.loaded;
        aiBytesTotal = msg.total;
        return;
      }
      if (msg.type === 'model-loaded') {
        aiProgressStage = 'ready';
        aiBytesLoaded = msg.bytes;
        aiBytesTotal = msg.bytes;
        aiBusy = false;
        aiReadyForMode = aiMode;
        return;
      }
      if (msg.type === 'generated') {
        try {
          const generated = quantizedSequenceToPhrase(msg.sequence, 'Frase IA');
          const events = [...generated.events];
          applyPhrase({ ...generated, events });
          playSource = 'phrase';
          aiModalOpen = false;
          aiError = null;
          console.debug('[AI main] frase IA aplicada', {
            events: events.length,
            bpm: currentPhrase.bpm
          });
          // Auto-preview la frase generada (no bloqueante).
          stop()
            .then(() => play())
            .catch((err) => console.warn('[AI main] no se pudo reproducir automáticamente', err));
        } catch (err) {
          console.error('[AI main] error al convertir secuencia IA', err);
          aiError =
            (err as Error).message ??
            'No fue posible interpretar la secuencia generada por la IA.';
        } finally {
          aiBusy = false;
        }
        return;
      }
      if (msg.type === 'cancelled') {
        aiBusy = false;
        return;
      }
      if (msg.type === 'error') {
        aiError = msg.message;
        aiBusy = false;
        return;
      }
      console.warn('[AI main] mensaje desconocido del worker', msg);
    };
    aiWorker = worker;
    return worker;
  }

  async function openAiModal() {
    aiModalOpen = true;
    aiError = null;
    aiBusy = false;
    // Mantén progreso previo si ya estaba listo para el modo actual; si no, reinicia.
    if (!(aiProgressStage === 'ready' && aiReadyForMode === aiMode)) {
      aiProgressStage = 'idle';
      aiBytesLoaded = 0;
      aiBytesTotal = 0;
    }
    await ensureAiWorker();
  }

  function closeAiModal() {
    aiModalOpen = false;
  }

  async function handleAiDownload() {
    aiError = null;
    aiBusy = true;
    aiProgressStage = 'downloading';
    aiBytesLoaded = 0;
    aiBytesTotal = 0;
    aiReadyForMode = null;
    const worker = await ensureAiWorker();
    worker.postMessage({
      type: 'load-model',
      url: currentAiModel.downloadUrl,
      modelBase: currentAiModel.baseUrl,
      modelType: currentAiModel.modelType
    });
  }

  async function handleAiGenerate() {
    aiError = null;
    aiBusy = true;
    aiProgressStage = 'ready';
    aiBytesLoaded = aiBytesLoaded || 0;
    console.debug('[AI] Generar clicked', {
      aiBusy,
      aiProgressStage,
      aiReadyForMode,
      aiBytesLoaded,
      aiBytesTotal
    });
    const worker = await ensureAiWorker();
    const seed = phraseToQuantizedSequence(currentPhrase);
    worker.postMessage({
      type: 'generate',
      seed,
      mode: aiMode === 'drums' ? 'drum' : 'melody',
      url: currentAiModel.baseUrl,
      modelType: currentAiModel.modelType
    });
    console.debug('[AI] Mensaje de generación enviado al worker', {
      mode: aiMode,
      modelType: currentAiModel.modelType,
      url: currentAiModel.baseUrl
    });
  }

  async function handleAiCancel() {
    const worker = await ensureAiWorker();
    worker.postMessage({ type: 'cancel' });
    aiBusy = false;
  }

  function handleExportSMF() {
    const source = playSource === 'arrangement' ? 'arrangement' : 'phrase';
    if (source === 'arrangement') {
      const trackData = trackLanes.map((lane) => ({
        name: lane.name,
        channel: lane.category === 'perc' ? 9 : 0,
        events: arrangementEvents.filter((ev) => {
          // Filtra eventos por canal de la pista
          const ch = ev.channel ?? 0;
          return lane.category === 'perc' ? ch === 9 : ch !== 9;
        })
      }));
      exportSMF(trackData, bpm, currentPhrase.name || 'doremix-arrangement');
    } else {
      const events = clip.map((ev) => transposeEvent(ev, semitoneOffset));
      exportSMF(
        [{ name: currentPhrase.name, channel: 0, events }],
        bpm,
        currentPhrase.name || 'doremix-phrase'
      );
    }
  }

  async function handleRollPlay() {
    playSource = 'phrase';
    await play();
  }

  async function handleRollStop() {
    await stop();
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

<main class="min-h-screen bg-base-100 text-base-content">
  <div class="max-w-5xl mx-auto px-4 py-8">

    <!-- Header -->
    <header class="mb-8">
      <h1 class="text-4xl font-bold tracking-tight mb-1">DoReMix</h1>
      <p class="text-base-content/50 text-sm">PWA · SvelteKit · AudioWorklet</p>
    </header>

    <!-- Motor de sonido -->
    <section class="card bg-base-200 shadow mb-4">
      <div class="card-body p-5 gap-3">
        <h2 class="text-xs font-semibold uppercase tracking-widest text-base-content/40">Motor de sonido</h2>
        <div class="flex flex-wrap gap-3 items-center">
          <label class="label-text w-20 shrink-0" for="engine-mode">Modo</label>
          <select
            id="engine-mode"
            value={engineMode}
            on:change={handleEngineModeChange}
            class="select select-bordered select-sm bg-base-300 min-w-[200px]"
          >
            <option value="basic">Motor interno (seno simple)</option>
            <option value="fluid">FluidSynth + SoundFont GM</option>
          </select>
          {#if engineMode === 'fluid'}
            <span class="text-base-content/50 text-sm">{currentSoundFontLabel}</span>
          {/if}
        </div>
        {#if engineMode === 'fluid'}
          {#if fluidError}
            <p class="text-error text-sm">{fluidError}</p>
          {/if}
          <div class="flex flex-wrap gap-3 items-center">
            <label class="label-text min-w-[12rem] shrink-0" for="soundfont-file">Cargar SoundFont (.sf2/.sf3)</label>
            <input
              id="soundfont-file"
              type="file"
              accept=".sf2,.sf3"
              on:change={handleSoundFontSelect}
              disabled={soundFontLoading}
              class="file-input file-input-bordered file-input-sm bg-base-300 flex-1 min-w-[200px]"
            />
            <button
              type="button"
              on:click={handleLoadDefaultSoundFont}
              disabled={soundFontLoading}
              class="btn btn-sm btn-neutral"
            >
              {soundFontLoading ? 'Cargando…' : 'Usar /fluidsynth/GeneralUser-GS.sf2'}
            </button>
          </div>
          <p class="text-base-content/40 text-xs">
            Coloca <code class="bg-base-300 px-1 rounded font-mono">libfluidsynth-*.js</code>,
            <code class="bg-base-300 px-1 rounded font-mono">libfluidsynth-*.wasm</code> y un SoundFont GM en
            <code class="bg-base-300 px-1 rounded font-mono">static/fluidsynth/</code>, o carga uno manualmente.
          </p>
        {/if}
      </div>
    </section>

    <!-- Transport -->
    <div class="card bg-base-200 shadow mb-4">
      <div class="card-body p-4 gap-3">
        <div class="flex flex-wrap gap-4 items-center">
          <div class="flex items-center gap-2">
            <label class="label-text text-sm" for="bpm-input">BPM</label>
            <input id="bpm-input" type="number" bind:value={bpm} min="40" max="240"
              class="input input-bordered input-sm bg-base-300 w-20 text-center" />
          </div>
          <div class="flex items-center gap-2">
            <label class="label-text text-sm" for="transpose-input"
              title="Semitonos de transposición (±24). La percusión no se transpone.">Transpose</label>
            <input id="transpose-input" type="number" bind:value={semitoneOffset} min="-24" max="24"
              class="input input-bordered input-sm bg-base-300 w-20 text-center"
              title="Semitonos de transposición (±24). La percusión no se transpone." />
            <span class="badge badge-ghost badge-sm font-mono">
              {semitoneOffset > 0 ? `+${semitoneOffset}` : semitoneOffset} st
            </span>
          </div>
          <div class="flex items-center gap-2">
            <label class="label-text text-sm" for="play-source">Fuente</label>
            <select
              id="play-source"
              value={playSource}
              on:change={handlePlaySourceChange}
              class="select select-bordered select-sm bg-base-300 min-w-[200px]"
            >
              <option value="arrangement">Secuencia (todas las pistas)</option>
              <option value="phrase">Solo frase actual</option>
            </select>
          </div>
        </div>
        <div class="flex flex-wrap gap-2 items-center">
          <button on:click={play} disabled={isPlaying || isPlayDisabled} class="btn btn-primary btn-sm">
            ▶ Play
          </button>
          <button on:click={stop} disabled={!isPlaying} class="btn btn-neutral btn-sm">
            ■ Stop
          </button>
          <button
            type="button"
            on:click={() => (loopMode = !loopMode)}
            title="Repetir en bucle"
            class={loopMode ? 'btn btn-info btn-sm' : 'btn btn-ghost btn-sm border border-base-300'}
          >
            ↺ Loop {loopMode ? 'ON' : 'OFF'}
          </button>
          <button
            type="button"
            on:click={handleExportSMF}
            disabled={!hasEvents}
            title="Exportar como archivo MIDI (.mid)"
            class="btn btn-ghost btn-sm border border-base-300"
          >
            ↓ Exportar MIDI
          </button>
        </div>
        {#if engineMode === 'fluid' && !fluidStatus.soundFontLoaded}
          <p class="text-base-content/40 text-xs -mt-1">Carga un SoundFont para habilitar la reproducción con FluidSynth.</p>
        {/if}
      </div>
    </div>

    <!-- Frase actual -->
    <div class="flex items-center gap-3 mb-4">
      <span class="text-base-content/50 text-sm">
        Frase actual: <span class="text-base-content font-medium">{currentPhraseLabel}</span>
      </span>
      <button type="button" on:click={openPianoRoll} class="btn btn-ghost btn-xs border border-base-300">
        Abrir piano roll
      </button>
    </div>

    <!-- IA opcional -->
    <section class="card bg-base-200 shadow mb-4">
      <div class="card-body p-5 gap-3">
        <h2 class="text-xs font-semibold uppercase tracking-widest text-base-content/40">IA opcional (Magenta.js)</h2>
        <p class="text-base-content/50 text-sm">
          Descarga bajo demanda y se cachea automáticamente tras el primer uso. Pensado para tablets: muestra barra de progreso y no afecta al resto de la app.
        </p>
        <div class="flex flex-wrap gap-3 items-center">
          <label class="label-text text-sm" for="ai-mode">Modo</label>
          <select id="ai-mode" bind:value={aiMode} class="select select-bordered select-sm bg-base-300 min-w-[220px]">
            {#each aiModels as option}
              <option value={option.mode} disabled={option.disabled}>{option.label}</option>
            {/each}
          </select>
          <span class="text-base-content/40 text-xs">Modelo: {currentAiModel.modelName} (~{currentAiModel.sizeMb} MB)</span>
          <button type="button" on:click={openAiModal} class="btn btn-secondary btn-sm">
            Abrir panel IA
          </button>
          <div class={`badge badge-sm ${
            aiProgressStage === 'ready' ? 'badge-success' :
            aiProgressStage === 'downloading' ? 'badge-warning' : 'badge-ghost'
          }`}>
            {aiProgressStage === 'downloading' ? 'Descargando…' : aiProgressStage === 'ready' ? 'Listo' : 'Pendiente'}
          </div>
        </div>
        {#if currentAiModel.helper}
          <p class="text-base-content/30 text-xs">{currentAiModel.helper}</p>
        {/if}
      </div>
    </section>

    <!-- Secuenciador por pistas -->
    <section class="card bg-base-200 shadow mb-4">
      <div class="card-body p-5 gap-3">
        <h2 class="text-xs font-semibold uppercase tracking-widest text-base-content/40">Secuenciador por pistas</h2>
        <p class="text-base-content/40 text-xs">
          Organiza hasta {SLOT_COUNT} frases; cada frase dura 4 compases (16 beats). Frases activas: {arrangementActiveBars}/{SLOT_COUNT}.
        </p>
        <div class="overflow-x-auto">
          <table class="table table-xs w-full min-w-[720px]">
            <thead>
              <tr>
                <th class="text-base-content/50 font-semibold">Pista</th>
                {#each slotIndices as idx}
                  <th class="text-center text-base-content/40 font-medium">Frase {idx + 1}</th>
                {/each}
              </tr>
            </thead>
            <tbody>
              {#each trackLanes as lane}
                <tr>
                  <th class="align-top w-36">
                    <div class="flex items-center gap-2">
                      <span aria-hidden="true" class="w-2.5 h-2.5 rounded-full shrink-0" style="background:{lane.color}"></span>
                      <span class="font-medium text-sm">{lane.name}</span>
                      <button
                        type="button"
                        on:click={() => clearTrack(lane.id)}
                        class="btn btn-ghost btn-xs ml-auto text-base-content/40 hover:text-base-content"
                      >×</button>
                    </div>
                  </th>
                  {#each slotIndices as slotIndex}
                    <td class={`align-top transition-colors duration-200 ${
                      playSource === 'arrangement' && activeSlotIndex === slotIndex
                        ? 'bg-primary/20'
                        : previewLaneId === lane.id && previewSlotIndex === slotIndex
                        ? 'bg-info/15'
                        : ''
                    }`}>
                      <div class="flex flex-col gap-1">
                        <select
                          value={lane.slots[slotIndex] ?? ''}
                          on:change={(event) =>
                            updateTrackSlot(
                              lane.id,
                              slotIndex,
                              (event.currentTarget as HTMLSelectElement).value || null
                            )}
                          class="select select-bordered select-xs bg-base-300 w-full"
                        >
                          <option value="">— Vacío —</option>
                          <optgroup label="Frase actual">
                            <option value="current">{currentOptionLabel}</option>
                          </optgroup>
                          {#if packOptionEntries.length}
                            <optgroup label="Packs guardados">
                              {#each packOptionEntries.filter((option) => optionAllowedForLane(option, lane)) as option}
                                <option value={option.key}>{option.label}</option>
                              {/each}
                            </optgroup>
                          {/if}
                          <optgroup label="Frases base">
                            {#each builtinOptionEntries.filter((option) => optionAllowedForLane(option, lane)) as option}
                              <option value={`builtin:${option.key}`}>{option.label}</option>
                            {/each}
                          </optgroup>
                        </select>
                        <div class="flex justify-between items-center gap-1">
                          <span class="text-base-content/30 text-xs truncate max-w-[80px]">
                            {getPhraseLabel(lane.slots[slotIndex], currentPhraseLabel, packList)}
                          </span>
                          <div class="flex gap-1">
                            <button
                              type="button"
                              on:click={() => previewTrackSlot(lane.id, slotIndex)}
                              disabled={!lane.slots[slotIndex] || isPlaying}
                              title="Previsualizar"
                              class="btn btn-ghost btn-xs">▶</button>
                            <button
                              type="button"
                              on:click={() => editSlotInPianoRoll(lane.id, slotIndex)}
                              disabled={!lane.slots[slotIndex]}
                              class="btn btn-primary btn-xs">Editar</button>
                          </div>
                        </div>
                      </div>
                    </td>
                  {/each}
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <!-- Importar SMF -->
    <section class="card bg-base-200 shadow mb-4">
      <div class="card-body p-5 gap-3">
        <h2 class="text-xs font-semibold uppercase tracking-widest text-base-content/40">Importar SMF (.mid)</h2>
        <p class="text-base-content/50 text-sm">Carga un archivo MIDI estándar para convertirlo en la frase activa.</p>
        <div class="flex flex-wrap gap-3 items-center">
          <label class="label-text shrink-0" for="smf-file">Archivo SMF</label>
          <input
            id="smf-file"
            type="file"
            accept=".mid,.midi"
            on:change={handleMidiFileSelect}
            disabled={midiLoading}
            class="file-input file-input-bordered file-input-sm bg-base-300 flex-1 min-w-[220px]"
          />
          {#if midiLoading}
            <span class="loading loading-spinner loading-sm"></span>
          {:else if midiFileName}
            <span class="text-base-content/40 text-xs">Último: {midiFileName}</span>
          {/if}
        </div>
        {#if midiLoadError}
          <p class="text-error text-sm">{midiLoadError}</p>
        {/if}
        {#if midiMetadata}
          <div class="bg-base-300 rounded-lg p-4">
            <h3 class="text-sm font-semibold mb-2">Metadatos extraídos</h3>
            <ul class="text-sm space-y-1 text-base-content/60 list-disc list-inside">
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
      </div>
    </section>

    <!-- Packs de frases -->
    <section class="card bg-base-200 shadow mb-4">
      <div class="card-body p-5 gap-4">
        <h2 class="text-xs font-semibold uppercase tracking-widest text-base-content/40">Packs de frases (IndexedDB / OPFS)</h2>
        {#if !storageReady}
          <p class="text-base-content/50 text-sm">Inicializando almacenamiento local…</p>
        {:else}
          {#if storageError}
            <p class="text-error text-sm">{storageError}</p>
          {/if}
          <form on:submit|preventDefault={handleSaveNewPack} class="flex flex-wrap gap-2 items-center">
            <span class="label-text text-sm font-medium min-w-[10rem]">Nuevo pack desde el clip</span>
            <input type="text" bind:value={newPackName} placeholder="Nombre del pack"
              class="input input-bordered input-sm bg-base-300 flex-1 min-w-[140px]" />
            <input type="text" bind:value={newPhraseName} placeholder="Nombre de la frase"
              class="input input-bordered input-sm bg-base-300 flex-1 min-w-[140px]" />
            <button type="submit" disabled={savingNewPack} class="btn btn-success btn-sm">
              {savingNewPack ? 'Guardando…' : 'Guardar nuevo pack'}
            </button>
          </form>

          <form on:submit|preventDefault={handleAddPhraseToPack} class="flex flex-wrap gap-2 items-center">
            <span class="label-text text-sm font-medium min-w-[10rem]">Añadir al pack</span>
            <select bind:value={appendPackId} class="select select-bordered select-sm bg-base-300 flex-1 min-w-[160px]">
              <option value="" disabled selected={appendPackId === '' || packsCount === 0}>Selecciona un pack</option>
              {#each $phrasePacks as pack}
                <option value={pack.id}>{pack.name}</option>
              {/each}
            </select>
            <input type="text" bind:value={newPhraseName} placeholder="Nombre de la frase"
              class="input input-bordered input-sm bg-base-300 flex-1 min-w-[140px]" />
            <button type="submit" disabled={!appendPackId || addingPhrase} class="btn btn-warning btn-sm">
              {addingPhrase ? 'Añadiendo…' : 'Añadir frase'}
            </button>
          </form>

          <div>
            <h3 class="text-sm font-semibold mb-2">Mis packs guardados</h3>
            {#if !$phrasePacks.length}
              <p class="text-base-content/40 text-sm">No hay packs guardados todavía. Guarda el clip de ejemplo para crear el primero.</p>
            {:else}
              <ul class="space-y-2">
                {#each $phrasePacks as pack}
                  <li class="bg-base-300 rounded-xl p-3">
                    <div class="flex justify-between items-center gap-2 mb-2">
                      <div>
                        <span class="font-semibold text-sm">{pack.name}</span>
                        <span class="text-base-content/30 text-xs ml-2">{new Date(pack.updatedAt).toLocaleString()}</span>
                      </div>
                      <button
                        type="button"
                        on:click={() => handleDeletePack(pack.id)}
                        disabled={deletingPackId === pack.id}
                        class="btn btn-error btn-xs"
                      >
                        {deletingPackId === pack.id ? 'Eliminando…' : 'Eliminar'}
                      </button>
                    </div>
                    {#if !pack.phrases.length}
                      <p class="text-base-content/30 text-xs">No hay frases en este pack.</p>
                    {:else}
                      <ul class="space-y-1">
                        {#each pack.phrases as phrase}
                          <li class="flex items-center gap-2">
                            <button
                              type="button"
                              on:click={() => loadPhraseFromPack(pack.id, phrase.id)}
                              disabled={loadingPhraseKey === `${pack.id}:${phrase.id}`}
                              class="btn btn-primary btn-xs"
                            >
                              {loadingPhraseKey === `${pack.id}:${phrase.id}` ? 'Cargando…' : 'Cargar'}
                            </button>
                            <span class="text-sm">{phrase.name}</span>
                            {#if phrase.bpm}
                              <span class="badge badge-ghost badge-sm">{phrase.bpm} BPM</span>
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
      </div>
    </section>

    <!-- Qué incluye -->
    <div class="card bg-base-200 shadow">
      <div class="card-body p-5">
        <h2 class="text-xs font-semibold uppercase tracking-widest text-base-content/40">Qué incluye este esqueleto</h2>
        <ul class="text-sm text-base-content/50 space-y-1 list-disc list-inside">
          <li>AudioWorklet con sintetizador simple (seno) y <em>scheduler</em> básico</li>
          <li>VitePWA: manifest &amp; service worker (instalable/offline)</li>
          <li>Página de prueba + controles</li>
        </ul>
      </div>
    </div>

  </div>

  <!-- Modal IA -->
  {#if aiModalOpen}
    <div
      class="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-[1000]"
      on:click|self={closeAiModal}
    >
      <div class="card bg-base-200 border border-base-300 shadow-2xl w-full max-w-lg">
        <div class="card-body gap-4">
          <div class="flex justify-between items-center">
            <h3 class="card-title text-base">Generación IA (Magenta opcional)</h3>
            <button type="button" on:click={closeAiModal} class="btn btn-ghost btn-sm btn-circle text-lg">✕</button>
          </div>
          <p class="text-base-content/60 text-sm">
            Modo actual: {currentAiModel.label}. Descarga el modelo solo cuando lo pidas.
            Necesita conexión para el primer uso; después se cachea automático.
          </p>
          <div class="space-y-2">
            <progress class="progress progress-secondary w-full" value={aiProgressPercent} max="100"></progress>
            <div class="flex justify-between text-xs text-base-content/50">
              <span>
                {aiProgressStage === 'downloading'
                  ? 'Descargando modelo…'
                  : aiProgressStage === 'ready'
                  ? 'Modelo cacheado/listo'
                  : 'Aún no descargado'}
              </span>
              <span>
                {aiBytesTotal
                  ? `${(aiBytesLoaded / 1_000_000).toFixed(1)} / ${(aiBytesTotal / 1_000_000).toFixed(1)} MB`
                  : `~${currentAiModel.sizeMb} MB`}
              </span>
            </div>
            {#if aiError}
              <p class="text-error text-sm">{aiError}</p>
            {/if}
            <p class="text-base-content/30 text-xs">Modelo: {currentAiModel.modelName}</p>
          </div>
          <div class="flex flex-wrap gap-2 items-center">
            <button
              type="button"
              on:click={handleAiDownload}
              disabled={aiBusy || aiProgressStage === 'downloading'}
              class="btn btn-primary btn-sm"
            >
              {aiProgressStage === 'ready' ? 'Reintentar descarga' : aiBusy ? 'Descargando…' : 'Descargar modelo'}
            </button>
            <button type="button" on:click={handleAiGenerate} disabled={aiBusy} class="btn btn-info btn-sm">
              Generar {aiMode === 'drums' ? 'batería' : 'melodía'}
            </button>
            <button type="button" on:click={handleAiCancel} disabled={!aiBusy} class="btn btn-ghost btn-sm border border-base-300">
              Cancelar
            </button>
            <span class="text-base-content/40 text-xs">El resultado reemplazará la frase actual.</span>
          </div>
        </div>
      </div>
    </div>
  {/if}

  <!-- Modal Piano Roll -->
  {#if pianoRollOpen}
    <div
      class="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-[1100]"
      on:click|self={closePianoRoll}
    >
      <div class="card bg-base-200 border border-base-300 shadow-2xl w-full max-w-[1180px] max-h-[92vh] overflow-auto">
        <div class="card-body gap-3">
          <div class="flex justify-between items-center">
            <div>
              <h3 class="card-title text-base">Editar frase (piano roll)</h3>
              <p class="text-base-content/40 text-sm">{currentPhraseLabel} · {bpm} BPM</p>
            </div>
            <button type="button" on:click={closePianoRoll} class="btn btn-ghost btn-sm btn-circle text-lg">✕</button>
          </div>
          <PianoRoll
            events={clip}
            bpm={bpm}
            bind:bars={rollBars}
            playheadBeat={playheadBeat}
            playheadTotalBeats={playheadTotalBeats}
            isPlaying={isPlaying}
            on:change={handlePianoRollChange}
            on:play={handleRollPlay}
            on:stop={handleRollStop}
          />
        </div>
      </div>
    </div>
  {/if}
</main>
