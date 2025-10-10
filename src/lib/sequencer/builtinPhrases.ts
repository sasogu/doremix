import type { Phrase, PhraseEvent } from '$lib/storage/phrasePacks';

export type PhraseCategory = 'perc' | 'bass' | 'chords' | 'melody' | 'fx';

export type BuiltinPhrase = {
  key: string;
  name: string;
  description?: string;
  category: PhraseCategory | 'any';
  phrase: Phrase;
};

function makePhrase(id: string, name: string, events: PhraseEvent[]): Phrase {
  return {
    id,
    name,
    bpm: 120,
    events
  };
}

const percClassicEvents: PhraseEvent[] = [
  { beat: 0, type: 'noteon', note: 36, velocity: 1 },
  { beat: 0.25, type: 'noteon', note: 42, velocity: 0.8 },
  { beat: 0.5, type: 'noteon', note: 38, velocity: 0.9 },
  { beat: 0.75, type: 'noteon', note: 42, velocity: 0.8 },
  { beat: 1, type: 'noteon', note: 36, velocity: 1 },
  { beat: 1.25, type: 'noteon', note: 42, velocity: 0.8 },
  { beat: 1.5, type: 'noteon', note: 38, velocity: 0.9 },
  { beat: 1.75, type: 'noteon', note: 46, velocity: 0.8 },
  { beat: 2, type: 'noteon', note: 36, velocity: 1 },
  { beat: 2.25, type: 'noteon', note: 42, velocity: 0.8 },
  { beat: 2.5, type: 'noteon', note: 38, velocity: 0.9 },
  { beat: 2.75, type: 'noteon', note: 42, velocity: 0.8 },
  { beat: 3, type: 'noteon', note: 36, velocity: 1 },
  { beat: 3.25, type: 'noteon', note: 44, velocity: 0.7 },
  { beat: 3.5, type: 'noteon', note: 38, velocity: 0.9 },
  { beat: 3.75, type: 'noteon', note: 46, velocity: 0.8 },
  // noteoff events to keep envelope tidy
  { beat: 0.01, type: 'noteoff', note: 36 },
  { beat: 0.26, type: 'noteoff', note: 42 },
  { beat: 0.51, type: 'noteoff', note: 38 },
  { beat: 0.76, type: 'noteoff', note: 42 },
  { beat: 1.01, type: 'noteoff', note: 36 },
  { beat: 1.26, type: 'noteoff', note: 42 },
  { beat: 1.51, type: 'noteoff', note: 38 },
  { beat: 1.76, type: 'noteoff', note: 46 },
  { beat: 2.01, type: 'noteoff', note: 36 },
  { beat: 2.26, type: 'noteoff', note: 42 },
  { beat: 2.51, type: 'noteoff', note: 38 },
  { beat: 2.76, type: 'noteoff', note: 42 },
  { beat: 3.01, type: 'noteoff', note: 36 },
  { beat: 3.26, type: 'noteoff', note: 44 },
  { beat: 3.51, type: 'noteoff', note: 38 },
  { beat: 3.76, type: 'noteoff', note: 46 }
];

const percHalfTimeEvents: PhraseEvent[] = [
  { beat: 0, type: 'noteon', note: 36, velocity: 1 },
  { beat: 0.5, type: 'noteon', note: 42, velocity: 0.8 },
  { beat: 1, type: 'noteon', note: 38, velocity: 0.9 },
  { beat: 1.5, type: 'noteon', note: 46, velocity: 0.8 },
  { beat: 2, type: 'noteon', note: 36, velocity: 1 },
  { beat: 2.5, type: 'noteon', note: 42, velocity: 0.8 },
  { beat: 3, type: 'noteon', note: 38, velocity: 0.9 },
  { beat: 3.5, type: 'noteon', note: 46, velocity: 0.8 },
  { beat: 0.05, type: 'noteoff', note: 36 },
  { beat: 0.55, type: 'noteoff', note: 42 },
  { beat: 1.05, type: 'noteoff', note: 38 },
  { beat: 1.55, type: 'noteoff', note: 46 },
  { beat: 2.05, type: 'noteoff', note: 36 },
  { beat: 2.55, type: 'noteoff', note: 42 },
  { beat: 3.05, type: 'noteoff', note: 38 },
  { beat: 3.55, type: 'noteoff', note: 46 }
];

const bassPulseEvents: PhraseEvent[] = [
  { beat: 0, type: 'noteon', note: 36, velocity: 0.9 },
  { beat: 1, type: 'noteon', note: 38, velocity: 0.8 },
  { beat: 2, type: 'noteon', note: 41, velocity: 0.8 },
  { beat: 3, type: 'noteon', note: 43, velocity: 0.9 },
  { beat: 0.9, type: 'noteoff', note: 36 },
  { beat: 1.9, type: 'noteoff', note: 38 },
  { beat: 2.9, type: 'noteoff', note: 41 },
  { beat: 3.9, type: 'noteoff', note: 43 }
];

const bassSyncopatedEvents: PhraseEvent[] = [
  { beat: 0, type: 'noteon', note: 36, velocity: 0.9 },
  { beat: 0.75, type: 'noteon', note: 43, velocity: 0.8 },
  { beat: 1.5, type: 'noteon', note: 38, velocity: 0.9 },
  { beat: 2.25, type: 'noteon', note: 41, velocity: 0.85 },
  { beat: 3, type: 'noteon', note: 43, velocity: 0.9 },
  { beat: 0.65, type: 'noteoff', note: 36 },
  { beat: 1.4, type: 'noteoff', note: 43 },
  { beat: 2.15, type: 'noteoff', note: 38 },
  { beat: 2.9, type: 'noteoff', note: 41 },
  { beat: 3.65, type: 'noteoff', note: 43 }
];

const chordsBlockEvents: PhraseEvent[] = [
  { beat: 0, type: 'noteon', note: 60, velocity: 0.8 },
  { beat: 0, type: 'noteon', note: 64, velocity: 0.8 },
  { beat: 0, type: 'noteon', note: 67, velocity: 0.8 },
  { beat: 2, type: 'noteon', note: 62, velocity: 0.8 },
  { beat: 2, type: 'noteon', note: 65, velocity: 0.8 },
  { beat: 2, type: 'noteon', note: 69, velocity: 0.8 },
  { beat: 1.95, type: 'noteoff', note: 60 },
  { beat: 1.95, type: 'noteoff', note: 64 },
  { beat: 1.95, type: 'noteoff', note: 67 },
  { beat: 3.95, type: 'noteoff', note: 62 },
  { beat: 3.95, type: 'noteoff', note: 65 },
  { beat: 3.95, type: 'noteoff', note: 69 }
];

const chordsRhythmEvents: PhraseEvent[] = [
  { beat: 0, type: 'noteon', note: 60, velocity: 0.75 },
  { beat: 0, type: 'noteon', note: 64, velocity: 0.75 },
  { beat: 0, type: 'noteon', note: 67, velocity: 0.75 },
  { beat: 1, type: 'noteon', note: 60, velocity: 0.7 },
  { beat: 1.5, type: 'noteon', note: 64, velocity: 0.7 },
  { beat: 2, type: 'noteon', note: 65, velocity: 0.75 },
  { beat: 2, type: 'noteon', note: 69, velocity: 0.75 },
  { beat: 3, type: 'noteon', note: 65, velocity: 0.7 },
  { beat: 3.5, type: 'noteon', note: 69, velocity: 0.7 },
  { beat: 0.8, type: 'noteoff', note: 60 },
  { beat: 0.8, type: 'noteoff', note: 64 },
  { beat: 0.8, type: 'noteoff', note: 67 },
  { beat: 1.8, type: 'noteoff', note: 60 },
  { beat: 1.8, type: 'noteoff', note: 64 },
  { beat: 2.8, type: 'noteoff', note: 65 },
  { beat: 2.8, type: 'noteoff', note: 69 },
  { beat: 3.8, type: 'noteoff', note: 65 },
  { beat: 3.8, type: 'noteoff', note: 69 }
];

const leadArpEvents: PhraseEvent[] = [
  { beat: 0, type: 'noteon', note: 72, velocity: 0.85 },
  { beat: 0.5, type: 'noteon', note: 76, velocity: 0.8 },
  { beat: 1, type: 'noteon', note: 79, velocity: 0.8 },
  { beat: 1.5, type: 'noteon', note: 83, velocity: 0.85 },
  { beat: 2, type: 'noteon', note: 79, velocity: 0.85 },
  { beat: 2.5, type: 'noteon', note: 76, velocity: 0.8 },
  { beat: 3, type: 'noteon', note: 72, velocity: 0.8 },
  { beat: 3.5, type: 'noteon', note: 76, velocity: 0.85 },
  { beat: 0.35, type: 'noteoff', note: 72 },
  { beat: 0.85, type: 'noteoff', note: 76 },
  { beat: 1.35, type: 'noteoff', note: 79 },
  { beat: 1.85, type: 'noteoff', note: 83 },
  { beat: 2.35, type: 'noteoff', note: 79 },
  { beat: 2.85, type: 'noteoff', note: 76 },
  { beat: 3.35, type: 'noteoff', note: 72 },
  { beat: 3.85, type: 'noteoff', note: 76 }
];

const leadCounterEvents: PhraseEvent[] = [
  { beat: 0.25, type: 'noteon', note: 74, velocity: 0.8 },
  { beat: 0.75, type: 'noteon', note: 77, velocity: 0.8 },
  { beat: 1.25, type: 'noteon', note: 79, velocity: 0.8 },
  { beat: 1.75, type: 'noteon', note: 81, velocity: 0.8 },
  { beat: 2.25, type: 'noteon', note: 79, velocity: 0.8 },
  { beat: 2.75, type: 'noteon', note: 77, velocity: 0.8 },
  { beat: 3.25, type: 'noteon', note: 74, velocity: 0.8 },
  { beat: 3.75, type: 'noteon', note: 72, velocity: 0.8 },
  { beat: 0.6, type: 'noteoff', note: 74 },
  { beat: 1.1, type: 'noteoff', note: 77 },
  { beat: 1.6, type: 'noteoff', note: 79 },
  { beat: 2.1, type: 'noteoff', note: 81 },
  { beat: 2.6, type: 'noteoff', note: 79 },
  { beat: 3.1, type: 'noteoff', note: 77 },
  { beat: 3.6, type: 'noteoff', note: 74 },
  { beat: 4.1, type: 'noteoff', note: 72 }
];

export const builtinPhrases: BuiltinPhrase[] = [
  {
    key: 'perc-classic',
    name: 'Percusión 4/4',
    description: 'Kick, caja y hats clásicos house.',
    category: 'perc',
    phrase: makePhrase('builtin-perc-classic', 'Percusión 4/4', percClassicEvents)
  },
  {
    key: 'perc-halftime',
    name: 'Percusión halftime',
    description: 'Bombo firme y caja a contratiempos.',
    category: 'perc',
    phrase: makePhrase('builtin-perc-halftime', 'Percusión halftime', percHalfTimeEvents)
  },
  {
    key: 'bass-pulse',
    name: 'Bajo pulsante',
    description: 'Notas graves en negras.',
    category: 'bass',
    phrase: makePhrase('builtin-bass-pulse', 'Bajo pulsante', bassPulseEvents)
  },
  {
    key: 'bass-syncopated',
    name: 'Bajo sincopado',
    description: 'Movimiento en síncopas.',
    category: 'bass',
    phrase: makePhrase('builtin-bass-sync', 'Bajo sincopado', bassSyncopatedEvents)
  },
  {
    key: 'chords-blocks',
    name: 'Acordes alternos',
    description: 'Bloques largos a dos compases.',
    category: 'chords',
    phrase: makePhrase('builtin-chords-blocks', 'Acordes alternos', chordsBlockEvents)
  },
  {
    key: 'chords-rhythm',
    name: 'Acordes rítmicos',
    description: 'Patrón con stabs en corcheas.',
    category: 'chords',
    phrase: makePhrase('builtin-chords-rhythm', 'Acordes rítmicos', chordsRhythmEvents)
  },
  {
    key: 'lead-arp',
    name: 'Lead arpegio',
    description: 'Arpegio ascendente/descendente.',
    category: 'melody',
    phrase: makePhrase('builtin-lead-arp', 'Lead arpegio', leadArpEvents)
  },
  {
    key: 'lead-counter',
    name: 'Lead contrapunto',
    description: 'Respuesta melódica en síncopas.',
    category: 'melody',
    phrase: makePhrase('builtin-lead-counter', 'Lead contrapunto', leadCounterEvents)
  }
];

export function getBuiltinPhraseByKey(key: string) {
  return builtinPhrases.find((entry) => entry.key === key) ?? null;
}

