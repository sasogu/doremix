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
          events.push({
            type: ev.type,
            note: ev.note,
            velocity: ev.velocity,
            beat: ev.beat + offset,
            channel: ev.channel ?? channelForLane(lane)
          });
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
    const events = eventsSource.map((ev) => ({
      t: start + ev.beat * secPerBeat,
      type: ev.type,
      note: ev.note,
      velocity: ev.velocity ?? 0
    }));
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

<main class="p-6 min-h-screen" style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, sans-serif; background:#0b0b0b; color:#f2f2f2;">
  <h1 style="font-size:2rem; font-weight:700; margin-bottom:1rem;">DoReMix — PWA (SvelteKit)</h1>
  <p style="opacity:0.8; margin-bottom:1.5rem;">Demo: reproduce un pequeño "clip" de 1 compás con un sintetizador en AudioWorklet.</p>

  <section style="border:1px solid #333; border-radius:12px; padding:1.2rem; max-width:820px; margin-bottom:2rem;">
    <h2 style="font-size:1.2rem; margin:0 0 0.8rem 0;">Motor de sonido</h2>
    <div style="display:flex; flex-wrap:wrap; gap:0.8rem; align-items:center; margin-bottom:0.8rem;">
      <label for="engine-mode" style="min-width:8rem;">Modo</label>
      <select
        id="engine-mode"
        value={engineMode}
        on:change={handleEngineModeChange}
        style="flex:0 1 240px; min-width:200px; padding:0.45rem; background:#181818; color:#fff; border:1px solid #333; border-radius:8px;"
      >
        <option value="basic">Motor interno (seno simple)</option>
        <option value="fluid">FluidSynth + SoundFont GM</option>
      </select>
      {#if engineMode === 'fluid'}
        <span style="opacity:0.7;">{currentSoundFontLabel}</span>
      {/if}
    </div>
    {#if engineMode === 'fluid'}
      {#if fluidError}
        <p style="color:#ff6b6b; margin:0 0 0.6rem 0;">{fluidError}</p>
      {/if}
      <div style="display:flex; flex-wrap:wrap; gap:0.8rem; align-items:center;">
        <label for="soundfont-file" style="min-width:12rem;">Cargar SoundFont (.sf2/.sf3)</label>
        <input
          id="soundfont-file"
          type="file"
          accept=".sf2,.sf3"
          on:change={handleSoundFontSelect}
          disabled={soundFontLoading}
          style="flex:1 1 220px; min-width:200px; padding:0.45rem; background:#181818; color:#fff; border:1px solid #333; border-radius:8px;"
        />
        <button
          type="button"
          on:click={handleLoadDefaultSoundFont}
          disabled={soundFontLoading}
          style="padding:0.55rem 1.1rem; border-radius:10px; background:#444; color:#fff; border:0;"
        >
          {soundFontLoading ? 'Cargando…' : 'Usar /fluidsynth/GeneralUser-GS.sf2'}
        </button>
      </div>
      <p style="opacity:0.65; margin:0.6rem 0 0 0;">
        Coloca <code style="background:#222; padding:0.1rem 0.35rem; border-radius:6px;">libfluidsynth-*.js</code>,
        <code style="background:#222; padding:0.1rem 0.35rem; border-radius:6px;">libfluidsynth-*.wasm</code> y un SoundFont GM en <code style="background:#222; padding:0.1rem 0.35rem; border-radius:6px;">static/fluidsynth/</code>, o carga uno manualmente.
      </p>
    {/if}
  </section>

  <div style="display:flex; gap:1rem; align-items:center; margin-bottom:1rem; flex-wrap:wrap;">
    <label for="bpm-input">BPM</label>
    <input id="bpm-input" type="number" bind:value={bpm} min="40" max="240" style="width:5rem; padding:0.4rem; background:#181818; color:#fff; border:1px solid #333; border-radius:8px;" />
    <label for="play-source">Reproducir</label>
    <select
      id="play-source"
      value={playSource}
      on:change={handlePlaySourceChange}
      style="flex:0 1 220px; min-width:180px; padding:0.45rem; background:#181818; color:#fff; border:1px solid #333; border-radius:8px;"
    >
      <option value="arrangement">Secuencia (todas las pistas)</option>
      <option value="phrase">Solo frase actual</option>
    </select>
    <button on:click={play} disabled={isPlaying || isPlayDisabled} style="padding:0.6rem 1rem; border-radius:10px; background:#2c7efc; color:#fff; border:0;">Play</button>
    <button on:click={stop} disabled={!isPlaying} style="padding:0.6rem 1rem; border-radius:10px; background:#444; color:#fff; border:0;">Stop</button>
  </div>
  {#if engineMode === 'fluid' && !fluidStatus.soundFontLoaded}
    <p style="opacity:0.65; margin:-0.5rem 0 1.5rem 0;">Carga un SoundFont para habilitar la reproducción con FluidSynth.</p>
  {/if}

  <div style="display:flex; align-items:center; gap:1rem; margin-bottom:1.5rem; flex-wrap:wrap;">
    <p style="opacity:0.7; margin:0;">Frase actual: {currentPhraseLabel}</p>
    <button
      type="button"
      on:click={openPianoRoll}
      style="padding:0.5rem 0.9rem; border-radius:10px; background:#1f1f1f; color:#fff; border:1px solid #333;"
    >
      Abrir piano roll
    </button>
  </div>

  <section style="border:1px solid #333; border-radius:12px; padding:1.2rem; max-width:820px; margin-bottom:2rem;">
    <h2 style="font-size:1.2rem; margin:0 0 0.5rem 0;">IA opcional (Magenta.js)</h2>
    <p style="opacity:0.75; margin:0 0 0.8rem 0;">
      Descarga bajo demanda y se cachea automáticamente tras el primer uso. Pensado para tablets: muestra barra de progreso y no afecta al resto de la app.
    </p>
    <div style="display:flex; gap:0.6rem; flex-wrap:wrap; align-items:center;">
      <label for="ai-mode" style="opacity:0.8;">Modo</label>
      <select
        id="ai-mode"
        bind:value={aiMode}
        style="padding:0.45rem 0.6rem; min-width:220px; background:#181818; color:#fff; border:1px solid #333; border-radius:10px;"
      >
        {#each aiModels as option}
          <option value={option.mode} disabled={option.disabled}>{option.label}</option>
        {/each}
      </select>
      <span style="opacity:0.75; font-size:0.9rem;">Modelo: {currentAiModel.modelName} (~{currentAiModel.sizeMb} MB)</span>
      <button
        type="button"
        on:click={openAiModal}
        style="padding:0.6rem 1rem; border-radius:10px; background:#8b5cf6; color:#fff; border:0;"
      >
        Abrir panel IA
      </button>
      <span style="opacity:0.7; font-size:0.9rem;">
        Estado: {aiProgressStage === 'downloading'
          ? 'Descargando modelo…'
          : aiProgressStage === 'ready'
          ? 'Modelo cacheado/listo'
          : 'Pendiente de descarga'}
      </span>
    </div>
    {#if currentAiModel.helper}
      <p style="opacity:0.6; margin:0.4rem 0 0 0;">{currentAiModel.helper}</p>
    {/if}
  </section>

  <section style="border:1px solid #333; border-radius:12px; padding:1.2rem; max-width:1000px; margin-bottom:2rem;">
    <h2 style="font-size:1.2rem; margin:0 0 0.8rem 0;">Secuenciador por pistas</h2>
    <p style="opacity:0.75; margin:0 0 0.8rem 0;">
      Organiza hasta {SLOT_COUNT} frases; cada frase dura 4 compases (16 beats). Frases activas: {arrangementActiveBars}/{SLOT_COUNT}.
    </p>
    <div style="overflow:auto;">
      <table style="width:100%; border-collapse:collapse; min-width:720px;">
        <thead>
          <tr>
            <th scope="col" style="text-align:left; padding:0.4rem 0.6rem; font-weight:600; opacity:0.8; border-bottom:1px solid #333;">Pista</th>
            {#each slotIndices as idx}
              <th scope="col" style="text-align:center; padding:0.4rem 0.6rem; font-weight:600; opacity:0.7; border-bottom:1px solid #333;">Frase {idx + 1}</th>
            {/each}
          </tr>
        </thead>
        <tbody>
          {#each trackLanes as lane}
            <tr>
              <th scope="row" style="padding:0.6rem; text-align:left; border-bottom:1px solid #222;">
                <div style="display:flex; align-items:center; gap:0.6rem;">
                  <span aria-hidden="true" style={`display:inline-block; width:0.9rem; height:0.9rem; border-radius:999px; background:${lane.color};`}></span>
                  <span>{lane.name}</span>
                  <button
                    type="button"
                    on:click={() => clearTrack(lane.id)}
                    style="margin-left:auto; padding:0.25rem 0.6rem; border-radius:999px; font-size:0.75rem; background:#1f1f1f; color:#ddd; border:1px solid #333;"
                  >
                    Vaciar pista
                  </button>
                </div>
              </th>
              {#each slotIndices as slotIndex}
                <td
                  style={`padding:0.6rem; border-bottom:1px solid #222; background:${
                    playSource === 'arrangement' && activeSlotIndex === slotIndex
                      ? 'rgba(44,126,252,0.2)'
                      : previewLaneId === lane.id && previewSlotIndex === slotIndex
                      ? 'rgba(34,211,238,0.18)'
                      : 'transparent'
                  }; transition:background 0.2s ease;`}
                >
                  <div style="display:flex; flex-direction:column; gap:0.35rem;">
                    <select
                      value={lane.slots[slotIndex] ?? ''}
                      on:change={(event) =>
                        updateTrackSlot(
                          lane.id,
                          slotIndex,
                          (event.currentTarget as HTMLSelectElement).value || null
                        )}
                      style="padding:0.35rem; background:#181818; color:#fff; border:1px solid #333; border-radius:8px;"
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
                    <div style="display:flex; justify-content:space-between; align-items:center; gap:0.5rem;">
                      <span style="opacity:0.6; font-size:0.75rem;">{getPhraseLabel(lane.slots[slotIndex], currentPhraseLabel, packList)}</span>
                      <div style="display:flex; gap:0.35rem; align-items:center;">
                        <button
                          type="button"
                          on:click={() => previewTrackSlot(lane.id, slotIndex)}
                          disabled={!lane.slots[slotIndex] || isPlaying}
                          title="Previsualizar esta frase"
                          style="padding:0.25rem 0.5rem; border-radius:8px; background:#1e1e1e; color:#fff; border:1px solid #333; font-size:0.75rem;"
                        >
                          ▶
                        </button>
                        <button
                          type="button"
                          on:click={() => editSlotInPianoRoll(lane.id, slotIndex)}
                          disabled={!lane.slots[slotIndex]}
                          style="padding:0.25rem 0.6rem; border-radius:8px; background:#2c7efc; color:#fff; border:0; font-size:0.75rem;"
                        >
                          Editar
                        </button>
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
  </section>

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

  {#if aiModalOpen}
    <div
      style="position:fixed; inset:0; background:rgba(0,0,0,0.65); display:flex; align-items:center; justify-content:center; padding:1rem; z-index:1000;"
    >
      <div style="background:#0f0f10; border:1px solid #333; border-radius:14px; padding:1.2rem; width: min(520px, 100%); box-shadow:0 12px 40px rgba(0,0,0,0.35);">
        <div style="display:flex; justify-content:space-between; align-items:center; gap:0.6rem; margin-bottom:0.6rem;">
          <h3 style="margin:0; font-size:1.05rem;">Generación IA (Magenta opcional)</h3>
          <button
            type="button"
            on:click={closeAiModal}
            style="background:transparent; color:#fff; border:1px solid #444; border-radius:10px; padding:0.3rem 0.65rem;"
          >
            Cerrar
          </button>
        </div>
        <p style="opacity:0.75; margin:0 0 0.8rem 0;">
          Modo actual: {currentAiModel.label}. Descarga el modelo solo cuando lo pidas. Necesita conexión para el primer uso; después se cachea automático. Muestra barra de progreso para tablets/lento.
        </p>
        <div style="display:flex; flex-direction:column; gap:0.6rem; margin-bottom:0.6rem;">
          <div style="height:12px; background:#1b1b1b; border-radius:999px; overflow:hidden; border:1px solid #222;">
            <div
              style={`height:100%; width:${aiProgressPercent}%; background:#8b5cf6; transition:width 0.2s ease;`}
            ></div>
          </div>
          <div style="display:flex; justify-content:space-between; font-size:0.9rem; opacity:0.75;">
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
            <p style="color:#ff6b6b; margin:0;">{aiError}</p>
          {/if}
          <p style="opacity:0.7; margin:0;">Modelo: {currentAiModel.modelName}</p>
        </div>
        <div style="display:flex; gap:0.5rem; flex-wrap:wrap; align-items:center;">
          <button
            type="button"
            on:click={handleAiDownload}
            disabled={aiBusy || aiProgressStage === 'downloading'}
            style="padding:0.55rem 1rem; border-radius:10px; background:#2c7efc; color:#fff; border:0;"
          >
            {aiProgressStage === 'ready' ? 'Reintentar descarga' : aiBusy ? 'Descargando…' : 'Descargar modelo'}
          </button>
          <button
            type="button"
            on:click={handleAiGenerate}
            disabled={aiBusy}
            style="padding:0.55rem 1rem; border-radius:10px; background:#22d3ee; color:#0b0b0b; border:0;"
          >
            Generar {aiMode === 'drums' ? 'batería' : 'melodía'}
          </button>
          <button
            type="button"
            on:click={handleAiCancel}
            disabled={!aiBusy}
            style="padding:0.55rem 1rem; border-radius:10px; background:#1f1f1f; color:#fff; border:1px solid #333;"
          >
            Cancelar
          </button>
          <span style="opacity:0.7; font-size:0.9rem;">El resultado reemplazará la frase actual.</span>
        </div>
      </div>
    </div>
  {/if}

  {#if pianoRollOpen}
    <div
      style="position:fixed; inset:0; background:rgba(0,0,0,0.65); display:flex; align-items:center; justify-content:center; padding:1rem; z-index:1100;"
    >
      <div
        style="background:#0f0f10; border:1px solid #333; border-radius:14px; padding:1.2rem; width: min(1180px, 100%); max-height: min(92vh, 1100px); overflow:auto; box-shadow:0 12px 40px rgba(0,0,0,0.35);"
      >
        <div style="display:flex; justify-content:space-between; align-items:center; gap:0.8rem; margin-bottom:0.6rem;">
          <div>
            <h3 style="margin:0; font-size:1.1rem;">Editar frase (piano roll)</h3>
            <p style="margin:0; opacity:0.7; font-size:0.95rem;">{currentPhraseLabel} · {bpm} BPM</p>
          </div>
          <button
            type="button"
            on:click={closePianoRoll}
            style="background:transparent; color:#fff; border:1px solid #444; border-radius:10px; padding:0.35rem 0.7rem;"
          >
            Cerrar
          </button>
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
  {/if}
</main>
