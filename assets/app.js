/* Painel Doenças Cardíacas — CSV wide (municípios x colunas ano/mês)
   - Lê ISO-8859-1 (Latin-1) com TextDecoder
   - Transforma para estrutura long em memória
   - Filtros: ano, mês, municípios (multi)
   - Gráficos Plotly: mensal (no ano) + anual (série histórica)
*/

const CSV_PATH = "assets/data/dados-cardio-br-mes-ano-mod.csv";

const monthMap = {
  "Jan": 1, "Fev": 2, "Mar": 3, "Abr": 4, "Mai": 5, "Jun": 6,
  "Jul": 7, "Ago": 8, "Set": 9, "Out": 10, "Nov": 11, "Dez": 12
};
const monthName = {
  1:"Jan",2:"Fev",3:"Mar",4:"Abr",5:"Mai",6:"Jun",7:"Jul",8:"Ago",9:"Set",10:"Out",11:"Nov",12:"Dez"
};

const el = (id) => document.getElementById(id);

let DATA = {
  // mun -> Map(year -> Map(month -> value))
  byMun: new Map(),
  muns: [],
  years: [],
  range: { minYear: null, maxYear: null }
};

let UI = {
  selectedMuns: new Set(),
  year: null,
  month: "ALL"
};

function fmtInt(n){
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("pt-BR").format(n);
}

function normalizeMun(s){
  return (s || "").toString().trim();
}

function parseHeaderToYearMonth(h){
  // exemplo: "2007/Jan"
  const m = /^(\d{4})\/([A-Za-zÀ-ÿ]{3})$/.exec((h || "").trim());
  if (!m) return null;
  const year = Number(m[1]);
  const monStr = m[2];
  const mon = monthMap[monStr] ?? null;
  if (!mon) return null;
  return { year, month: mon };
}

async function fetchCsvLatin1(path){
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error(`Falha ao carregar CSV (${res.status})`);
  const buf = await res.arrayBuffer();
  const text = new TextDecoder("iso-8859-1").decode(buf);
  return text;
}

function coerceValue(v){
  // no seu CSV aparecem "-" e números
  if (v === null || v === undefined) return 0;
  const s = v.toString().trim();
  if (!s || s === "-" ) return 0;
  // troca vírgula por ponto se vier assim
  const num = Number(s.replace(",", "."));
  return Number.isFinite(num) ? num : 0;
}

function buildData(parsed){
  const rows = parsed.data.filter(r => r && Object.keys(r).length > 0);

  // Descobrir colunas de tempo (ano/mês)
  const allHeaders = parsed.meta.fields || [];
  const timeCols = [];
  for (const h of allHeaders){
    if (h === "Municípios") continue;
    const ym = parseHeaderToYearMonth(h);
    if (ym) timeCols.push({ h, ...ym });
  }

  const yearsSet = new Set();
  let minYear = Infinity, maxYear = -Infinity;

  const byMun = new Map();

  for (const row of rows){
    const mun = normalizeMun(row["Municípios"]);
    if (!mun) continue;

    if (!byMun.has(mun)) byMun.set(mun, new Map());

    for (const col of timeCols){
      const val = coerceValue(row[col.h]);

      yearsSet.add(col.year);
      minYear = Math.min(minYear, col.year);
      maxYear = Math.max(maxYear, col.year);

      const yMap = byMun.get(mun);
      if (!yMap.has(col.year)) yMap.set(col.year, new Map());
      const mMap = yMap.get(col.year);
      mMap.set(col.month, (mMap.get(col.month) || 0) + val);
    }
  }

  const years = Array.from(yearsSet).sort((a,b)=>a-b);
  const muns = Array.from(byMun.keys()).sort((a,b)=>a.localeCompare(b,"pt-BR"));

  DATA = {
    byMun,
    years,
    muns,
    range: { minYear: isFinite(minYear) ? minYear : null, maxYear: isFinite(maxYear) ? maxYear : null }
  };
}

function initYearMonthControls(){
  const yearSel = el("yearSelect");
  yearSel.innerHTML = "";
  for (let i = DATA.years.length - 1; i >= 0; i--){
    const y = DATA.years[i];
    const opt = document.createElement("option");
    opt.value = String(y);
    opt.textContent = String(y);
    yearSel.appendChild(opt);
  }
  UI.year = DATA.years[DATA.years.length - 1] ?? null;
  yearSel.value = UI.year ? String(UI.year) : "";

  const monthSel = el("monthSelect");
  monthSel.innerHTML = "";
  const optAll = document.createElement("option");
  optAll.value = "ALL";
  optAll.textContent = "Todos os meses";
  monthSel.appendChild(optAll);

  for (let m = 1; m <= 12; m++){
    const opt = document.createElement("option");
    opt.value = String(m);
    opt.textContent = monthName[m];
    monthSel.appendChild(opt);
  }
  monthSel.value = "ALL";

  yearSel.addEventListener("change", () => {
    UI.year = Number(yearSel.value);
    refreshAll();
  });
  monthSel.addEventListener("change", () => {
    UI.month = monthSel.value;
    refreshAll();
  });

  const rangeInfo = el("rangeInfo");
  if (DATA.range.minYear && DATA.range.maxYear){
    rangeInfo.textContent = `Cobertura do arquivo: ${DATA.range.minYear} → ${DATA.range.maxYear}`;
  } else {
    rangeInfo.textContent = `Cobertura do arquivo: —`;
  }
}

function renderMunList(filterText = ""){
  const list = el("munList");
  list.innerHTML = "";

  const f = (filterText || "").trim().toLowerCase();
  const filtered = f
    ? DATA.muns.filter(m => m.toLowerCase().includes(f))
    : DATA.muns;

  el("munCount").textContent = `${fmtInt(filtered.length)} municípios`;

  for (const mun of filtered){
    const row = document.createElement("div");
    row.className = "munItem";

    const left = document.createElement("div");
    left.className = "munLeft";

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = UI.selectedMuns.has(mun);
    cb.addEventListener("change", () => {
      if (cb.checked) UI.selectedMuns.add(mun);
      else UI.selectedMuns.delete(mun);
      refreshAll();
    });

    const name = document.createElement("div");
    name.textContent = mun;

    left.appendChild(cb);
    left.appendChild(name);

    const badge = document.createElement("div");
    badge.className = "badge";
    badge.textContent = "ver";

    row.appendChild(left);
    row.appendChild(badge);

    list.appendChild(row);
  }
}

function sumForMunYear(mun, year){
  const yMap = DATA.byMun.get(mun);
  if (!yMap) return 0;
  const mMap = yMap.get(year);
  if (!mMap) return 0;
  let s = 0;
  for (const v of mMap.values()) s += (v || 0);
  return s;
}

function valueForMunYearMonth(mun, year, month){
  const yMap = DATA.byMun.get(mun);
  if (!yMap) return 0;
  const mMap = yMap.get(year);
  if (!mMap) return 0;
  return mMap.get(month) || 0;
}

function computeTotalsForFilter(){
  const year = UI.year;
  const month = UI.month;

  const selected = UI.selectedMuns.size ? Array.from(UI.selectedMuns) : [];

  // se nada selecionado, calcula total Brasil (soma de todos) no filtro
  const munsToUse = selected.length ? selected : DATA.muns;

  let total = 0;
  let topMun = null;
  let topVal = -Infinity;

  for (const mun of munsToUse){
    let v = 0;
    if (month === "ALL"){
      v = sumForMunYear(mun, year);
    } else {
      v = valueForMunYearMonth(mun, year, Number(month));
    }
    total += v;
    if (v > topVal){
      topVal = v;
      topMun = mun;
    }
  }

  return { total, topMun, topVal, countSelected: selected.length };
}

function plotMonthly(){
  const year = UI.year;
  const chosen = UI.selectedMuns.size ? Array.from(UI.selectedMuns) : [];

  // se ninguém selecionado, pega os 5 maiores do ano pra dar um gráfico útil
  let muns = chosen;
  if (!muns.length){
    const ranked = DATA.muns
      .map(m => [m, sumForMunYear(m, year)])
      .sort((a,b)=>b[1]-a[1])
      .slice(0, 5)
      .map(x=>x[0]);
    muns = ranked;
  }

  const traces = muns.map(mun => {
    const x = [];
    const y = [];
    for (let m = 1; m <= 12; m++){
      x.push(monthName[m]);
      y.push(valueForMunYearMonth(mun, year, m));
    }
    return {
      type: "scatter",
      mode: "lines+markers",
      name: mun,
      x, y
    };
  });

  const layout = {
    margin: { l: 50, r: 10, t: 10, b: 40 },
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
    font: { color: "rgba(255,255,255,.88)" },
    xaxis: { gridcolor: "rgba(255,255,255,.08)" },
    yaxis: { gridcolor: "rgba(255,255,255,.08)" },
    legend: { orientation: "h" }
  };

  Plotly.newPlot("chartMonthly", traces, layout, { responsive: true, displayModeBar: false });
}

function plotYearly(){
  const chosen = UI.selectedMuns.size ? Array.from(UI.selectedMuns) : [];

  // Se nada selecionado, usar top 5 no ano atual (coerente com o mensal)
  let muns = chosen;
  if (!muns.length){
    const year = UI.year;
    muns = DATA.muns
      .map(m => [m, sumForMunYear(m, year)])
      .sort((a,b)=>b[1]-a[1])
      .slice(0, 5)
      .map(x=>x[0]);
  }

  const traces = muns.map(mun => {
    const x = DATA.years;
    const y = DATA.years.map(y => sumForMunYear(mun, y));
    return { type: "bar", name: mun, x, y };
  });

  const layout = {
    barmode: "group",
    margin: { l: 50, r: 10, t: 10, b: 40 },
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
    font: { color: "rgba(255,255,255,.88)" },
    xaxis: { gridcolor: "rgba(255,255,255,.08)" },
    yaxis: { gridcolor: "rgba(255,255,255,.08)" },
    legend: { orientation: "h" }
  };

  Plotly.newPlot("chartYearly", traces, layout, { responsive: true, displayModeBar: false });
}

function refreshKPIs(){
  const { total, topMun, topVal, countSelected } = computeTotalsForFilter();

  el("kpiTotal").textContent = fmtInt(total);
  el("kpiTop").textContent = topMun ? `${topMun} (${fmtInt(topVal)})` : "—";
  el("kpiSel").textContent = fmtInt(countSelected);

  const pill = el("pillStatus");
  pill.textContent = "Dados carregados";
}

function refreshAll(){
  refreshKPIs();
  plotMonthly();
  plotYearly();
}

function wireActions(){
  const search = el("munSearch");
  search.addEventListener("input", () => renderMunList(search.value));

  el("btnClear").addEventListener("click", () => {
    UI.selectedMuns.clear();
    renderMunList(el("munSearch").value);
    refreshAll();
  });

  el("btnSelectTop").addEventListener("click", () => {
    const year = UI.year;
    const top = DATA.muns
      .map(m => [m, sumForMunYear(m, year)])
      .sort((a,b)=>b[1]-a[1])
      .slice(0, 5)
      .map(x=>x[0]);

    UI.selectedMuns = new Set(top);
    renderMunList(el("munSearch").value);
    refreshAll();
  });
}

async function boot(){
  try{
    const text = await fetchCsvLatin1(CSV_PATH);

    const parsed = Papa.parse(text, {
      header: true,
      delimiter: ";",
      skipEmptyLines: true
    });

    if (parsed.errors && parsed.errors.length){
      console.warn(parsed.errors);
    }

    buildData(parsed);

    initYearMonthControls();
    wireActions();
    renderMunList("");

    // estado inicial: nenhum município selecionado (mostra top 5 automaticamente nos gráficos)
    refreshAll();

    el("pillStatus").textContent = "Dados carregados";
  } catch (err){
    console.error(err);
    el("pillStatus").textContent = "Erro ao carregar CSV";
    alert("Falha ao carregar os dados. Confira se o CSV está em assets/data/ e se o nome do arquivo está correto.");
  }
}

document.addEventListener("DOMContentLoaded", boot);
