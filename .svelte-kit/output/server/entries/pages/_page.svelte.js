import { V as store_get, W as attr, X as unsubscribe_stores } from "../../chunks/index2.js";
import { w as writable } from "../../chunks/index.js";
import { e as escape_html } from "../../chunks/context.js";
const packsStore = writable([]);
const phrasePacks = packsStore;
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    let currentPhraseLabel;
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
      name: "Clip demo",
      events: cloneEvents(defaultEvents)
    };
    let midiLoading = false;
    function cloneEvents(events) {
      return events.map((ev) => ({ ...ev }));
    }
    store_get($$store_subs ??= {}, "$phrasePacks", phrasePacks).length;
    currentPhraseLabel = currentPhrase?.name;
    $$renderer2.push(`<main class="p-6 min-h-screen" style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, sans-serif; background:#0b0b0b; color:#f2f2f2;"><h1 style="font-size:2rem; font-weight:700; margin-bottom:1rem;">DoReMix — PWA (SvelteKit)</h1> <p style="opacity:0.8; margin-bottom:1.5rem;">Demo: reproduce un pequeño "clip" de 1 compás con un sintetizador en AudioWorklet.</p> <div style="display:flex; gap:1rem; align-items:center; margin-bottom:1rem;"><label for="bpm-input">BPM</label> <input id="bpm-input" type="number"${attr(
      "value",
      // small offset
      bpm
    )} min="40" max="240" style="width:5rem; padding:0.4rem; background:#181818; color:#fff; border:1px solid #333; border-radius:8px;"/> <button${attr("disabled", isPlaying, true)} style="padding:0.6rem 1rem; border-radius:10px; background:#2c7efc; color:#fff; border:0;">Play</button> <button${attr("disabled", !isPlaying, true)} style="padding:0.6rem 1rem; border-radius:10px; background:#444; color:#fff; border:0;">Stop</button></div> <p style="opacity:0.7; margin-bottom:1.5rem;">Frase actual: ${escape_html(currentPhraseLabel)}</p> <section style="border:1px solid #333; border-radius:12px; padding:1.2rem; max-width:820px; margin-bottom:2rem;"><h2 style="font-size:1.2rem; margin:0 0 0.8rem 0;">Importar SMF (.mid)</h2> <p style="opacity:0.75; margin-bottom:0.8rem;">Carga un archivo MIDI estándar para convertirlo en la frase activa.</p> <div style="display:flex; flex-wrap:wrap; gap:0.8rem; align-items:center; margin-bottom:0.8rem;"><label for="smf-file" style="min-width:8rem;">Archivo SMF</label> <input id="smf-file" type="file" accept=".mid,.midi"${attr("disabled", midiLoading, true)} style="flex:1 1 240px; min-width:220px; padding:0.45rem; background:#181818; color:#fff; border:1px solid #333; border-radius:8px;"/> `);
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
