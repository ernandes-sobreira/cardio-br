(() => {
  'use strict';
  try {
    const chunks = window.__CC_GZ || [];
    if (!chunks.length) throw new Error('Blocos da base não foram carregados.');
    if (!window.pako || typeof window.pako.ungzip !== 'function') {
      throw new Error('Biblioteca de descompressão Pako não carregou.');
    }

    const b64 = chunks.join('');
    const raw = atob(b64);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);

    // Descompressão síncrona: CARDIOCLIMA_DATA existe antes de app-core.js executar.
    const text = window.pako.ungzip(bytes, {to:'string'});
    const P = JSON.parse(text);
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
    window.CARDIOCLIMA_DATA = {
      meta:P.meta, outcomes:P.outcomes, capitals:P.capitals, analysis,
      missingness:P.missingness, anomalies:P.anomalies, pm25_pilot:P.pm25_pilot,
      pm25_pilot_stats:P.pm25_pilot_stats, pm25_panel_stats:P.pm25_panel_stats,
      key:P.key, mortality
    };
    window.CARDIOCLIMA_READY = Promise.resolve(window.CARDIOCLIMA_DATA);
    delete window.__CC_GZ;
  } catch (err) {
    console.error('CardioClima data loader:', err);
    window.CARDIOCLIMA_READY = Promise.reject(err);
    document.addEventListener('DOMContentLoaded', () => {
      const box = document.createElement('div');
      box.style.cssText = 'position:relative;z-index:99999;padding:14px 18px;background:#991b1b;color:#fff;font:600 14px system-ui';
      box.textContent = 'Falha ao carregar a base CardioClima: ' + err.message;
      document.body.prepend(box);
    }, {once:true});
  }
})();