(() => {
  'use strict';

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const existing = [...document.scripts].find(s => s.src === src);
      if (existing) {
        if (existing.dataset.loaded === '1') return resolve();
        existing.addEventListener('load', resolve, {once:true});
        existing.addEventListener('error', reject, {once:true});
        return;
      }
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.dataset.ccFallback = '1';
      s.onload = () => { s.dataset.loaded = '1'; resolve(); };
      s.onerror = () => reject(new Error('Falha ao carregar '+src));
      document.head.appendChild(s);
    });
  }

  async function ensurePako() {
    if (window.pako && typeof window.pako.ungzip === 'function') return;
    await loadScript('https://cdn.jsdelivr.net/npm/pako@2.1.0/dist/pako.min.js');
    if (!window.pako || typeof window.pako.ungzip !== 'function') {
      throw new Error('Pako indisponível após carregamento.');
    }
  }

  async function decodeGzip(bytes) {
    if (typeof DecompressionStream !== 'undefined') {
      try {
        const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
        return await new Response(stream).text();
      } catch (err) {
        console.warn('DecompressionStream falhou; usando fallback Pako.', err);
      }
    }
    await ensurePako();
    return window.pako.ungzip(bytes, {to:'string'});
  }

  window.CARDIOCLIMA_READY = (async () => {
    const chunks = window.__CC_GZ || [];
    if (!chunks.length) throw new Error('Blocos da base não foram carregados.');

    const b64 = chunks.join('');
    const raw = atob(b64);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);

    const P = JSON.parse(await decodeGzip(bytes));
    const cls = {'-2':'queda robusta','-1':'sinal de queda','0':'sem tendência robusta','1':'sinal de alta','2':'alta robusta'};
    const analysis = {};

    for (const k of Object.keys(P.outcomes)) {
      const a = {capital_trends:{}};
      (P.trends[k] || []).forEach((t,i) => {
        if (!t) return;
        const c = P.capNames[i];
        a.capital_trends[c] = {
          n:t[0], slope:t[1], p:t[2], ci_low:t[3], ci_high:t[4], theil_sen:t[5],
          apc:t[6], apc_low:t[7], apc_high:t[8], pct_change:t[9], year_start:t[10],
          year_end:t[11], q_fdr:t[12], classificacao:cls[String(t[13])] || 'sem tendência robusta'
        };
      });
      if (P.breaks[k]) a.breakpoint = P.breaks[k];
      if (P.segs[k]) a.segmented_2020 = P.segs[k];
      analysis[k] = a;
    }

    const mortality = P.mr.map(row => Object.fromEntries(P.mh.map((h,i) => [h,row[i]])));
    delete window.__CC_GZ;

    return window.CARDIOCLIMA_DATA = {
      meta:P.meta, outcomes:P.outcomes, capitals:P.capitals, analysis,
      missingness:P.missingness, anomalies:P.anomalies, pm25_pilot:P.pm25_pilot,
      pm25_pilot_stats:P.pm25_pilot_stats, pm25_panel_stats:P.pm25_panel_stats,
      key:P.key, mortality
    };
  })();
})();