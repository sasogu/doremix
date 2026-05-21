import type { PhraseEvent } from '$lib/storage/phrasePacks';

const TICKS_PER_QUARTER = 480;

export function exportSMF(
  tracks: { name: string; channel: number; events: PhraseEvent[] }[],
  bpm: number,
  fileName = 'doremix-export'
): void {
  const buffer = buildSMFBuffer(tracks, bpm);
  const blob = new Blob([buffer], { type: 'audio/midi' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${fileName}.mid`;
  a.click();
  URL.revokeObjectURL(url);
}

function buildSMFBuffer(
  tracks: { name: string; channel: number; events: PhraseEvent[] }[],
  bpm: number
): ArrayBuffer {
  const microPerQuarter = Math.round(60_000_000 / bpm);
  const trackChunks: Uint8Array[] = [];

  // Pista 0: tempo y nombres globales
  const tempoTrack = buildTempoTrack(microPerQuarter);
  trackChunks.push(tempoTrack);

  for (const track of tracks) {
    if (!track.events.length) continue;
    trackChunks.push(buildNoteTrack(track.name, track.channel, track.events));
  }

  const headerChunk = buildHeaderChunk(1, trackChunks.length, TICKS_PER_QUARTER);
  const totalSize = headerChunk.length + trackChunks.reduce((s, c) => s + c.length, 0);
  const out = new Uint8Array(totalSize);
  let pos = 0;
  out.set(headerChunk, pos);
  pos += headerChunk.length;
  for (const chunk of trackChunks) {
    out.set(chunk, pos);
    pos += chunk.length;
  }
  return out.buffer;
}

function buildHeaderChunk(format: number, numTracks: number, tpq: number): Uint8Array {
  const buf = new Uint8Array(14);
  const view = new DataView(buf.buffer);
  // MThd
  view.setUint32(0, 0x4d546864);
  view.setUint32(4, 6);
  view.setUint16(8, format);
  view.setUint16(10, numTracks);
  view.setUint16(12, tpq);
  return buf;
}

function buildTempoTrack(microPerQuarter: number): Uint8Array {
  const events: number[] = [];
  // delta=0, meta tempo
  events.push(0x00, 0xff, 0x51, 0x03);
  events.push((microPerQuarter >> 16) & 0xff, (microPerQuarter >> 8) & 0xff, microPerQuarter & 0xff);
  // delta=0, end of track
  events.push(0x00, 0xff, 0x2f, 0x00);
  return wrapInTrackChunk(new Uint8Array(events));
}

function buildNoteTrack(
  name: string,
  channel: number,
  events: PhraseEvent[]
): Uint8Array {
  const ch = channel & 0x0f;
  const bytes: number[] = [];

  // Track name meta event
  const nameBytes = new TextEncoder().encode(name);
  bytes.push(0x00, 0xff, 0x03);
  pushVarLen(bytes, nameBytes.length);
  nameBytes.forEach((b) => bytes.push(b));

  // Collect noteon/noteoff sorted by beat
  const sorted = [...events].sort((a, b) => {
    if (a.beat !== b.beat) return a.beat - b.beat;
    return a.type === 'noteoff' ? -1 : 1;
  });

  let prevTick = 0;
  for (const ev of sorted) {
    const tick = Math.round(ev.beat * TICKS_PER_QUARTER);
    const delta = Math.max(0, tick - prevTick);
    prevTick = tick;
    pushVarLen(bytes, delta);
    if (ev.type === 'noteon') {
      const vel = Math.round(Math.max(0, Math.min(1, ev.velocity ?? 0.8)) * 127);
      bytes.push(0x90 | ch, ev.note & 0x7f, vel);
    } else {
      bytes.push(0x80 | ch, ev.note & 0x7f, 0x00);
    }
  }

  // End of track
  bytes.push(0x00, 0xff, 0x2f, 0x00);
  return wrapInTrackChunk(new Uint8Array(bytes));
}

function wrapInTrackChunk(data: Uint8Array): Uint8Array {
  const out = new Uint8Array(8 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, 0x4d54726b); // MTrk
  view.setUint32(4, data.length);
  out.set(data, 8);
  return out;
}

function pushVarLen(buf: number[], value: number): void {
  if (value < 0x80) {
    buf.push(value);
    return;
  }
  const tmp: number[] = [];
  tmp.push(value & 0x7f);
  let v = value >> 7;
  while (v > 0) {
    tmp.push((v & 0x7f) | 0x80);
    v >>= 7;
  }
  for (let i = tmp.length - 1; i >= 0; i--) {
    buf.push(tmp[i]);
  }
}
