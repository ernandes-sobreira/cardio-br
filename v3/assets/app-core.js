'use strict';
const D = window.CARDIOCLIMA_DATA;
if (!D) throw new Error('Dados CardioClima não carregados.');

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const pt = new Intl.NumberFormat('pt-BR', {maximumFractionDigits: 2});
const pt1 = new Intl.NumberFormat('pt-BR', {minimumFractionDigits:1, maximumFractionDigits:1});
const pt2 = new Intl.NumberFormat('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2});
const colors = {navy:'#0b1725',teal:'#0b8f8a',teal2:'#26b8b0',violet:'#6d5dfc',amber:'#e69500',red:'#d8495a',green:'#1f9d69',muted:'#7890a3',line:'#dce5ee'};
const regionColors = {'Norte':'#0b8f8a','Nordeste':'#e69500','Centro-Oeste':'#6d5dfc','Sudeste':'#d8495a','Sul':'#2d7bb6'};
const pageTitles = {overview:'Panorama nacional',trends:'Tendências e evidência',profiles:'Perfis demográficos',environment:'Ambiente e PM2,5',models:'Modelos e sensibilidade',quality:'Qualidade dos dados',methods:'Método e dados'};

const state = { page:'overview', outcome:'Taxa mortalidade geral', capital:'ALL', region:'ALL', envExposure:'PM2,5 P99 (µg/m³)', envOutcome:'70–79 média' };

function f(v,d=2){ return v==null || Number.isNaN(+v) ? '—' : new Intl.NumberFormat('pt-BR',{minimumFractionDigits:d,maximumFractionDigits:d}).format(+v); }
function fp(v){ if(v==null || Number.isNaN(+v)) return '—'; if(+v < .001) return '< 0,001'; return new Intl.NumberFormat('pt-BR',{minimumFractionDigits:3,maximumFractionDigits:3}).format(+v); }
function pct(v,d=1){ return v==null?'—':`${v>=0?'+':''}${f(v,d)}%`; }
function pp(v,d=2){ return v==null?'—':`${v>=0?'+':''}${f(v,d)} p.p.`; }
function safe(v){ return v == null ? null : +v; }
function outcomeLabel(k){ return D.outcomes[k]?.label || k; }
function capitalize(s){ return s ? s[0].toUpperCase()+s.slice(1) : s; }

function plotLayout(extra={}){
  return Object.assign({
    paper_bgcolor:'rgba(0,0,0,0)', plot_bgcolor:'rgba(0,0,0,0)', margin:{l:54,r:18,t:18,b:48},
    font:{family:'Inter, system-ui, sans-serif',color:'#42566b',size:11}, hoverlabel:{bgcolor:'#0b1725',font:{color:'#fff'}},
    xaxis:{gridcolor:'#edf2f6',zeroline:false,tickfont:{size:10}}, yaxis:{gridcolor:'#edf2f6',zeroline:false,tickfont:{size:10}},
    legend:{orientation:'h',y:-.2,x:0,font:{size:10}}
  }, extra);
}
const config = {responsive:true,displaylogo:false,modeBarButtonsToRemove:['lasso2d','select2d','autoScale2d'],toImageButtonOptions:{format:'png',scale:2}};
function plot(id,traces,layout){ if(!window.Plotly) return; Plotly.react(id,traces,plotLayout(layout),config); }

function scopedRows(){
  return D.mortality.filter(r => (state.capital==='ALL'||r.Capital===state.capital) && (state.region==='ALL'||r['Região']===state.region));
}
function seriesForScope(outcome=state.outcome){
  const rows=scopedRows(), ys=[...new Set(rows.map(r=>r.Ano))].sort((a,b)=>a-b);
  return ys.map(year=>{
    const vals=rows.filter(r=>r.Ano===year).map(r=>safe(r[outcome])).filter(v=>v!=null);
    if(!vals.length) return {year,mean:null,n:0,ci_low:null,ci_high:null};
    const mean=vals.reduce((a,b)=>a+b,0)/vals.length;
    let ci=[mean,mean];
    if(vals.length>1){ const sd=Math.sqrt(vals.reduce((s,v)=>s+(v-mean)**2,0)/(vals.length-1)); const se=sd/Math.sqrt(vals.length); ci=[mean-1.96*se,mean+1.96*se]; }
    return {year,mean,n:vals.length,ci_low:ci[0],ci_high:ci[1]};
  });
}
function scopeName(){ if(state.capital!=='ALL') return state.capital; if(state.region!=='ALL') return `Região ${state.region}`; return 'Brasil'; }

function linearFit(x,y){
  const n=x.length, mx=x.reduce((a,b)=>a+b,0)/n, my=y.reduce((a,b)=>a+b,0)/n;
  const sxx=x.reduce((s,v)=>s+(v-mx)**2,0), sxy=x.reduce((s,v,i)=>s+(v-mx)*(y[i]-my),0);
  const slope=sxx? sxy/sxx:0, intercept=my-slope*mx;
  const pred=x.map(v=>intercept+slope*v);
  const ssr=y.reduce((s,v,i)=>s+(v-pred[i])**2,0), sst=y.reduce((s,v)=>s+(v-my)**2,0);
  return {slope,intercept,r2:sst?1-ssr/sst:0,pred};
}
function pearson(x,y){
  const mx=x.reduce((a,b)=>a+b,0)/x.length,my=y.reduce((a,b)=>a+b,0)/y.length;
  const a=x.reduce((s,v,i)=>s+(v-mx)*(y[i]-my),0), bx=Math.sqrt(x.reduce((s,v)=>s+(v-mx)**2,0)), by=Math.sqrt(y.reduce((s,v)=>s+(v-my)**2,0));
  return bx&&by?a/(bx*by):0;
}

function populateOutcomeSelect(){
  const el=$('#globalOutcome'); el.innerHTML='';
  const groups=['Geral','Sexo','Idade','Raça/cor'];
  groups.forEach(g=>{ const og=document.createElement('optgroup'); og.label=g; Object.entries(D.outcomes).filter(([,m])=>m.group===g).forEach(([k,m])=>{ const o=document.createElement('option'); o.value=k;o.textContent=m.label;og.appendChild(o);}); el.appendChild(og); });
  el.value=state.outcome;
}
function populateRegions(){ const el=$('#globalRegion'); el.innerHTML='<option value="ALL">Todas as regiões</option>'+['Norte','Nordeste','Centro-Oeste','Sudeste','Sul'].map(r=>`<option>${r}</option>`).join(''); el.value=state.region; }
function populateCapitals(){
  const el=$('#globalCapital'); const caps=Object.keys(D.capitals).filter(c=>state.region==='ALL'||D.capitals[c].region===state.region).sort((a,b)=>a.localeCompare(b,'pt-BR'));
  if(state.capital!=='ALL'&&!caps.includes(state.capital)) state.capital='ALL';
  el.innerHTML='<option value="ALL">Todas as capitais</option>'+caps.map(c=>`<option value="${c}">${c} · ${D.capitals[c].uf}</option>`).join(''); el.value=state.capital;
}
function setupNav(){
  $$('.nav-item').forEach(b=>b.addEventListener('click',()=>goPage(b.dataset.page)));
  $$('[data-jump]').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();goPage(a.dataset.jump);}));
  $('#mobileMenu').addEventListener('click',()=>$('#sidebar').classList.toggle('open'));
}
function goPage(page){ state.page=page; $$('.page').forEach(p=>p.classList.remove('active')); $(`#page-${page}`).classList.add('active'); $$('.nav-item').forEach(n=>n.classList.toggle('active',n.dataset.page===page)); $('#pageTitle').textContent=pageTitles[page]; $('#sidebar').classList.remove('open'); window.scrollTo({top:0,behavior:'smooth'}); setTimeout(()=>{renderPage(page); window.Plotly&&$$(`#page-${page} .js-plotly-plot`).forEach(el=>Plotly.Plots.resize(el));},40); }
function setupFilters(){
  $('#globalOutcome').addEventListener('change',e=>{state.outcome=e.target.value; renderAll();});
  $('#globalRegion').addEventListener('change',e=>{state.region=e.target.value; populateCapitals();renderAll();});
  $('#globalCapital').addEventListener('change',e=>{state.capital=e.target.value; if(state.capital!=='ALL') state.region=D.capitals[state.capital].region; populateRegions();populateCapitals();renderAll();});
}
function updateContext(){ $('#filterContext').textContent=`${scopeName()} · ${outcomeLabel(state.outcome)}`; }

function getTrendForCapital(cap,outcome){ return D.analysis[outcome]?.capital_trends?.[cap] || null; }
function classForTrend(t){ if(!t) return 'neutral'; const c=t.classificacao||''; return c.includes('queda')?'down':c.includes('alta')?'up':'neutral'; }

function renderOverview(){
  const s=seriesForScope(); const valid=s.filter(d=>d.mean!=null); if(!valid.length)return;
  const first=valid[0], last=valid.at(-1), peak=valid.reduce((a,b)=>b.mean>a.mean?b:a);
  let headline='', narrative='', evidence=[];
  if(state.capital==='ALL'&&state.region==='ALL'){
    const seg=D.analysis[state.outcome].segmented_2020, bp=D.analysis[state.outcome].breakpoint;
    if(bp){ headline=`A trajetória de ${outcomeLabel(state.outcome).toLowerCase()} muda de direção em torno de ${bp.year}.`; narrative=`O modelo de duas inclinações supera claramente a linha única (ΔAIC ${f(bp.delta_aic,1)}). Depois da inflexão, a trajetória média passa para ${pp(bp.post_slope,2)} por ano. A leitura é temporal e ecológica — não atribui causa ao ponto de mudança.`; evidence=[`ΔAIC ${f(bp.delta_aic,1)}`,`R² segmentado ${f(bp.r2,2)}`,`p da mudança ${fp(bp.p_change)}`]; }
    else { headline=`A média nacional passou de ${f(first.mean)} para ${f(last.mean)}.`; narrative='O indicador selecionado tem cobertura insuficiente para estimar uma quebra temporal com a mesma robustez.'; }
  } else if(state.capital!=='ALL'){
    const t=getTrendForCapital(state.capital,state.outcome); headline=t?`${state.capital}: ${t.classificacao}.`:`${state.capital}: série com cobertura limitada.`; narrative=t?`A inclinação estimada é ${pp(t.slope,2)} por ano e o APC é ${pct(t.apc,2)} ao ano. O q-FDR é ${fp(t.q_fdr)}, e o estimador Theil–Sen aponta ${pp(t.theil_sen,2)} por ano.`:'Não há observações suficientes para estimar a tendência robusta.'; evidence=t?[`APC ${pct(t.apc,1)}`,`q-FDR ${fp(t.q_fdr)}`,`Theil–Sen ${pp(t.theil_sen,2)}`]:[];
  } else {
    const ch=(last.mean/first.mean-1)*100; headline=`${scopeName()}: ${ch<0?'redução':'aumento'} de ${f(Math.abs(ch),1)}% entre ${first.year} e ${last.year}.`; narrative=`A curva regional é a média simples das capitais da região. Use o módulo Tendências para separar o comportamento de cada capital e evitar que uma cidade domine a interpretação.`; evidence=[`${first.year}: ${f(first.mean)}`,`${last.year}: ${f(last.mean)}`,`Δ ${pct(ch,1)}`];
  }
  $('#heroHeadline').textContent=headline; $('#heroNarrative').textContent=narrative; $('#heroEvidence').innerHTML=evidence.map(x=>`<span class="evidence-chip">${x}</span>`).join('');

  const bp=D.analysis[state.outcome].breakpoint;
  if(state.capital==='ALL'&&state.region==='ALL'&&bp){ $('#breakYear').textContent=bp.year; $('#breakBadge').textContent=bp.delta_aic>=10?'forte suporte':'suporte moderado'; $('#breakText').textContent=`Melhor ponto de inflexão descritivo por AIC. A linha pós-inflexão é ${pp(bp.post_slope,2)}/ano.`; }
  else { $('#breakYear').textContent=state.capital==='ALL'?'—':'APC'; const t=state.capital==='ALL'?null:getTrendForCapital(state.capital,state.outcome); $('#breakBadge').textContent=t?t.classificacao:'escopo filtrado'; $('#breakText').textContent=t?`${pct(t.apc,2)} ao ano; q-FDR ${fp(t.q_fdr)}.`:'A quebra nacional é mostrada apenas sem filtro regional/capital.'; }

  $('#kpiPeak').textContent=`${f(peak.mean)}%`; $('#kpiPeakSub').textContent=`${peak.year} · ${scopeName()}`;
  $('#kpiLatest').textContent=`${f(last.mean)}%`; $('#kpiLatestSub').textContent=`${last.year} · ${pct((last.mean/peak.mean-1)*100,1)} vs pico`;
  const seg=D.analysis[state.outcome].segmented_2020;
  $('#kpiPostSlope').textContent=seg?`${pp(seg.post_slope,2)}/ano`:'—'; $('#kpiPostP').textContent=seg?`p ${fp(seg.post_p)} · SE cluster`:'cobertura insuficiente';
  const ts=Object.values(D.analysis[state.outcome].capital_trends||{}).filter(Boolean); const robust=ts.filter(t=>t.classificacao?.includes('robusta')).length;
  $('#kpiRobust').textContent=`${robust}/${ts.length}`;

  const x=valid.map(d=>d.year), y=valid.map(d=>d.mean); const lo=valid.map(d=>d.ci_low), hi=valid.map(d=>d.ci_high);
  const traces=[];
  if(state.capital==='ALL'){
    traces.push({x:x.concat([...x].reverse()),y:hi.concat([...lo].reverse()),fill:'toself',fillcolor:'rgba(11,143,138,.12)',line:{color:'rgba(0,0,0,0)'},hoverinfo:'skip',showlegend:false});
  }
  traces.push({x,y,mode:'lines+markers',name:scopeName(),line:{color:colors.teal,width:3},marker:{size:7,color:'#fff',line:{color:colors.teal,width:2}},hovertemplate:'%{x}<br><b>%{y:.2f}%</b><extra></extra>'});
  const shapes=[]; if(state.capital==='ALL'&&state.region==='ALL'&&bp) shapes.push({type:'line',x0:bp.year,x1:bp.year,y0:0,y1:1,yref:'paper',line:{color:colors.amber,width:2,dash:'dot'}});
  plot('overviewTrend',traces,{shapes,yaxis:{title:'Taxa hospitalar (%)',gridcolor:'#edf2f6',zeroline:false},xaxis:{dtick:2,gridcolor:'#f0f3f6'}});

  const yr=last.year; const rankRows=D.mortality.filter(r=>r.Ano===yr && r[state.outcome]!=null && (state.region==='ALL'||r['Região']===state.region)).sort((a,b)=>b[state.outcome]-a[state.outcome]).slice(0,12).reverse();
  plot('overviewRanking',[{x:rankRows.map(r=>r[state.outcome]),y:rankRows.map(r=>r.Capital),type:'bar',orientation:'h',marker:{color:rankRows.map(r=>regionColors[r['Região']]||colors.teal)},text:rankRows.map(r=>f(r[state.outcome],1)),textposition:'outside',hovertemplate:'<b>%{y}</b><br>%{x:.2f}%<extra></extra>'}],{margin:{l:100,r:35,t:10,b:35},showlegend:false,xaxis:{title:`Taxa (%) · ${yr}`,gridcolor:'#edf2f6'}});

  const ageKeys=['20 a 29 anos','30 a 39 anos','40 a 49 anos','50 a 59 anos','60 a 69 anos','70 a 79 anos','80 anos e mais'];
  const ageVals=ageKeys.map(k=>{const vals=scopedRows().filter(r=>r.Ano===yr&&r[k]!=null).map(r=>r[k]);return vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:null;});
  plot('overviewAge',[{x:ageKeys.map(outcomeLabel),y:ageVals,type:'bar',marker:{color:ageVals.map((_,i)=>`rgba(109,93,252,${.35+i*.08})`)},hovertemplate:'%{x}<br><b>%{y:.2f}%</b><extra></extra>'}],{showlegend:false,yaxis:{title:'Taxa hospitalar (%)',gridcolor:'#edf2f6'},xaxis:{tickangle:-25}});

  const insights=[];
  if(peak.year===2020||peak.year===2021) insights.push(['strong','Pico concentrado em 2020–2021',`O maior valor do escopo selecionado foi ${f(peak.mean)}% em ${peak.year}. A coincidência temporal deve ser tratada como possível choque sistêmico, não como causalidade automática.`]);
  if(seg&&seg.post_p<.05) insights.push(['','Queda pós-2020 é estatisticamente detectável',`Inclinação pós-2020: ${pp(seg.post_slope,2)}/ano; IC95% ${f(seg.post_ci[0])} a ${f(seg.post_ci[1])}; p ${fp(seg.post_p)}.`]);
  if(state.outcome==='80 anos e mais') insights.push(['warning','Idade muito elevada concentra risco hospitalar',`Em 2025, a média 80+ é ${f(D.key.age80_2025)}%, cerca de ${f(D.key.age_ratio_80_20_2025,1)}× a taxa de 20–29 anos.`]);
  insights.push(['warning','Taxa hospitalar não é mortalidade populacional','O denominador é hospitalar. Mudanças na internação, gravidade, acesso e registro podem alterar a taxa mesmo sem mudança proporcional no risco populacional de morrer.']);
  $('#insightCards').innerHTML=insights.slice(0,4).map(([cl,t,tx])=>`<div class="insight ${cl}"><b>${t}</b><p>${tx}</p></div>`).join('');
}
