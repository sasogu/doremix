import type { Phrase, PhraseEvent } from '$lib/storage/phrasePacks';

export type QuantizedNote = {
  pitch: number;
  velocity: number;
  quantizedStartStep: number;
  quantizedEndStep: number;
  isDrum?: boolean;
  instrument?: number;
  program?: number;
};

export type QuantizedNoteSequence = {
  notes: QuantizedNote[];
  quantizationInfo: { stepsPerQuarter: number };
  tempos: { time: number; qpm: number }[];
  totalQuantizedSteps: number;
};

const STEPS_PER_QUARTER = 4; // negra = 4 pasos; 1 compás (4/4) = 16 pasos

export function phraseToQuantizedSequence(phrase: Phrase): QuantizedNoteSequence {
  const bpm = phrase.bpm ?? 120;
  const stepsPerBeat = STEPS_PER_QUARTER;
  const sorted = [...phrase.events].sort((a, b) => {
    if (a.beat === b.beat) {
      if (a.type === b.type) return a.note - b.note;
      return a.type === 'noteoff' ? 1 : -1;
    }
    return a.beat - b.beat;
  });

  const activeStarts = new Map<number, number>();
  const notes: QuantizedNote[] = [];

  for (const ev of sorted) {
    const step = Math.max(0, Math.round(ev.beat * stepsPerBeat));
    if (ev.type === 'noteon') {
      activeStarts.set(ev.note, step);
      continue;
    }
    const start = activeStarts.get(ev.note);
    if (start === undefined) continue;
    const end = Math.max(step, start + 1);
    notes.push({
      pitch: ev.note,
      velocity: Math.round((ev.velocity ?? 0.8) * 127),
      quantizedStartStep: start,
      quantizedEndStep: end
    });
    activeStarts.delete(ev.note);
  }

  // Cierra notas colgantes con una duración mínima de 1 beat
  const defaultDuration = stepsPerBeat;
  for (const [note, start] of activeStarts.entries()) {
    notes.push({
      pitch: note,
      velocity: 100,
      quantizedStartStep: start,
      quantizedEndStep: start + defaultDuration
    });
  }

  const totalQuantizedSteps = notes.reduce(
    (max, n) => Math.max(max, n.quantizedEndStep),
    0
  );

  return {
    notes,
    quantizationInfo: { stepsPerQuarter: STEPS_PER_QUARTER },
    tempos: [{ time: 0, qpm: bpm }],
    totalQuantizedSteps
  };
}

export function quantizedSequenceToPhrase(
  sequence: QuantizedNoteSequence,
  name = 'Frase generada'
): Phrase {
  const stepsPerBeat = sequence.quantizationInfo.stepsPerQuarter || STEPS_PER_QUARTER;
  const bpm = sequence.tempos?.[0]?.qpm ?? 120;
  const events: PhraseEvent[] = [];

  for (const note of sequence.notes) {
    const startBeat = note.quantizedStartStep / stepsPerBeat;
    const endBeat = note.quantizedEndStep / stepsPerBeat;
    events.push({
      beat: startBeat,
      type: 'noteon',
      note: note.pitch,
      velocity: Math.max(0, Math.min(1, (note.velocity ?? 100) / 127))
    });
    events.push({
      beat: endBeat,
      type: 'noteoff',
      note: note.pitch
    });
  }

  events.sort((a, b) => {
    if (a.beat === b.beat) {
      if (a.type === b.type) return a.note - b.note;
      return a.type === 'noteoff' ? 1 : -1;
    }
    return a.beat - b.beat;
  });

  return {
    id: crypto.randomUUID(),
    name,
    bpm,
    events
  };
}
