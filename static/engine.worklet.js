class DoReMixSynth extends AudioWorkletProcessor {
  constructor() {
    super();
    this.sampleRate_ = sampleRate;
    this.voices = new Map(); // key: note -> {phase, freq, vel}
    this.events = [];
    this.port.onmessage = (e) => {
      const data = e.data || {};
      if (data.type === 'schedule' && Array.isArray(data.events)) {
        // Keep events sorted by time
        this.events.push(...data.events);
        this.events.sort((a,b) => a.t - b.t);
      } else if (data.type === 'allnotesoff') {
        this.voices.clear();
        this.events.length = 0;
      }
    };
  }

  midiToFreq(n) {
    return 440 * Math.pow(2, (n - 69) / 12);
  }

  process(inputs, outputs) {
    const output = outputs[0];
    const ch0 = output[0];
    const ch1 = output.length > 1 ? output[1] : output[0];

    const blockStart = currentTime;
    const blockEnd = blockStart + ch0.length / sampleRate;

    // Dispatch due events within this render quantum
    const due = [];
    let i = 0;
    while (i < this.events.length) {
      const ev = this.events[i];
      if (ev.t >= blockStart && ev.t < blockEnd) {
        due.push(ev);
        this.events.splice(i,1);
      } else {
        i++;
      }
    }
    for (const ev of due) {
      if (ev.type === 'noteon') {
        this.voices.set(ev.note, { phase:0, freq:this.midiToFreq(ev.note), vel: (ev.velocity||0.7) });
      } else if (ev.type === 'noteoff') {
        this.voices.delete(ev.note);
      }
    }

    // Simple synth: sum sine waves for all active voices (basic limiter)
    const TWO_PI = Math.PI * 2;
    for (let n = 0; n < ch0.length; n++) {
      let s = 0;
      for (const v of this.voices.values()) {
        v.phase += v.freq / this.sampleRate_;
        if (v.phase > 1) v.phase -= 1;
        // simple sine with low amplitude
        s += Math.sin(v.phase * TWO_PI) * 0.2 * v.vel;
      }
      // soft clip
      const out = Math.tanh(s * 1.5);
      ch0[n] = out;
      ch1[n] = out;
    }
    return true;
  }
}
registerProcessor('doremix-synth', DoReMixSynth);
