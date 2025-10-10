import type { PhraseEvent } from '$lib/storage/phrasePacks';

export type SMFMetadata = {
  formatType: number;
  trackCount: number;
  ticksPerQuarter: number;
  tempoBpm?: number;
  trackNames: string[];
  durationBeats: number;
};

export type ParsedSMF = {
  metadata: SMFMetadata;
  events: PhraseEvent[];
};

export class SMFParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SMFParseError';
  }
}

const HEADER_ID = 0x4d546864; // "MThd"
const TRACK_ID = 0x4d54726b; // "MTrk"

export function parseSMF(buffer: ArrayBuffer): ParsedSMF {
  const view = new DataView(buffer);
  let offset = 0;

  const headerId = view.getUint32(offset);
  if (headerId !== HEADER_ID) {
    throw new SMFParseError('Archivo SMF inválido (cabecera incorrecta).');
  }
  offset += 4;

  const headerLength = view.getUint32(offset);
  offset += 4;
  if (headerLength !== 6) {
    throw new SMFParseError('Cabecera SMF con longitud inesperada.');
  }

  const formatType = view.getUint16(offset);
  offset += 2;
  const trackCount = view.getUint16(offset);
  offset += 2;
  const division = view.getUint16(offset);
  offset += 2;

  if (division & 0x8000) {
    throw new SMFParseError('Formato SMPTE no soportado, solo PPQ.');
  }

  const ticksPerQuarter = division;
  const events: PhraseEvent[] = [];
  const trackNames: string[] = [];
  let tempoBpm: number | undefined;
  let maxTick = 0;

  for (let trackIndex = 0; trackIndex < trackCount; trackIndex++) {
    if (offset >= view.byteLength) break;
    const chunkId = view.getUint32(offset);
    offset += 4;
    if (chunkId !== TRACK_ID) {
      throw new SMFParseError('Chunk de pista no encontrado.');
    }

    const chunkLength = view.getUint32(offset);
    offset += 4;

    const trackEnd = offset + chunkLength;
    let tick = 0;
    let runningStatus = 0;

    while (offset < trackEnd) {
      const deltaResult = readVarLength(view, offset);
      tick += deltaResult.value;
      offset = deltaResult.offset;

      const statusByte = view.getUint8(offset);
      if (statusByte >= 0x80) {
        runningStatus = statusByte;
        offset += 1;
      }

      if (runningStatus === 0xff) {
        const metaType = view.getUint8(offset);
        offset += 1;
        const lengthResult = readVarLength(view, offset);
        const length = lengthResult.value;
        offset = lengthResult.offset;
        const dataStart = offset;
        offset += length;

        if (metaType === 0x51 && length === 3) {
          const microPerQuarter =
            (view.getUint8(dataStart) << 16) |
            (view.getUint8(dataStart + 1) << 8) |
            view.getUint8(dataStart + 2);
          tempoBpm = Math.round((60_000_000 / microPerQuarter) * 100) / 100;
        } else if (metaType === 0x03) {
          const bytes = new Uint8Array(buffer, dataStart, length);
          const textDecoder = new TextDecoder();
          const name = textDecoder.decode(bytes).trim();
          if (name) trackNames.push(name);
        }
        continue;
      }

      if (runningStatus === 0xf0 || runningStatus === 0xf7) {
        const lengthResult = readVarLength(view, offset);
        const length = lengthResult.value;
        offset = lengthResult.offset + length;
        continue;
      }

      if (runningStatus === 0) {
        throw new SMFParseError('Estado MIDI inválido en el archivo.');
      }

      const eventType = runningStatus & 0xf0;
      const channel = runningStatus & 0x0f;

      switch (eventType) {
        case 0x80:
        case 0x90: {
          const note = view.getUint8(offset);
          const velocity = view.getUint8(offset + 1);
          offset += 2;
          const beat = tick / ticksPerQuarter;
          if (eventType === 0x90 && velocity !== 0) {
            events.push({
              beat,
              type: 'noteon',
              note,
              velocity: velocity / 127,
              channel
            } as PhraseEvent & { channel?: number });
          } else {
            events.push({
              beat,
              type: 'noteoff',
              note,
              channel
            } as PhraseEvent & { channel?: number });
          }
          break;
        }
        case 0xa0:
        case 0xb0:
        case 0xe0: {
          offset += 2;
          break;
        }
        case 0xc0:
        case 0xd0: {
          offset += 1;
          break;
        }
        default: {
          throw new SMFParseError('Evento MIDI desconocido.');
        }
      }

      if (tick > maxTick) maxTick = tick;
    }

    offset = trackEnd;
  }

  events.sort((a, b) => a.beat - b.beat);

  const sanitizedEvents: PhraseEvent[] = events.map((ev) => {
    const { channel, ...rest } = ev as PhraseEvent & { channel?: number };
    return rest;
  });

  const metadata: SMFMetadata = {
    formatType,
    trackCount,
    ticksPerQuarter,
    tempoBpm,
    trackNames,
    durationBeats: maxTick / ticksPerQuarter
  };

  return {
    metadata,
    events: sanitizedEvents
  };
}

function readVarLength(view: DataView, offset: number) {
  let value = 0;
  let byte = 0;
  do {
    byte = view.getUint8(offset++);
    value = (value << 7) | (byte & 0x7f);
  } while (byte & 0x80);
  return { value, offset };
}

