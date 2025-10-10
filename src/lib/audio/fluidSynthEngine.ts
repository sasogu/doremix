import { browser } from '$app/environment';
import type { PhraseEvent } from '$lib/storage/phrasePacks';

export type FluidSynthStatus = {
  ready: boolean;
  soundFontLoaded: boolean;
  soundFontName?: string;
  lastError?: string | null;
};

type FluidSynthOptions = {
  scriptUrl?: string;
  wasmUrl?: string;
  defaultSoundFontUrl?: string | null;
  blockSize?: number;
};

type FluidSynthFunctions = {
  newSettings: () => number;
  deleteSettings: (ptr: number) => void;
  newSynth: (settingsPtr: number) => number;
  deleteSynth: (synthPtr: number) => void;
  setNum: (settingsPtr: number, key: string, value: number) => number;
  setInt?: (settingsPtr: number, key: string, value: number) => number;
  setStr?: (settingsPtr: number, key: string, value: string) => number;
  sfload: (synthPtr: number, path: string, resetPresets: number) => number;
  sfunload?: (synthPtr: number, sfId: number, resetPresets: number) => number;
  noteOn: (synthPtr: number, channel: number, note: number, velocity: number) => number;
  noteOff: (synthPtr: number, channel: number, note: number) => number;
  allNotesOff?: (synthPtr: number, channel: number) => number;
  programSelect?: (
    synthPtr: number,
    channel: number,
    soundFontId: number,
    bank: number,
    preset: number
  ) => number;
  programReset?: (synthPtr: number) => number;
  systemReset?: (synthPtr: number) => number;
  controlChange?: (synthPtr: number, channel: number, control: number, value: number) => number;
  writeFloat: (
    synthPtr: number,
    length: number,
    leftPtr: number,
    leftOffset: number,
    leftInc: number,
    rightPtr: number,
    rightOffset: number,
    rightInc: number
  ) => number;
};

type SoundFontInfo = {
  id: number;
  path: string;
  name: string;
};

type CWrapFunction = (ident: string, returnType: string, argTypes: string[]) => (...args: any[]) => any;

type FluidSynthModule = {
  cwrap: CWrapFunction;
  _malloc: (size: number) => number;
  _free: (ptr: number) => void;
  HEAPF32: Float32Array;
  FS_createPath: (parent: string, name: string, canRead: boolean, canWrite: boolean) => void;
  FS_createDataFile: (
    parent: string,
    name: string,
    data: Uint8Array,
    canRead: boolean,
    canWrite: boolean,
    canOwn?: boolean
  ) => void;
  FS_unlink?: (path: string) => void;
  ready?: Promise<unknown>;
};

const DEFAULT_SCRIPT_URL = '/fluidsynth/fluidsynth.js';
const DEFAULT_WASM_URL = '/fluidsynth/fluidsynth.wasm';

type TimerHandle = ReturnType<typeof setTimeout>;

export class FluidSynthEngine {
  private readonly audioContext: AudioContext;
  private readonly options: FluidSynthOptions;
  private module: FluidSynthModule | null = null;
  private functions: FluidSynthFunctions | null = null;
  private settingsPtr: number | null = null;
  private synthPtr: number | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private initialized = false;
  private initializing: Promise<void> | null = null;
  private scriptLoaded: Promise<void> | null = null;
  private status: FluidSynthStatus = {
    ready: false,
    soundFontLoaded: false,
    lastError: null
  };
  private soundFontInfo: SoundFontInfo | null = null;
  private soundFontsPath = '/soundfonts';
  private fsReady = false;
  private blockSize: number;
  private leftPtr: number | null = null;
  private rightPtr: number | null = null;
  private isRendering = false;
  private isPlaying = false;
  private pendingTimers: TimerHandle[] = [];
  private channel = 0;

  constructor(audioContext: AudioContext, options: FluidSynthOptions = {}) {
    this.audioContext = audioContext;
    this.options = options;
    this.blockSize = options.blockSize ?? 256;
  }

  getStatus(): FluidSynthStatus {
    return { ...this.status };
  }

  getSoundFontName(): string | undefined {
    return this.soundFontInfo?.name;
  }

  async ensureInitialized(): Promise<void> {
    if (!browser) {
      throw new Error('FluidSynth solo está disponible en el entorno del navegador.');
    }
    if (this.initialized) return;
    if (this.initializing) return this.initializing;
    this.initializing = this.initializeInternal();
    try {
      await this.initializing;
    } finally {
      this.initializing = null;
    }
  }

  async loadSoundFontFromFile(file: File) {
    const arrayBuffer = await file.arrayBuffer();
    await this.loadSoundFontFromBuffer(arrayBuffer, file.name);
  }

  async loadSoundFontFromUrl(url: string, nameHint = 'gm.sf2') {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`No se pudo descargar el SoundFont desde ${url}`);
    }
    const buffer = await response.arrayBuffer();
    await this.loadSoundFontFromBuffer(buffer, nameHint);
  }

  async playClip(events: PhraseEvent[], bpm: number): Promise<number> {
    await this.ensureInitialized();
    if (!this.soundFontInfo) {
      throw new Error('Carga un SoundFont GM (.sf2) antes de reproducir.');
    }
    if (!this.functions || this.synthPtr === null) {
      throw new Error('FluidSynth no está listo.');
    }

    await this.stop();
    this.isRendering = true;
    this.isPlaying = true;
    this.renderMore(8);

    const secPerBeat = 60 / bpm;
    const startTime = this.audioContext.currentTime + 0.1;

    for (const event of events) {
      const dueTime = startTime + event.beat * secPerBeat;
      const delayMs = Math.max(0, (dueTime - this.audioContext.currentTime) * 1000);
      const handle = setTimeout(() => {
        if (!this.isPlaying || this.synthPtr === null || !this.functions) return;
        if (event.type === 'noteon') {
          const velocity = Math.max(0, Math.min(1, event.velocity ?? 0.8));
          this.functions.noteOn(this.synthPtr, this.channel, event.note, Math.round(velocity * 127));
        } else if (event.type === 'noteoff') {
          this.functions.noteOff(this.synthPtr, this.channel, event.note);
        }
      }, delayMs);
      this.pendingTimers.push(handle);
    }

    return startTime;
  }

  async stop() {
    this.isPlaying = false;
    this.pendingTimers.forEach((timer) => clearTimeout(timer));
    this.pendingTimers = [];

    if (this.functions && this.synthPtr !== null) {
      if (this.functions.allNotesOff) {
        for (let ch = 0; ch < 16; ch++) {
          this.functions.allNotesOff(this.synthPtr, ch);
        }
      } else {
        // fallback: CC 123 (all notes off)
        if (this.functions.controlChange) {
          for (let ch = 0; ch < 16; ch++) {
            this.functions.controlChange(this.synthPtr, ch, 123, 0);
          }
        }
      }
    }

    if (this.workletNode) {
      this.workletNode.port.postMessage({ type: 'flush' });
    }
    this.isRendering = false;
  }

  dispose() {
    this.stop();
    if (this.workletNode) {
      try {
        this.workletNode.disconnect();
      } catch {
        // ignore
      }
      this.workletNode = null;
    }
    if (this.module && this.leftPtr !== null) {
      this.module._free(this.leftPtr);
      this.leftPtr = null;
    }
    if (this.module && this.rightPtr !== null) {
      this.module._free(this.rightPtr);
      this.rightPtr = null;
    }
    if (this.functions) {
      if (this.synthPtr !== null) {
        try {
          this.functions.deleteSynth(this.synthPtr);
        } catch {
          // ignore
        }
        this.synthPtr = null;
      }
      if (this.settingsPtr !== null) {
        try {
          this.functions.deleteSettings(this.settingsPtr);
        } catch {
          // ignore
        }
        this.settingsPtr = null;
      }
    }
    this.initialized = false;
  }

  private async initializeInternal() {
    try {
      await this.ensureWorklet();
      await this.ensureModule();
      this.setupSynth();
      this.status.ready = true;
      this.status.lastError = null;
      this.initialized = true;
    } catch (err) {
      const message = (err as Error).message ?? 'Error inicializando FluidSynth.';
      this.status.lastError = message;
      throw err;
    }
  }

  private async ensureWorklet() {
    if (this.workletNode) return;
    await this.audioContext.audioWorklet.addModule('/fluid-render.worklet.js');
    this.workletNode = new AudioWorkletNode(this.audioContext, 'fluid-renderer', {
      numberOfOutputs: 1,
      outputChannelCount: [2]
    });
    this.workletNode.port.onmessage = (event) => {
      const data = event.data || {};
      if (data.type === 'need-audio') {
        if (this.isRendering) {
          this.renderMore(6);
        }
      }
    };
    this.workletNode.connect(this.audioContext.destination);
  }

  private async ensureModule() {
    if (this.module) return this.module;
    if (!this.scriptLoaded) {
      this.scriptLoaded = loadFluidSynthScript(this.options.scriptUrl ?? DEFAULT_SCRIPT_URL);
    }
    await this.scriptLoaded;

    const module = await instantiateFluidSynthModule({
      scriptUrl: this.options.scriptUrl ?? DEFAULT_SCRIPT_URL,
      wasmUrl: this.options.wasmUrl ?? DEFAULT_WASM_URL
    });

    if (module.ready && typeof module.ready.then === 'function') {
      await module.ready;
    }

    this.module = module as FluidSynthModule;
    return this.module;
  }

  private setupSynth() {
    if (!this.module) {
      throw new Error('Módulo FluidSynth no disponible.');
    }
    const wrap = (name: string, returnType: string, argTypes: string[]) => {
      try {
        return this.module!.cwrap(name, returnType, argTypes);
      } catch (err) {
        throw new Error(`No se pudo enlazar la función ${name}. Asegúrate de exportarla al compilar FluidSynth.`);
      }
    };

    this.functions = {
      newSettings: wrap('new_fluid_settings', 'number', []),
      deleteSettings: wrap('delete_fluid_settings', 'void', ['number']),
      newSynth: wrap('new_fluid_synth', 'number', ['number']),
      deleteSynth: wrap('delete_fluid_synth', 'void', ['number']),
      setNum: wrap('fluid_settings_setnum', 'number', ['number', 'string', 'number']),
      setInt: safeWrap(this.module, 'fluid_settings_setint', 'number', ['number', 'string', 'number']),
      setStr: safeWrap(this.module, 'fluid_settings_setstr', 'number', ['number', 'string', 'string']),
      sfload: wrap('fluid_synth_sfload', 'number', ['number', 'string', 'number']),
      sfunload: safeWrap(this.module, 'fluid_synth_sfunload', 'number', ['number', 'number', 'number']),
      noteOn: wrap('fluid_synth_noteon', 'number', ['number', 'number', 'number', 'number']),
      noteOff: wrap('fluid_synth_noteoff', 'number', ['number', 'number', 'number']),
      allNotesOff: safeWrap(this.module, 'fluid_synth_all_notes_off', 'number', ['number', 'number']),
      programSelect: safeWrap(this.module, 'fluid_synth_program_select', 'number', ['number', 'number', 'number', 'number', 'number']),
      programReset: safeWrap(this.module, 'fluid_synth_program_reset', 'number', ['number']),
      systemReset: safeWrap(this.module, 'fluid_synth_system_reset', 'number', ['number']),
      controlChange: safeWrap(this.module, 'fluid_synth_cc', 'number', ['number', 'number', 'number', 'number']),
      writeFloat: wrap('fluid_synth_write_float', 'number', [
        'number',
        'number',
        'number',
        'number',
        'number',
        'number',
        'number',
        'number'
      ])
    };

    this.settingsPtr = this.functions.newSettings();
    if (!this.settingsPtr) {
      throw new Error('No se pudo crear la configuración de FluidSynth.');
    }
    this.functions.setNum(this.settingsPtr, 'synth.sample-rate', this.audioContext.sampleRate);
    this.functions.setNum(this.settingsPtr, 'synth.gain', 0.8);
    this.functions.setNum(this.settingsPtr, 'synth.polyphony', 128);

    if (this.functions.setInt) {
      this.functions.setInt(this.settingsPtr, 'synth.threadsafe-api', 0);
    }
    if (this.functions.setStr) {
      this.functions.setStr(this.settingsPtr, 'synth.cpu-cores', '1');
    }

    this.synthPtr = this.functions.newSynth(this.settingsPtr);
    if (!this.synthPtr) {
      throw new Error('No se pudo crear la instancia de FluidSynth.');
    }

    if (this.functions.programReset) {
      this.functions.programReset(this.synthPtr);
    }
    if (this.functions.systemReset) {
      this.functions.systemReset(this.synthPtr);
    }

    this.leftPtr = this.module._malloc(this.blockSize * Float32Array.BYTES_PER_ELEMENT);
    this.rightPtr = this.module._malloc(this.blockSize * Float32Array.BYTES_PER_ELEMENT);
    if (this.leftPtr === null || this.rightPtr === null) {
      throw new Error('No se pudo reservar memoria para el búfer de audio.');
    }
  }

  private async loadSoundFontFromBuffer(buffer: ArrayBuffer, name: string) {
    await this.ensureInitialized();
    if (!this.module || !this.functions || this.synthPtr === null) {
      throw new Error('FluidSynth no está inicializado.');
    }

    if (!this.fsReady) {
      this.module.FS_createPath('/', this.soundFontsPath.replace(/^\//, ''), true, true);
      this.fsReady = true;
    }

    const sanitized = sanitizeFileName(name || 'soundfont.sf2');
    const uniqueName = `${Date.now()}-${sanitized}`;
    const dir = this.soundFontsPath.replace(/^\//, '');
    this.module.FS_createDataFile(dir ? `/${dir}` : '/', uniqueName, new Uint8Array(buffer), true, true, false);
    const fullPath = `${this.soundFontsPath}/${uniqueName}`;

    if (this.soundFontInfo && this.functions.sfunload) {
      this.functions.sfunload(this.synthPtr, this.soundFontInfo.id, 0);
      if (this.module.FS_unlink) {
        try {
          this.module.FS_unlink(this.soundFontInfo.path);
        } catch {
          // ignore cleanup errors
        }
      }
    }

    const sfId = this.functions.sfload(this.synthPtr, fullPath, 1);
    if (sfId < 0) {
      throw new Error('No se pudo cargar el SoundFont en FluidSynth.');
    }
    this.soundFontInfo = { id: sfId, path: fullPath, name };

    if (this.functions.programSelect) {
      // Selecciona el primer preset GM por defecto
      this.functions.programSelect(this.synthPtr, this.channel, sfId, 0, 0);
    }

    this.status.soundFontLoaded = true;
    this.status.soundFontName = name;
    this.status.lastError = null;
  }

  private renderMore(blocks: number) {
    if (!this.module || !this.functions || this.synthPtr === null || this.leftPtr === null || this.rightPtr === null) {
      return;
    }
    if (!this.workletNode) return;
    if (blocks <= 0) return;

    const heap = this.module.HEAPF32;
    const leftIndex = this.leftPtr >> 2;
    const rightIndex = this.rightPtr >> 2;

    for (let i = 0; i < blocks; i++) {
      this.functions.writeFloat(
        this.synthPtr,
        this.blockSize,
        this.leftPtr,
        0,
        1,
        this.rightPtr,
        0,
        1
      );

      const leftCopy = heap.slice(leftIndex, leftIndex + this.blockSize);
      const rightCopy = heap.slice(rightIndex, rightIndex + this.blockSize);
      this.workletNode.port.postMessage(
        {
          type: 'audio',
          left: leftCopy.buffer,
          right: rightCopy.buffer
        },
        [leftCopy.buffer, rightCopy.buffer]
      );
    }
  }
}

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '_');
}

async function loadFluidSynthScript(url: string) {
  if (!browser) return;
  if (document.querySelector(`script[data-fluidsynth="${url}"]`)) {
    return;
  }
  await new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = url;
    script.async = true;
    script.dataset.fluidsynth = url;
    script.onload = () => resolve();
    script.onerror = () =>
      reject(new Error(`No se pudo cargar fluidsynth.js desde ${url}. Copia los binarios en /static/fluidsynth/.`));
    document.head.appendChild(script);
  });
}

async function instantiateFluidSynthModule(params: { scriptUrl: string; wasmUrl: string }) {
  const globalAny = globalThis as any;
  const candidates = [
    globalAny.createFluidSynthModule,
    globalAny.FluidSynthModule,
    globalAny.createModule,
    globalAny.Module
  ].filter((fn) => typeof fn === 'function');

  if (!candidates.length) {
    throw new Error(
      'No se encontró la factoría de FluidSynth. Asegúrate de exponer createFluidSynthModule o Module en fluidsynth.js.'
    );
  }

  const factory = candidates[0];
  const moduleOrPromise = factory({
    locateFile: (path: string) => {
      if (path.endsWith('.wasm')) return params.wasmUrl;
      if (path.startsWith('/')) return path;
      const base = params.scriptUrl.substring(0, params.scriptUrl.lastIndexOf('/') + 1);
      return `${base}${path}`;
    }
  });

  const module = moduleOrPromise && typeof moduleOrPromise.then === 'function'
    ? await moduleOrPromise
    : moduleOrPromise;
  return module;
}

function safeWrap(module: FluidSynthModule, name: string, returnType: string, argTypes: string[]) {
  try {
    return module.cwrap(name, returnType, argTypes);
  } catch {
    return undefined;
  }
}
