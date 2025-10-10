import { V as store_get, W as attr, X as ensure_array_like, Y as attr_style, Z as unsubscribe_stores } from "../../chunks/index2.js";
import { w as writable } from "../../chunks/index.js";
import { e as escape_html } from "../../chunks/context.js";
const packsStore = writable([]);
const phrasePacks = packsStore;
function makePhrase(id, name, events) {
  return {
    id,
    name,
    bpm: 120,
    events
  };
}
const percClassicEvents = [
  { beat: 0, type: "noteon", note: 36, velocity: 1 },
  { beat: 0.25, type: "noteon", note: 42, velocity: 0.8 },
  { beat: 0.5, type: "noteon", note: 38, velocity: 0.9 },
  { beat: 0.75, type: "noteon", note: 42, velocity: 0.8 },
  { beat: 1, type: "noteon", note: 36, velocity: 1 },
  { beat: 1.25, type: "noteon", note: 42, velocity: 0.8 },
  { beat: 1.5, type: "noteon", note: 38, velocity: 0.9 },
  { beat: 1.75, type: "noteon", note: 46, velocity: 0.8 },
  { beat: 2, type: "noteon", note: 36, velocity: 1 },
  { beat: 2.25, type: "noteon", note: 42, velocity: 0.8 },
  { beat: 2.5, type: "noteon", note: 38, velocity: 0.9 },
  { beat: 2.75, type: "noteon", note: 42, velocity: 0.8 },
  { beat: 3, type: "noteon", note: 36, velocity: 1 },
  { beat: 3.25, type: "noteon", note: 44, velocity: 0.7 },
  { beat: 3.5, type: "noteon", note: 38, velocity: 0.9 },
  { beat: 3.75, type: "noteon", note: 46, velocity: 0.8 },
  // noteoff events to keep envelope tidy
  { beat: 0.01, type: "noteoff", note: 36 },
  { beat: 0.26, type: "noteoff", note: 42 },
  { beat: 0.51, type: "noteoff", note: 38 },
  { beat: 0.76, type: "noteoff", note: 42 },
  { beat: 1.01, type: "noteoff", note: 36 },
  { beat: 1.26, type: "noteoff", note: 42 },
  { beat: 1.51, type: "noteoff", note: 38 },
  { beat: 1.76, type: "noteoff", note: 46 },
  { beat: 2.01, type: "noteoff", note: 36 },
  { beat: 2.26, type: "noteoff", note: 42 },
  { beat: 2.51, type: "noteoff", note: 38 },
  { beat: 2.76, type: "noteoff", note: 42 },
  { beat: 3.01, type: "noteoff", note: 36 },
  { beat: 3.26, type: "noteoff", note: 44 },
  { beat: 3.51, type: "noteoff", note: 38 },
  { beat: 3.76, type: "noteoff", note: 46 }
];
const percHalfTimeEvents = [
  { beat: 0, type: "noteon", note: 36, velocity: 1 },
  { beat: 0.5, type: "noteon", note: 42, velocity: 0.8 },
  { beat: 1, type: "noteon", note: 38, velocity: 0.9 },
  { beat: 1.5, type: "noteon", note: 46, velocity: 0.8 },
  { beat: 2, type: "noteon", note: 36, velocity: 1 },
  { beat: 2.5, type: "noteon", note: 42, velocity: 0.8 },
  { beat: 3, type: "noteon", note: 38, velocity: 0.9 },
  { beat: 3.5, type: "noteon", note: 46, velocity: 0.8 },
  { beat: 0.05, type: "noteoff", note: 36 },
  { beat: 0.55, type: "noteoff", note: 42 },
  { beat: 1.05, type: "noteoff", note: 38 },
  { beat: 1.55, type: "noteoff", note: 46 },
  { beat: 2.05, type: "noteoff", note: 36 },
  { beat: 2.55, type: "noteoff", note: 42 },
  { beat: 3.05, type: "noteoff", note: 38 },
  { beat: 3.55, type: "noteoff", note: 46 }
];
const bassPulseEvents = [
  { beat: 0, type: "noteon", note: 36, velocity: 0.9 },
  { beat: 1, type: "noteon", note: 38, velocity: 0.8 },
  { beat: 2, type: "noteon", note: 41, velocity: 0.8 },
  { beat: 3, type: "noteon", note: 43, velocity: 0.9 },
  { beat: 0.9, type: "noteoff", note: 36 },
  { beat: 1.9, type: "noteoff", note: 38 },
  { beat: 2.9, type: "noteoff", note: 41 },
  { beat: 3.9, type: "noteoff", note: 43 }
];
const bassSyncopatedEvents = [
  { beat: 0, type: "noteon", note: 36, velocity: 0.9 },
  { beat: 0.75, type: "noteon", note: 43, velocity: 0.8 },
  { beat: 1.5, type: "noteon", note: 38, velocity: 0.9 },
  { beat: 2.25, type: "noteon", note: 41, velocity: 0.85 },
  { beat: 3, type: "noteon", note: 43, velocity: 0.9 },
  { beat: 0.65, type: "noteoff", note: 36 },
  { beat: 1.4, type: "noteoff", note: 43 },
  { beat: 2.15, type: "noteoff", note: 38 },
  { beat: 2.9, type: "noteoff", note: 41 },
  { beat: 3.65, type: "noteoff", note: 43 }
];
const chordsBlockEvents = [
  { beat: 0, type: "noteon", note: 60, velocity: 0.8 },
  { beat: 0, type: "noteon", note: 64, velocity: 0.8 },
  { beat: 0, type: "noteon", note: 67, velocity: 0.8 },
  { beat: 2, type: "noteon", note: 62, velocity: 0.8 },
  { beat: 2, type: "noteon", note: 65, velocity: 0.8 },
  { beat: 2, type: "noteon", note: 69, velocity: 0.8 },
  { beat: 1.95, type: "noteoff", note: 60 },
  { beat: 1.95, type: "noteoff", note: 64 },
  { beat: 1.95, type: "noteoff", note: 67 },
  { beat: 3.95, type: "noteoff", note: 62 },
  { beat: 3.95, type: "noteoff", note: 65 },
  { beat: 3.95, type: "noteoff", note: 69 }
];
const chordsRhythmEvents = [
  { beat: 0, type: "noteon", note: 60, velocity: 0.75 },
  { beat: 0, type: "noteon", note: 64, velocity: 0.75 },
  { beat: 0, type: "noteon", note: 67, velocity: 0.75 },
  { beat: 1, type: "noteon", note: 60, velocity: 0.7 },
  { beat: 1.5, type: "noteon", note: 64, velocity: 0.7 },
  { beat: 2, type: "noteon", note: 65, velocity: 0.75 },
  { beat: 2, type: "noteon", note: 69, velocity: 0.75 },
  { beat: 3, type: "noteon", note: 65, velocity: 0.7 },
  { beat: 3.5, type: "noteon", note: 69, velocity: 0.7 },
  { beat: 0.8, type: "noteoff", note: 60 },
  { beat: 0.8, type: "noteoff", note: 64 },
  { beat: 0.8, type: "noteoff", note: 67 },
  { beat: 1.8, type: "noteoff", note: 60 },
  { beat: 1.8, type: "noteoff", note: 64 },
  { beat: 2.8, type: "noteoff", note: 65 },
  { beat: 2.8, type: "noteoff", note: 69 },
  { beat: 3.8, type: "noteoff", note: 65 },
  { beat: 3.8, type: "noteoff", note: 69 }
];
const leadArpEvents = [
  { beat: 0, type: "noteon", note: 72, velocity: 0.85 },
  { beat: 0.5, type: "noteon", note: 76, velocity: 0.8 },
  { beat: 1, type: "noteon", note: 79, velocity: 0.8 },
  { beat: 1.5, type: "noteon", note: 83, velocity: 0.85 },
  { beat: 2, type: "noteon", note: 79, velocity: 0.85 },
  { beat: 2.5, type: "noteon", note: 76, velocity: 0.8 },
  { beat: 3, type: "noteon", note: 72, velocity: 0.8 },
  { beat: 3.5, type: "noteon", note: 76, velocity: 0.85 },
  { beat: 0.35, type: "noteoff", note: 72 },
  { beat: 0.85, type: "noteoff", note: 76 },
  { beat: 1.35, type: "noteoff", note: 79 },
  { beat: 1.85, type: "noteoff", note: 83 },
  { beat: 2.35, type: "noteoff", note: 79 },
  { beat: 2.85, type: "noteoff", note: 76 },
  { beat: 3.35, type: "noteoff", note: 72 },
  { beat: 3.85, type: "noteoff", note: 76 }
];
const leadCounterEvents = [
  { beat: 0.25, type: "noteon", note: 74, velocity: 0.8 },
  { beat: 0.75, type: "noteon", note: 77, velocity: 0.8 },
  { beat: 1.25, type: "noteon", note: 79, velocity: 0.8 },
  { beat: 1.75, type: "noteon", note: 81, velocity: 0.8 },
  { beat: 2.25, type: "noteon", note: 79, velocity: 0.8 },
  { beat: 2.75, type: "noteon", note: 77, velocity: 0.8 },
  { beat: 3.25, type: "noteon", note: 74, velocity: 0.8 },
  { beat: 3.75, type: "noteon", note: 72, velocity: 0.8 },
  { beat: 0.6, type: "noteoff", note: 74 },
  { beat: 1.1, type: "noteoff", note: 77 },
  { beat: 1.6, type: "noteoff", note: 79 },
  { beat: 2.1, type: "noteoff", note: 81 },
  { beat: 2.6, type: "noteoff", note: 79 },
  { beat: 3.1, type: "noteoff", note: 77 },
  { beat: 3.6, type: "noteoff", note: 74 },
  { beat: 4.1, type: "noteoff", note: 72 }
];
const builtinPhrases = [
  {
    key: "perc-classic",
    name: "Percusión 4/4",
    description: "Kick, caja y hats clásicos house.",
    category: "perc",
    phrase: makePhrase("builtin-perc-classic", "Percusión 4/4", percClassicEvents)
  },
  {
    key: "perc-halftime",
    name: "Percusión halftime",
    description: "Bombo firme y caja a contratiempos.",
    category: "perc",
    phrase: makePhrase("builtin-perc-halftime", "Percusión halftime", percHalfTimeEvents)
  },
  {
    key: "bass-pulse",
    name: "Bajo pulsante",
    description: "Notas graves en negras.",
    category: "bass",
    phrase: makePhrase("builtin-bass-pulse", "Bajo pulsante", bassPulseEvents)
  },
  {
    key: "bass-syncopated",
    name: "Bajo sincopado",
    description: "Movimiento en síncopas.",
    category: "bass",
    phrase: makePhrase("builtin-bass-sync", "Bajo sincopado", bassSyncopatedEvents)
  },
  {
    key: "chords-blocks",
    name: "Acordes alternos",
    description: "Bloques largos a dos compases.",
    category: "chords",
    phrase: makePhrase("builtin-chords-blocks", "Acordes alternos", chordsBlockEvents)
  },
  {
    key: "chords-rhythm",
    name: "Acordes rítmicos",
    description: "Patrón con stabs en corcheas.",
    category: "chords",
    phrase: makePhrase("builtin-chords-rhythm", "Acordes rítmicos", chordsRhythmEvents)
  },
  {
    key: "lead-arp",
    name: "Lead arpegio",
    description: "Arpegio ascendente/descendente.",
    category: "melody",
    phrase: makePhrase("builtin-lead-arp", "Lead arpegio", leadArpEvents)
  },
  {
    key: "lead-counter",
    name: "Lead contrapunto",
    description: "Respuesta melódica en síncopas.",
    category: "melody",
    phrase: makePhrase("builtin-lead-counter", "Lead contrapunto", leadCounterEvents)
  }
];
function getBuiltinPhraseByKey(key) {
  return builtinPhrases.find((entry) => entry.key === key) ?? null;
}
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    const SLOT_COUNT = 8;
    const slotIndices = Array.from({ length: SLOT_COUNT }, (_, idx) => idx);
    const builtinOptionEntries = builtinPhrases.map((entry) => ({
      key: entry.key,
      label: entry.name,
      category: entry.category,
      source: "builtin"
    })).sort((a, b) => a.label.localeCompare(b.label, "es", { sensitivity: "base" }));
    let engineMode = "basic";
    let playSource = "arrangement";
    let bpm = 120;
    let isPlaying = false;
    const defaultEvents = [
      { beat: 0, type: "noteon", note: 60, velocity: 0.8 },
      { beat: 0.5, type: "noteoff", note: 60 },
      { beat: 1, type: "noteon", note: 64, velocity: 0.8 },
      { beat: 1.5, type: "noteoff", note: 64 },
      { beat: 2, type: "noteon", note: 67, velocity: 0.8 },
      { beat: 2.5, type: "noteoff", note: 67 },
      { beat: 3, type: "noteon", note: 72, velocity: 0.8 },
      { beat: 3.5, type: "noteoff", note: 72 }
    ];
    let currentPhrase = {
      id: "default-phrase",
      name: "Clip demo",
      bpm,
      events: cloneEvents(defaultEvents)
    };
    let clip = currentPhrase.events;
    let trackLanes = createInitialArrangement();
    let arrangementEvents = [];
    let arrangementActiveBars = 0;
    currentPhrase.name;
    let midiLoading = false;
    let packList = [];
    let packOptionEntries = [];
    let currentPhraseLabel = currentPhrase.name;
    let currentOptionLabel = `${currentPhraseLabel} (en edición)`;
    let hasEvents = clip.length > 0;
    let isPlayDisabled = false;
    let activeSlotIndex = null;
    let slotDurations = Array(SLOT_COUNT).fill(0);
    let slotOffsets = Array(SLOT_COUNT).fill(0);
    let previewLaneId = null;
    let previewSlotIndex = null;
    function createInitialArrangement() {
      return [
        {
          id: "track-perc",
          name: "Percusión",
          color: "#f97316",
          category: "perc",
          slots: createSlotsFromPattern(["builtin:perc-classic"])
        },
        {
          id: "track-bass",
          name: "Bajo",
          color: "#22d3ee",
          category: "bass",
          slots: createSlotsFromPattern(["builtin:bass-pulse", "builtin:bass-syncopated"])
        },
        {
          id: "track-chords",
          name: "Acordes",
          color: "#a855f7",
          category: "chords",
          slots: createSlotsFromPattern(["builtin:chords-blocks", "builtin:chords-rhythm"])
        },
        {
          id: "track-lead",
          name: "Lead",
          color: "#f472b6",
          category: "melody",
          slots: createSlotsFromPattern([
            "builtin:lead-arp",
            "builtin:lead-counter",
            null,
            "builtin:lead-arp"
          ])
        }
      ];
    }
    function createSlotsFromPattern(pattern) {
      return Array.from({ length: SLOT_COUNT }, (_, idx) => pattern[idx % pattern.length] ?? null);
    }
    function cloneEvents(events) {
      return events.map((ev) => ({ ...ev }));
    }
    function computeActiveBars(lanes) {
      const active = /* @__PURE__ */ new Set();
      for (const lane of lanes) {
        lane.slots.forEach((slot, idx) => {
          if (slot) active.add(idx);
        });
      }
      return active.size;
    }
    function resolvePhraseByKey(key, current, packs) {
      if (!key) return null;
      if (key === "current") return current;
      if (key.startsWith("builtin:")) {
        const entry = getBuiltinPhraseByKey(key.replace("builtin:", ""));
        return entry ? entry.phrase : null;
      }
      if (key.startsWith("pack:")) {
        const [, packId, phraseId] = key.split(":");
        const pack = packs.find((p) => p.id === packId);
        const phrase = pack?.phrases.find((p) => p.id === phraseId);
        return phrase ?? null;
      }
      return null;
    }
    function getPhraseLabel(key, currentLabel, packs) {
      if (!key) return "— Vacío —";
      if (key === "current") return `${currentLabel} (actual)`;
      if (key.startsWith("builtin:")) {
        return getBuiltinPhraseByKey(key.replace("builtin:", ""))?.name ?? "Frase base";
      }
      if (key.startsWith("pack:")) {
        const [, packId, phraseId] = key.split(":");
        const pack = packs.find((p) => p.id === packId);
        const phrase = pack?.phrases.find((p) => p.id === phraseId);
        if (pack && phrase) return `${pack.name} · ${phrase.name}`;
        return "Frase de pack";
      }
      return "Frase";
    }
    function estimatePhraseDurationBeats(phrase) {
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
      const padding = 0.5;
      return Math.max(span + padding, 1);
    }
    function computeSlotDurations(lanes, current, packs) {
      return slotIndices.map((slotIndex) => {
        let maxDuration = 0;
        let hasPhrase = false;
        for (const lane of lanes) {
          const phrase = resolvePhraseByKey(lane.slots[slotIndex], current, packs);
          if (!phrase) continue;
          hasPhrase = true;
          const duration = estimatePhraseDurationBeats(phrase);
          if (duration > maxDuration) maxDuration = duration;
        }
        if (!hasPhrase) return 0;
        return maxDuration;
      });
    }
    function computeSlotOffsets(durations) {
      const offsets = [];
      let sum = 0;
      for (let i = 0; i < durations.length; i++) {
        offsets.push(sum);
        sum += durations[i];
      }
      return offsets;
    }
    function optionAllowedForLane(option, lane) {
      if (lane.category === "any") return true;
      if (option.category === "any") return true;
      return option.category === lane.category;
    }
    function buildArrangementEvents(lanes, current, packs, offsets) {
      const events = [];
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
              beat: ev.beat + offset
            });
          });
        });
      });
      events.sort((a, b) => {
        if (a.beat === b.beat) {
          if (a.type === b.type) return a.note - b.note;
          return a.type === "noteoff" ? 1 : -1;
        }
        return a.beat - b.beat;
      });
      return events;
    }
    packList = store_get($$store_subs ??= {}, "$phrasePacks", phrasePacks);
    packList.length;
    currentPhraseLabel = currentPhrase?.name ?? "Clip actual";
    currentOptionLabel = `${currentPhraseLabel} (en edición)`;
    packOptionEntries = packList.flatMap((pack) => pack.phrases.map((phrase) => ({
      key: `pack:${pack.id}:${phrase.id}`,
      label: `${pack.name} · ${phrase.name}`,
      category: "any",
      source: "pack"
    }))).sort((a, b) => a.label.localeCompare(b.label, "es", { sensitivity: "base" }));
    slotDurations = computeSlotDurations(trackLanes, currentPhrase, packList);
    slotOffsets = computeSlotOffsets(slotDurations);
    slotDurations.reduce((sum, len) => sum + len, 0);
    arrangementEvents = buildArrangementEvents(trackLanes, currentPhrase, packList, slotOffsets);
    arrangementActiveBars = computeActiveBars(trackLanes);
    hasEvents = arrangementEvents.length > 0;
    isPlayDisabled = !hasEvents || engineMode === "fluid";
    $$renderer2.push(`<main class="p-6 min-h-screen" style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, sans-serif; background:#0b0b0b; color:#f2f2f2;"><h1 style="font-size:2rem; font-weight:700; margin-bottom:1rem;">DoReMix — PWA (SvelteKit)</h1> <p style="opacity:0.8; margin-bottom:1.5rem;">Demo: reproduce un pequeño "clip" de 1 compás con un sintetizador en AudioWorklet.</p> <section style="border:1px solid #333; border-radius:12px; padding:1.2rem; max-width:820px; margin-bottom:2rem;"><h2 style="font-size:1.2rem; margin:0 0 0.8rem 0;">Motor de sonido</h2> <div style="display:flex; flex-wrap:wrap; gap:0.8rem; align-items:center; margin-bottom:0.8rem;"><label for="engine-mode" style="min-width:8rem;">Modo</label> `);
    $$renderer2.select(
      {
        id: "engine-mode",
        value: (
          // pequeño margen para dejar respirar el loop
          engineMode
        ),
        style: "flex:0 1 240px; min-width:200px; padding:0.45rem; background:#181818; color:#fff; border:1px solid #333; border-radius:8px;"
      },
      ($$renderer3) => {
        $$renderer3.option({ value: "basic" }, ($$renderer4) => {
          $$renderer4.push(`Motor interno (seno simple)`);
        });
        $$renderer3.option({ value: "fluid" }, ($$renderer4) => {
          $$renderer4.push(`FluidSynth + SoundFont GM`);
        });
      }
    );
    $$renderer2.push(` `);
    {
      $$renderer2.push("<!--[!-->");
    }
    $$renderer2.push(`<!--]--></div> `);
    {
      $$renderer2.push("<!--[!-->");
    }
    $$renderer2.push(`<!--]--></section> <div style="display:flex; gap:1rem; align-items:center; margin-bottom:1rem; flex-wrap:wrap;"><label for="bpm-input">BPM</label> <input id="bpm-input" type="number"${attr("value", bpm)} min="40" max="240" style="width:5rem; padding:0.4rem; background:#181818; color:#fff; border:1px solid #333; border-radius:8px;"/> <label for="play-source">Reproducir</label> `);
    $$renderer2.select(
      {
        id: "play-source",
        value: playSource,
        style: "flex:0 1 220px; min-width:180px; padding:0.45rem; background:#181818; color:#fff; border:1px solid #333; border-radius:8px;"
      },
      ($$renderer3) => {
        $$renderer3.option({ value: "arrangement" }, ($$renderer4) => {
          $$renderer4.push(`Secuencia (todas las pistas)`);
        });
        $$renderer3.option({ value: "phrase" }, ($$renderer4) => {
          $$renderer4.push(`Solo frase actual`);
        });
      }
    );
    $$renderer2.push(` <button${attr("disabled", isPlayDisabled, true)} style="padding:0.6rem 1rem; border-radius:10px; background:#2c7efc; color:#fff; border:0;">Play</button> <button${attr("disabled", !isPlaying, true)} style="padding:0.6rem 1rem; border-radius:10px; background:#444; color:#fff; border:0;">Stop</button></div> `);
    {
      $$renderer2.push("<!--[!-->");
    }
    $$renderer2.push(`<!--]--> <p style="opacity:0.7; margin-bottom:1.5rem;">Frase actual: ${escape_html(currentPhraseLabel)}</p> <section style="border:1px solid #333; border-radius:12px; padding:1.2rem; max-width:1000px; margin-bottom:2rem;"><h2 style="font-size:1.2rem; margin:0 0 0.8rem 0;">Secuenciador por pistas</h2> <p style="opacity:0.75; margin:0 0 0.8rem 0;">Organiza hasta 8 compases (4 beats cada uno). Compases activos: ${escape_html(arrangementActiveBars)}/8.</p> <div style="overflow:auto;"><table style="width:100%; border-collapse:collapse; min-width:720px;"><thead><tr><th scope="col" style="text-align:left; padding:0.4rem 0.6rem; font-weight:600; opacity:0.8; border-bottom:1px solid #333;">Pista</th><!--[-->`);
    const each_array = ensure_array_like(slotIndices);
    for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
      let idx = each_array[$$index];
      $$renderer2.push(`<th scope="col" style="text-align:center; padding:0.4rem 0.6rem; font-weight:600; opacity:0.7; border-bottom:1px solid #333;">Compás ${escape_html(idx + 1)}</th>`);
    }
    $$renderer2.push(`<!--]--></tr></thead><tbody><!--[-->`);
    const each_array_1 = ensure_array_like(trackLanes);
    for (let $$index_4 = 0, $$length = each_array_1.length; $$index_4 < $$length; $$index_4++) {
      let lane = each_array_1[$$index_4];
      $$renderer2.push(`<tr><th scope="row" style="padding:0.6rem; text-align:left; border-bottom:1px solid #222;"><div style="display:flex; align-items:center; gap:0.6rem;"><span aria-hidden="true"${attr_style(`display:inline-block; width:0.9rem; height:0.9rem; border-radius:999px; background:${lane.color};`)}></span> <span>${escape_html(lane.name)}</span> <button type="button" style="margin-left:auto; padding:0.25rem 0.6rem; border-radius:999px; font-size:0.75rem; background:#1f1f1f; color:#ddd; border:1px solid #333;">Vaciar pista</button></div></th><!--[-->`);
      const each_array_2 = ensure_array_like(slotIndices);
      for (let $$index_3 = 0, $$length2 = each_array_2.length; $$index_3 < $$length2; $$index_3++) {
        let slotIndex = each_array_2[$$index_3];
        $$renderer2.push(`<td${attr_style(`padding:0.6rem; border-bottom:1px solid #222; background:${activeSlotIndex === slotIndex ? "rgba(44,126,252,0.2)" : previewLaneId === lane.id && previewSlotIndex === slotIndex ? "rgba(34,211,238,0.18)" : "transparent"}; transition:background 0.2s ease;`)}><div style="display:flex; flex-direction:column; gap:0.35rem;">`);
        $$renderer2.select(
          {
            value: lane.slots[slotIndex] ?? "",
            style: "padding:0.35rem; background:#181818; color:#fff; border:1px solid #333; border-radius:8px;"
          },
          ($$renderer3) => {
            $$renderer3.option({ value: "" }, ($$renderer4) => {
              $$renderer4.push(`— Vacío —`);
            });
            $$renderer3.push(`<optgroup label="Frase actual">`);
            $$renderer3.option({ value: "current" }, ($$renderer4) => {
              $$renderer4.push(`${escape_html(currentOptionLabel)}`);
            });
            $$renderer3.push(`</optgroup>`);
            if (packOptionEntries.length) {
              $$renderer3.push("<!--[-->");
              $$renderer3.push(`<optgroup label="Packs guardados"><!--[-->`);
              const each_array_3 = ensure_array_like(packOptionEntries.filter((option) => optionAllowedForLane(option, lane)));
              for (let $$index_1 = 0, $$length3 = each_array_3.length; $$index_1 < $$length3; $$index_1++) {
                let option = each_array_3[$$index_1];
                $$renderer3.option({ value: option.key }, ($$renderer4) => {
                  $$renderer4.push(`${escape_html(option.label)}`);
                });
              }
              $$renderer3.push(`<!--]--></optgroup>`);
            } else {
              $$renderer3.push("<!--[!-->");
            }
            $$renderer3.push(`<!--]--><optgroup label="Frases base"><!--[-->`);
            const each_array_4 = ensure_array_like(builtinOptionEntries.filter((option) => optionAllowedForLane(option, lane)));
            for (let $$index_2 = 0, $$length3 = each_array_4.length; $$index_2 < $$length3; $$index_2++) {
              let option = each_array_4[$$index_2];
              $$renderer3.option({ value: `builtin:${option.key}` }, ($$renderer4) => {
                $$renderer4.push(`${escape_html(option.label)}`);
              });
            }
            $$renderer3.push(`<!--]--></optgroup>`);
          }
        );
        $$renderer2.push(` <div style="display:flex; justify-content:space-between; align-items:center; gap:0.5rem;"><span style="opacity:0.6; font-size:0.75rem;">${escape_html(getPhraseLabel(lane.slots[slotIndex], currentPhraseLabel, packList))}</span> <div style="display:flex; gap:0.35rem; align-items:center;"><button type="button"${attr("disabled", !lane.slots[slotIndex] || isPlaying, true)} title="Previsualizar esta frase" style="padding:0.25rem 0.5rem; border-radius:8px; background:#1e1e1e; color:#fff; border:1px solid #333; font-size:0.75rem;">▶</button> <button type="button"${attr("disabled", !lane.slots[slotIndex], true)} style="padding:0.25rem 0.6rem; border-radius:8px; background:#2c7efc; color:#fff; border:0; font-size:0.75rem;">Editar</button></div></div></div></td>`);
      }
      $$renderer2.push(`<!--]--></tr>`);
    }
    $$renderer2.push(`<!--]--></tbody></table></div></section> <section style="border:1px solid #333; border-radius:12px; padding:1.2rem; max-width:820px; margin-bottom:2rem;"><h2 style="font-size:1.2rem; margin:0 0 0.8rem 0;">Importar SMF (.mid)</h2> <p style="opacity:0.75; margin-bottom:0.8rem;">Carga un archivo MIDI estándar para convertirlo en la frase activa.</p> <div style="display:flex; flex-wrap:wrap; gap:0.8rem; align-items:center; margin-bottom:0.8rem;"><label for="smf-file" style="min-width:8rem;">Archivo SMF</label> <input id="smf-file" type="file" accept=".mid,.midi"${attr("disabled", midiLoading, true)} style="flex:1 1 240px; min-width:220px; padding:0.45rem; background:#181818; color:#fff; border:1px solid #333; border-radius:8px;"/> `);
    {
      $$renderer2.push("<!--[!-->");
      {
        $$renderer2.push("<!--[!-->");
      }
      $$renderer2.push(`<!--]-->`);
    }
    $$renderer2.push(`<!--]--></div> `);
    {
      $$renderer2.push("<!--[!-->");
    }
    $$renderer2.push(`<!--]--> `);
    {
      $$renderer2.push("<!--[!-->");
    }
    $$renderer2.push(`<!--]--></section> <section style="border:1px solid #333; border-radius:12px; padding:1.2rem; max-width:820px; margin-bottom:2rem;"><h2 style="font-size:1.2rem; margin:0 0 0.8rem 0;">Packs de frases (IndexedDB / OPFS)</h2> `);
    {
      $$renderer2.push("<!--[-->");
      $$renderer2.push(`<p style="opacity:0.7;">Inicializando almacenamiento local…</p>`);
    }
    $$renderer2.push(`<!--]--></section> <div style="border:1px solid #333; border-radius:12px; padding:1rem; max-width:720px;"><h2 style="font-size:1.2rem; margin:0 0 0.5rem 0;">Qué incluye este esqueleto</h2> <ul style="line-height:1.6;"><li>AudioWorklet con sintetizador simple (seno) y <em>scheduler</em> básico</li> <li>VitePWA: manifest &amp; service worker (instalable/offline)</li> <li>Página de prueba + controles</li></ul></div></main>`);
    if ($$store_subs) unsubscribe_stores($$store_subs);
  });
}
export {
  _page as default
};
