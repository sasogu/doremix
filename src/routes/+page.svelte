<script lang="ts">
  import { onMount } from 'svelte';
  let ac: AudioContext;
  let worklet: AudioWorkletNode;
  let bpm = 120;
  let isPlaying = false;

  // simple 1-bar mock clip: 4 on-beat "notes"
  const clip = [
    { beat: 0, type: 'noteon', note: 60, velocity: 0.8 },
    { beat: 0.5, type: 'noteoff', note: 60 },
    { beat: 1, type: 'noteon', note: 64, velocity: 0.8 },
    { beat: 1.5, type: 'noteoff', note: 64 },
    { beat: 2, type: 'noteon', note: 67, velocity: 0.8 },
    { beat: 2.5, type: 'noteoff', note: 67 },
    { beat: 3, type: 'noteon', note: 72, velocity: 0.8 },
    { beat: 3.5, type: 'noteoff', note: 72 }
  ];

  async function setup() {
    if (!ac) {
      ac = new AudioContext({ latencyHint: 'interactive' });
      await ac.audioWorklet.addModule('/engine.worklet.js');
      worklet = new AudioWorkletNode(ac, 'doremix-synth');
      worklet.connect(ac.destination);
    }
  }

  function scheduleClip() {
    const secPerBeat = 60 / bpm;
    const start = ac.currentTime + 0.1; // small offset
    const events = clip.map(ev => ({
      t: start + ev.beat * secPerBeat,
      type: ev.type,
      note: ev.note,
      velocity: ev.velocity ?? 0
    }));
    worklet.port.postMessage({ type: 'schedule', events });
  }

  async function play() {
    await setup();
    await ac.resume();
    isPlaying = true;
    scheduleClip();
  }

  function stop() {
    if (!ac) return;
    worklet.port.postMessage({ type: 'allnotesoff' });
    isPlaying = false;
  }

  onMount(() => {
    // nothing yet
  });
</script>

<main class="p-6 min-h-screen" style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, sans-serif; background:#0b0b0b; color:#f2f2f2;">
  <h1 style="font-size:2rem; font-weight:700; margin-bottom:1rem;">DoReMix — PWA (SvelteKit)</h1>
  <p style="opacity:0.8; margin-bottom:1.5rem;">Demo: reproduce un pequeño "clip" de 1 compás con un sintetizador en AudioWorklet.</p>

  <div style="display:flex; gap:1rem; align-items:center; margin-bottom:1rem;">
    <label>BPM</label>
    <input type="number" bind:value={bpm} min="40" max="240" style="width:5rem; padding:0.4rem; background:#181818; color:#fff; border:1px solid #333; border-radius:8px;" />
    <button on:click={play} disabled={isPlaying} style="padding:0.6rem 1rem; border-radius:10px; background:#2c7efc; color:#fff; border:0;">Play</button>
    <button on:click={stop} disabled={!isPlaying} style="padding:0.6rem 1rem; border-radius:10px; background:#444; color:#fff; border:0;">Stop</button>
  </div>

  <div style="border:1px solid #333; border-radius:12px; padding:1rem; max-width:720px;">
    <h2 style="font-size:1.2rem; margin:0 0 0.5rem 0;">Qué incluye este esqueleto</h2>
    <ul style="line-height:1.6;">
      <li>AudioWorklet con sintetizador simple (seno) y <em>scheduler</em> básico</li>
      <li>VitePWA: manifest & service worker (instalable/offline)</li>
      <li>Página de prueba + controles</li>
    </ul>
  </div>
</main>
