/// <reference lib="webworker" />
import type { QuantizedNoteSequence } from './noteSequenceAdapters';

const CACHE_NAME = 'doremix-ai-models';
const STEPS_PER_QUARTER = 4;

// Magenta.js (TensorFlow.js) asume entorno de ventana; en Worker creamos alias mínimos.
const globalAny: any = self as any;
// Evita que Magenta detecte WorkerGlobalScope y bloquee OfflineAudioContext.
globalAny.WorkerGlobalScope = undefined;
// Asegura APIs mínimas esperadas por tfjs/Magenta en entorno navegador.
globalAny.fetch = globalAny.fetch ?? self.fetch?.bind(self);
const navShim = (() => {
  try {
    return globalAny.navigator ?? {};
  } catch {
    return {};
  }
})();
if (!navShim.platform) navShim.platform = 'web';
if (!navShim.userAgent) navShim.userAgent = 'worker';
globalAny.process = globalAny.process ?? { env: {}, version: '', platform: 'browser' };
// Define un entorno tfjs básico para que env().platform tenga fetch.
if (!globalAny.__tfjsEnvironment) {
  globalAny.__tfjsEnvironment = {
    flags: {},
    platformName: 'worker',
    platform: {
      fetch: globalAny.fetch,
      now: () => (globalAny.performance?.now ? globalAny.performance.now() : Date.now()),
      encode: (s: string) => (globalAny.TextEncoder ? new TextEncoder().encode(s) : new Uint8Array([])),
      decode: (b: Uint8Array) =>
        globalAny.TextDecoder ? new TextDecoder().decode(b) : String.fromCharCode(...Array.from(b))
    }
  };
}
// Buffer shim mínimo para @magenta/music cuando Vite externaliza 'buffer'.
if (!globalAny.Buffer) {
  class FakeBuffer extends Uint8Array {
    static from(input: any): FakeBuffer {
      if (typeof input === 'string') {
        return new FakeBuffer(globalAny.TextEncoder ? new TextEncoder().encode(input) : []);
      }
      return new FakeBuffer(input ?? []);
    }
    toString(encoding = 'utf8'): string {
      if (encoding === 'utf8') {
        return globalAny.TextDecoder ? new TextDecoder().decode(this) : '';
      }
      return '';
    }
  }
  globalAny.Buffer = FakeBuffer;
}
if (!globalAny.process.hrtime) {
  // hrtime shim: devuelve [seconds, nanoseconds] aproximados usando performance.now.
  globalAny.process.hrtime = (prev?: [number, number]) => {
    const ms = globalAny.performance?.now ? globalAny.performance.now() : Date.now();
    const sec = Math.floor(ms / 1000);
    const nano = Math.floor((ms % 1000) * 1e6);
    if (!prev) return [sec, nano];
    let diffSec = sec - prev[0];
    let diffNano = nano - prev[1];
    if (diffNano < 0) {
      diffSec -= 1;
      diffNano += 1e9;
    }
    return [diffSec, diffNano];
  };
}
try {
  if (typeof globalAny.navigator === 'undefined') {
    globalAny.navigator = navShim;
  }
} catch {
  // navigator is read-only in some worker environments; ignore.
}
if (typeof globalAny.window === 'undefined') {
  globalAny.window = self;
}
if (typeof globalAny.global === 'undefined') {
  globalAny.global = self;
}
globalAny.webkitOfflineAudioContext = undefined;
if (typeof globalAny.performance === 'undefined') {
  globalAny.performance = self.performance;
}
let tfPatched = false;

async function ensureTfPlatform() {
  if (tfPatched) return;
  try {
    const tf = await import('@tensorflow/tfjs');
    const env = tf?.env?.();
    if (env) {
      const platform: any = env.platform ?? {};
      platform.fetch = platform.fetch ?? globalAny.fetch;
      platform.now =
        platform.now ??
        (() => (globalAny.performance?.now ? globalAny.performance.now() : Date.now()));
      platform.encode =
        platform.encode ??
        ((s: string) =>
          globalAny.TextEncoder ? new TextEncoder().encode(s) : new Uint8Array([]));
      platform.decode =
        platform.decode ??
        ((b: Uint8Array) =>
          globalAny.TextDecoder ? new TextDecoder().decode(b) : String.fromCharCode(...Array.from(b)));
      (env as any).platform = platform;
      (env as any).platformName = (env as any).platformName ?? 'worker';
    }
    tfPatched = true;
  } catch (err) {
    console.error('[AI worker] failed to patch tf platform', err);
  }
}
// Stub AudioParam so Tone.js / standardized-audio-context detect it.
class FakeAudioParam {
  value: number;
  defaultValue: number;
  automationRate: 'a-rate' | 'k-rate' = 'a-rate';
  constructor(value = 0) {
    this.value = value;
    this.defaultValue = value;
  }
  setValueAtTime() {}
  linearRampToValueAtTime() {}
  exponentialRampToValueAtTime() {}
  setTargetAtTime() {}
  setValueCurveAtTime() {}
  cancelScheduledValues() {}
  cancelAndHoldAtTime() {}
}
globalAny.AudioParam = FakeAudioParam;

// Evita que Magenta/TF intenten usar AudioContext/OfflineAudioContext en el worker.
class FakeAudioContext {
  sampleRate = 44100;
  state = 'running';
  currentTime = 0;
  destination: any;
  listener: any;
  rawContext: any;
  addEventListener = () => {};
  removeEventListener = () => {};
  private makeParam(initial = 0): FakeAudioParam {
    return new FakeAudioParam(initial);
  }
  private makeConnectable<T extends { connect?: any; disconnect?: any }>(node: T): T {
    node.connect = (destination?: any) => destination ?? node;
    node.disconnect = () => {};
    return node;
  }
  constructor() {
    const makeNode = (inputs = 1, outputs = 1) => ({
      numberOfInputs: inputs,
      numberOfOutputs: outputs,
      connect: () => {},
      disconnect: () => {},
      context: this,
      input: null as any,
      output: null as any
    });

    const fakeListener = {
      positionX: this.makeParam(),
      positionY: this.makeParam(),
      positionZ: this.makeParam(),
      forwardX: this.makeParam(),
      forwardY: this.makeParam(),
      forwardZ: this.makeParam(-1),
      upX: this.makeParam(),
      upY: this.makeParam(1),
      upZ: this.makeParam()
    };

    this.destination = this.makeConnectable({
      ...makeNode(1, 0),
      channelCount: 2,
      channelCountMode: 'explicit',
      channelInterpretation: 'speakers',
      context: this
    });
    this.destination.input = this.destination;
    this.destination.output = this.destination;

    this.listener = fakeListener;
    this.rawContext = this;
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
  createGain() {
    const gainNode = this.makeConnectable({
      ...{
        numberOfInputs: 1,
        numberOfOutputs: 1,
        input: null as any,
        output: null as any,
        context: this
      },
      gain: this.makeParam(1)
    });
    gainNode.input = gainNode;
    gainNode.output = gainNode;
    return gainNode;
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
  createBufferSource() {
    // Stub básico para Tone.js
    const node = this.makeConnectable({
      numberOfInputs: 0,
      numberOfOutputs: 1,
      buffer: null as any,
      loop: false,
      playbackRate: this.makeParam(1),
      start: () => {},
      stop: () => {},
      context: this
    });
    (node as any).addEventListener = () => {};
    (node as any).removeEventListener = () => {};
    return node;
  }
  createConstantSource() {
    const node = this.makeConnectable({
      numberOfInputs: 0,
      numberOfOutputs: 1,
      offset: this.makeParam(1),
      start: () => {},
      stop: () => {},
      context: this
    });
    (node as any).addEventListener = () => {};
    (node as any).removeEventListener = () => {};
    return node;
  }
  createOscillator() {
    const node = this.makeConnectable({
      numberOfInputs: 0,
      numberOfOutputs: 1,
      type: 'sine',
      frequency: this.makeParam(440),
      detune: this.makeParam(0),
      start: () => {},
      stop: () => {},
      context: this
    });
    (node as any).addEventListener = () => {};
    (node as any).removeEventListener = () => {};
    return node;
  }
  createBiquadFilter() {
    // Stub básico; Magenta solo necesita que exista.
    const node = this.makeConnectable({
      numberOfInputs: 1,
      numberOfOutputs: 1,
      input: null as any,
      output: null as any,
      type: 'lowpass',
      frequency: this.makeParam(0),
      detune: this.makeParam(0),
      Q: this.makeParam(1),
      gain: this.makeParam(0)
    });
    node.input = node;
    node.output = node;
    return node;
  }
  createPanner() {
    // Stub para Tone.js: expone parámetros de orientación/posición.
    const node = this.makeConnectable({
      numberOfInputs: 1,
      numberOfOutputs: 1,
      input: null as any,
      output: null as any,
      panningModel: 'equalpower',
      maxDistance: 1,
      distanceModel: 'inverse',
      coneOuterGain: 0,
      coneOuterAngle: 360,
      coneInnerAngle: 360,
      refDistance: 1,
      rolloffFactor: 1,
      positionX: this.makeParam(),
      positionY: this.makeParam(),
      positionZ: this.makeParam(),
      orientationX: this.makeParam(),
      orientationY: this.makeParam(),
      orientationZ: this.makeParam()
    });
    node.input = node;
    node.output = node;
    return node;
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
    console.debug('[AI worker] mensaje recibido', msg);
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
      console.debug('[AI worker] iniciando generación', msg.mode, msg.modelType);
    const sequence = await generateWithModel(
      msg.mode,
      msg.modelType,
      msg.seed,
      msg.url ?? vaeUrl ?? drumUrl ?? ''
    );
    let normalized = normalizeQuantizedSequence(sequence);
    if (msg.mode === 'drum') {
      const minSteps = 128;
      normalized = tileQuantizedSequence(normalized, minSteps, 2);
      normalized.totalQuantizedSteps = Math.max(normalized.totalQuantizedSteps ?? 0, minSteps);
    }
    console.debug('[AI worker] generación completada, enviando al main thread', {
      notes: normalized.notes.length,
      totalQuantizedSteps: normalized.totalQuantizedSteps
    });
    postMessage({
      type: 'generated',
      sequence: normalized
    } satisfies WorkerResponse);
  }
} catch (err) {
    const errorMessage =
      err instanceof Error
        ? err.message
        : typeof err === 'string'
        ? err
        : 'Error en el worker de IA';
    // Debug adicional en consola del worker para diagnosticar issues de AudioParam/contexts.
    console.error('[AI worker] error:', errorMessage, err);
    postMessage({ type: 'error', message: errorMessage } satisfies WorkerResponse);
  }
};

async function getMagenta() {
  if (!magentaPromise) {
    await ensureTfPlatform();
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
  // Usamos sample directo para obtener una frase más rica que la interpolación neutra.
  const temperature = 1.1;
  const outputs = await model.sample(1, temperature);
  const first = Array.isArray(outputs) ? outputs[0] : outputs;
  const isAlreadyQuantized = !!first?.quantizationInfo?.stepsPerQuarter;
  const seq = isAlreadyQuantized
    ? (first as QuantizedNoteSequence)
    : (mm.sequences.quantizeNoteSequence(first, STEPS_PER_QUARTER) as QuantizedNoteSequence);
  return seq;
}

async function generateWithDrumRnn(
  seed: QuantizedNoteSequence,
  url: string
): Promise<QuantizedNoteSequence> {
  const mm = await getMagenta();
  const model = await ensureDrumRnn(url);
  const steps = 128;
  const temperature = 1.3;
  const seedSeq = { ...seed } as any;
  seedSeq.totalQuantizedSteps = steps;
  let result: any;
  try {
    // sample sin seed para obtener patrones más diversos y largos
    result = await model.sample(1, temperature);
    if (Array.isArray(result)) {
      result = result[0];
    }
  } catch {
    result = await model.continueSequence(seedSeq, steps, temperature);
  }
  const quantized = mm.sequences.quantizeNoteSequence(result, STEPS_PER_QUARTER);
  quantized.totalQuantizedSteps = Math.max(quantized.totalQuantizedSteps ?? 0, steps);
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

function normalizeQuantizedSequence(seq: QuantizedNoteSequence): QuantizedNoteSequence {
  const stepsPerQuarter = seq.quantizationInfo?.stepsPerQuarter || STEPS_PER_QUARTER;
  let maxStep = 0;
  const notes = seq.notes.map((n) => {
    const start = Math.max(0, n.quantizedStartStep ?? 0);
    const endRaw = n.quantizedEndStep ?? start + 1;
    const end = endRaw > start ? endRaw : start + 1;
    if (end > maxStep) maxStep = end;
    return { ...n, quantizedStartStep: start, quantizedEndStep: end };
  });
  return {
    ...seq,
    notes,
    quantizationInfo: { stepsPerQuarter },
    totalQuantizedSteps: maxStep,
    tempos:
      seq.tempos?.length && seq.tempos[0]?.qpm
        ? seq.tempos
        : [{ time: 0, qpm: seq.tempos?.[0]?.qpm ?? 120 }]
  };
}

function tileQuantizedSequence(
  seq: QuantizedNoteSequence,
  targetSteps: number,
  maxRepeats = 4
): QuantizedNoteSequence {
  const stepSpan = seq.totalQuantizedSteps ?? 0;
  if (stepSpan <= 0) return seq;
  const repeats = Math.min(maxRepeats, Math.max(1, Math.ceil(targetSteps / stepSpan)));
  if (repeats <= 1) return seq;
  const tiledNotes = [];
  for (let r = 0; r < repeats; r++) {
    const offset = r * stepSpan;
    for (const n of seq.notes) {
      tiledNotes.push({
        ...n,
        quantizedStartStep: (n.quantizedStartStep ?? 0) + offset,
        quantizedEndStep: (n.quantizedEndStep ?? 0) + offset
      });
    }
  }
  return {
    ...seq,
    notes: tiledNotes,
    totalQuantizedSteps: stepSpan * repeats
  };
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
