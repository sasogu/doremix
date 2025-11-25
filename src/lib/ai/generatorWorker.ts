/// <reference lib="webworker" />
import type { QuantizedNoteSequence } from './noteSequenceAdapters';

const CACHE_NAME = 'doremix-ai-models';
const STEPS_PER_QUARTER = 4;

// Magenta.js (TensorFlow.js) asume entorno de ventana; en Worker creamos alias mínimos.
const globalAny: any = self as any;
if (typeof globalAny.window === 'undefined') {
  globalAny.window = self;
}
if (typeof globalAny.global === 'undefined') {
  globalAny.global = self;
}
if (typeof globalAny.navigator === 'undefined') {
  globalAny.navigator = {};
}
if (typeof globalAny.performance === 'undefined') {
  globalAny.performance = self.performance;
}
// Evita que Magenta/TF intenten usar AudioContext/OfflineAudioContext en el worker.
class FakeAudioContext {
  sampleRate = 44100;
  state = 'running';
  currentTime = 0;
  destination: any;
  constructor() {
    this.destination = {
      channelCount: 2,
      channelCountMode: 'explicit',
      channelInterpretation: 'speakers',
      context: this
    };
  }
  resume() {
    return Promise.resolve();
  }
  close() {
    return Promise.resolve();
  }
  createMediaStreamDestination() {
    return this.destination;
  }
  createBuffer(channels: number, length: number, sampleRate: number) {
    this.sampleRate = sampleRate || this.sampleRate;
    return {
      numberOfChannels: channels,
      length,
      sampleRate: this.sampleRate,
      getChannelData: () => new Float32Array(length)
    };
  }
  decodeAudioData(_arrayBuffer: ArrayBuffer) {
    return Promise.reject(new Error('decodeAudioData no disponible en worker'));
  }
}

class FakeOfflineAudioContext extends FakeAudioContext {
  startRendering() {
    return Promise.reject(new Error('OfflineAudioContext no disponible en worker'));
  }
}

globalAny.AudioContext = FakeAudioContext;
globalAny.webkitAudioContext = FakeAudioContext;
globalAny.OfflineAudioContext = FakeOfflineAudioContext;
globalAny.webkitOfflineAudioContext = FakeOfflineAudioContext;
globalAny.document = globalAny.document ?? undefined;

type WorkerRequest =
  | { type: 'ping' }
  | { type: 'cancel' }
  | { type: 'load-model'; url: string; modelBase?: string; modelType: 'vae' | 'rnn' }
  | {
      type: 'generate';
      seed: QuantizedNoteSequence;
      mode: 'drum' | 'melody';
      url?: string;
      modelType: 'vae' | 'rnn';
    };

type WorkerResponse =
  | { type: 'pong' }
  | { type: 'progress'; stage: 'downloading'; loaded: number; total: number }
  | { type: 'model-loaded'; bytes: number; fromCache: boolean }
  | { type: 'generated'; sequence: QuantizedNoteSequence }
  | { type: 'cancelled' }
  | { type: 'error'; message: string };

let abortController: AbortController | null = null;
const modelCache = new Map<string, ArrayBuffer>();
let magentaPromise: Promise<typeof import('@magenta/music')> | null = null;
let vaeModel: any = null;
let vaeUrl: string | null = null;
let drumRnn: any = null;
let drumUrl: string | null = null;

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const msg = event.data;
  try {
    if (msg.type === 'ping') {
      postMessage({ type: 'pong' } satisfies WorkerResponse);
      return;
    }
    if (msg.type === 'cancel') {
      if (abortController) {
        abortController.abort();
        abortController = null;
      }
      postMessage({ type: 'cancelled' } satisfies WorkerResponse);
      return;
    }
    if (msg.type === 'load-model') {
      const modelBase = msg.modelBase ?? msg.url;
      const cached = await getCachedModel(msg.url);
      if (cached) {
        modelCache.set(msg.url, cached);
        await ensureModel(modelBase, msg.modelType);
        postMessage({
          type: 'model-loaded',
          bytes: cached.byteLength,
          fromCache: true
        } satisfies WorkerResponse);
        return;
      }
      abortController = new AbortController();
      const { buffer, total } = await fetchWithProgress(
        msg.url,
        (loaded, total) => {
          postMessage({
            type: 'progress',
            stage: 'downloading',
            loaded,
            total
          } satisfies WorkerResponse);
        },
        abortController.signal
      );
      abortController = null;
      modelCache.set(msg.url, buffer);
      await putCachedModel(msg.url, buffer);
      await ensureModel(modelBase, msg.modelType);
      postMessage({
        type: 'model-loaded',
        bytes: buffer.byteLength || total,
        fromCache: false
      } satisfies WorkerResponse);
      return;
    }
    if (msg.type === 'generate') {
      const sequence = await generateWithModel(
        msg.mode,
        msg.modelType,
        msg.seed,
        msg.url ?? vaeUrl ?? drumUrl ?? ''
      );
      postMessage({
        type: 'generated',
        sequence
      } satisfies WorkerResponse);
    }
  } catch (err) {
    const errorMessage =
      err instanceof Error
        ? err.message
        : typeof err === 'string'
        ? err
        : 'Error en el worker de IA';
    postMessage({ type: 'error', message: errorMessage } satisfies WorkerResponse);
  }
};

async function getMagenta() {
  if (!magentaPromise) {
    magentaPromise = import('@magenta/music');
  }
  return magentaPromise;
}

async function ensureMusicVae(url: string) {
  if (vaeModel && vaeUrl === url) return vaeModel;
  const mm = await getMagenta();
  // MusicVAE espera la URL base del checkpoint (directorio), no un archivo suelto.
  vaeModel = new mm.MusicVAE(url);
  await vaeModel.initialize();
  vaeUrl = url;
  return vaeModel;
}

async function ensureDrumRnn(url: string) {
  if (drumRnn && drumUrl === url) return drumRnn;
  const mm = await getMagenta();
  drumRnn = new mm.MusicRNN(url);
  await drumRnn.initialize();
  drumUrl = url;
  return drumRnn;
}

async function ensureModel(url: string, type: 'vae' | 'rnn') {
  if (type === 'vae') return ensureMusicVae(url);
  return ensureDrumRnn(url);
}

async function generateWithMusicVae(
  seed: QuantizedNoteSequence,
  url: string
): Promise<QuantizedNoteSequence> {
  const mm = await getMagenta();
  const model = await ensureMusicVae(url);
  const seedSeq = seed as unknown as any; // estructura compatible con NoteSequence cuantizado
  const outputs = await model.interpolate([seedSeq, seedSeq], 1);
  const first = Array.isArray(outputs) ? outputs[0] : outputs;
  const quantized = mm.sequences.quantizeNoteSequence(first, STEPS_PER_QUARTER);
  return quantized as QuantizedNoteSequence;
}

async function generateWithDrumRnn(
  seed: QuantizedNoteSequence,
  url: string
): Promise<QuantizedNoteSequence> {
  const mm = await getMagenta();
  const model = await ensureDrumRnn(url);
  const steps = Math.max(32, seed.totalQuantizedSteps || 16);
  const temperature = 1.1;
  const seedSeq = { ...seed } as any;
  if (!seedSeq.totalQuantizedSteps || seedSeq.totalQuantizedSteps < steps) {
    seedSeq.totalQuantizedSteps = steps;
  }
  const result = await model.continueSequence(seedSeq, steps, temperature);
  const quantized = mm.sequences.quantizeNoteSequence(result, STEPS_PER_QUARTER);
  return quantized as QuantizedNoteSequence;
}

async function generateWithModel(
  mode: 'drum' | 'melody',
  modelType: 'vae' | 'rnn',
  seed: QuantizedNoteSequence,
  url: string
): Promise<QuantizedNoteSequence> {
  if (mode === 'drum' || modelType === 'rnn') {
    return generateWithDrumRnn(seed, url);
  }
  return generateWithMusicVae(seed, url);
}

async function fetchWithProgress(
  url: string,
  onProgress: (loaded: number, total: number) => void,
  signal?: AbortSignal
): Promise<{ buffer: ArrayBuffer; total: number }> {
  const response = await fetch(url, { signal });
  if (!response.ok || !response.body) {
    throw new Error(`Fallo al descargar: ${response.status} ${response.statusText}`);
  }
  const total = Number(response.headers.get('Content-Length')) || 0;
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      loaded += value.length;
    }
    onProgress(loaded, total);
  }
  const buffer = concatenateChunks(chunks, loaded);
  return { buffer, total };
}

function concatenateChunks(chunks: Uint8Array[], length: number): ArrayBuffer {
  if (chunks.length === 1 && chunks[0].length === length) {
    return chunks[0].buffer;
  }
  const merged = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return merged.buffer;
}

async function getCachedModel(url: string): Promise<ArrayBuffer | null> {
  const inMemory = modelCache.get(url);
  if (inMemory) return inMemory;
  if (typeof caches === 'undefined') return null;
  try {
    const cache = await caches.open(CACHE_NAME);
    const match = await cache.match(url);
    if (!match) return null;
    const buffer = await match.arrayBuffer();
    return buffer;
  } catch {
    return null;
  }
}

async function putCachedModel(url: string, buffer: ArrayBuffer) {
  if (typeof caches === 'undefined') return;
  try {
    const cache = await caches.open(CACHE_NAME);
    const res = new Response(buffer.slice(0), {
      status: 200,
      statusText: 'OK',
      headers: { 'Content-Type': 'application/octet-stream' }
    });
    await cache.put(url, res);
  } catch {
    // cache put best-effort
  }
}
