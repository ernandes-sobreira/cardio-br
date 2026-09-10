function renderTrends(){
  const cap=state.capital==='ALL'?'Cuiabá':state.capital; const t=getTrendForCapital(cap,state.outcome); const rows=D.mortality.filter(r=>r.Capital===cap&&r[state.outcome]!=null).sort((a,b)=>a.Ano-b.Ano);
  $('#capitalTrendTitle').textContent=`${cap} · ${outcomeLabel(state.outcome)}`;
  const badge=$('#capitalTrendBadge'); badge.textContent=t?.classificacao||'cobertura insuficiente'; badge.className=`trend-badge ${classForTrend(t)}`;
  if(rows.length){ const x=rows.map(r=>r.Ano), y=rows.map(r=>r[state.outcome]); const lf=linearFit(x,y); const fitY=t?lf.pred:[]; plot('capitalTrendPlot',[{x,y,mode:'lines+markers',name:'observado',line:{color:colors.navy,width:2},marker:{size:7,color:'#fff',line:{color:colors.navy,width:2}}},...(t?[{x,y:fitY,mode:'lines',name:'tendência linear',line:{color:colors.teal,width:3,dash:'dash'}}]:[])],{yaxis:{title:'Taxa hospitalar (%)',gridcolor:'#edf2f6'},xaxis:{dtick:2,gridcolor:'#f0f3f6'}}); }
  $('#capitalTrendMetrics').innerHTML=t?`
    <div class="metric-block emphasis"><span>APC log-linear</span><strong>${pct(t.apc,2)}/ano</strong><small>IC95% ${pct(t.apc_low,2)} a ${pct(t.apc_high,2)}</small></div>
    <div class="metric-block"><span>Inclinação linear</span><strong>${pp(t.slope,2)}/ano</strong><small>IC95% ${f(t.ci_low)} a ${f(t.ci_high)} · p ${fp(t.p)}</small></div>
    <div class="metric-block"><span>FDR entre capitais</span><strong>q = ${fp(t.q_fdr)}</strong><small>${t.q_fdr<.05?'permanece significativo após múltiplos testes':'não permanece significativo a 5%'}</small></div>
    <div class="metric-block"><span>Theil–Sen</span><strong>${pp(t.theil_sen,2)}/ano</strong><small>estimador robusto a valores extremos</small></div>
    <div class="metric-block"><span>Variação ponta a ponta</span><strong>${pct(t.pct_change,1)}</strong><small>${t.year_start} → ${t.year_end}; não substitui a tendência</small></div>`:'<div class="metric-block">Observações insuficientes.</div>';
  renderSlopeForest(); renderTrendTable();
}

function renderSlopeForest(){
  const items=Object.entries(D.analysis[state.outcome].capital_trends||{}).filter(([,t])=>t&&t.n>=8).map(([capital,t])=>({capital,...t})).sort((a,b)=>a.slope-b.slope);
  plot('slopeForest',[{x:items.map(d=>d.slope),y:items.map(d=>d.capital),mode:'markers',type:'scatter',marker:{size:8,color:items.map(d=>d.q_fdr<.05?(d.slope<0?colors.green:colors.red):'#9aa9b8')},error_x:{type:'data',symmetric:false,array:items.map(d=>d.ci_high-d.slope),arrayminus:items.map(d=>d.slope-d.ci_low),color:'#9aabba',thickness:1},customdata:items.map(d=>[d.apc,d.p,d.q_fdr,d.classificacao]),hovertemplate:'<b>%{y}</b><br>inclinação %{x:.3f} p.p./ano<br>APC %{customdata[0]:.2f}%<br>p %{customdata[1]:.4f}<br>q %{customdata[2]:.4f}<br>%{customdata[3]}<extra></extra>'}],{height:Math.max(560,items.length*20),margin:{l:105,r:30,t:10,b:45},xaxis:{title:'Mudança estimada por ano (p.p.)',gridcolor:'#edf2f6',zeroline:true,zerolinecolor:'#31465a',zerolinewidth:1},yaxis:{gridcolor:'rgba(0,0,0,0)'}});
}
function renderTrendTable(){
  const term=($('#trendSearch')?.value||'').toLowerCase(); const rows=Object.entries(D.analysis[state.outcome].capital_trends||{}).filter(([c,t])=>t&&c.toLowerCase().includes(term)).map(([capital,t])=>({capital,...t})).sort((a,b)=>a.apc-b.apc);
  $('#trendTableBody').innerHTML=rows.map(t=>`<tr><td><b>${t.capital}</b></td><td>${pct(t.apc,2)}</td><td>${pp(t.slope,3)}</td><td>${f(t.ci_low,3)} a ${f(t.ci_high,3)}</td><td>${fp(t.p)}</td><td>${fp(t.q_fdr)}</td><td>${pp(t.theil_sen,3)}</td><td><span class="status-pill ${classForTrend(t)==='up'?'up':classForTrend(t)==='down'?'down':'flat'}">${t.classificacao}</span></td></tr>`).join('');
}

function renderProfiles(){
  const ageKeys=['Menor 1 ano','1 a 4 anos','5 a 9 anos','10 a 14 anos','15 a 19 anos','20 a 29 anos','30 a 39 anos','40 a 49 anos','50 a 59 anos','60 a 69 anos','70 a 79 anos','80 anos e mais']; const yrs=[2008,2020,2025];
  const ageTr=yrs.map((year,i)=>({x:ageKeys.map(outcomeLabel),y:ageKeys.map(k=>{const vals=scopedRows().filter(r=>r.Ano===year&&r[k]!=null).map(r=>r[k]);return vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:null;}),mode:'lines+markers',name:String(year),line:{width:3,color:[colors.muted,colors.red,colors.teal][i]},marker:{size:6}}));
  plot('ageProfile',ageTr,{yaxis:{title:'Taxa hospitalar (%)',gridcolor:'#edf2f6'},xaxis:{tickangle:-35,gridcolor:'rgba(0,0,0,0)'},legend:{orientation:'h',y:-.3}});
  const scope=scopedRows(); const sex=[]; const years=[...new Set(D.mortality.map(r=>r.Ano))].sort((a,b)=>a-b); ['Masc','Fem'].forEach((k,i)=>{const vals=years.map(year=>{const rr=scope.filter(r=>r.Ano===year&&r[k]!=null);return rr.length?rr.reduce((s,r)=>s+r[k],0)/rr.length:null;});sex.push({x:years,y:vals,mode:'lines+markers',name:outcomeLabel(k),line:{width:3,color:i?colors.violet:colors.teal},marker:{size:5}});});
  plot('sexTrend',sex,{yaxis:{title:'Taxa hospitalar (%)',gridcolor:'#edf2f6'},xaxis:{dtick:2,gridcolor:'#f1f4f7'}});
  const regTr=['Norte','Nordeste','Centro-Oeste','Sudeste','Sul'].map(reg=>{const vals=years.map(year=>{const rr=D.mortality.filter(r=>r['Região']===reg&&r.Ano===year&&r[state.outcome]!=null);return rr.length?rr.reduce((s,r)=>s+r[state.outcome],0)/rr.length:null;});return {x:years,y:vals,mode:'lines',name:reg,line:{width:2.5,color:regionColors[reg]}};});
  plot('regionTrend',regTr,{yaxis:{title:'Taxa hospitalar (%)',gridcolor:'#edf2f6'},xaxis:{dtick:2,gridcolor:'#f1f4f7'}});
  const race=D.missingness.filter(d=>d.group==='Raça/cor').sort((a,b)=>a.coverage_pct-b.coverage_pct);
  $('#raceWarning').innerHTML=`A completude varia fortemente: <b>${race[0].label}</b> tem apenas ${f(race[0].coverage_pct,1)}% de cobertura, enquanto <b>${race.at(-1].label}</b> chega a ${f(race.at(-1).coverage_pct,1)}%. Comparações de raça/cor devem ser secundárias e acompanhadas da cobertura.`;
  plot('raceCoverage',[{x:race.map(d=>d.coverage_pct),y:race.map(d=>d.label),type:'bar',orientation:'h',marker:{color:race.map(d=>d.coverage_pct<70?colors.amber:colors.teal)},text:race.map(d=>`${f(d.coverage_pct,1)}%`),textposition:'outside'}],{margin:{l:100,r:45,t:10,b:40},xaxis:{range:[0,105],title:'Cobertura (%)',gridcolor:'#edf2f6'},showlegend:false});
}

const envExposureLabels={'PM2,5 média (µg/m³)':'PM2,5 média','PM2,5 média seca (µg/m³)':'PM2,5 média — estação seca','PM2,5 P99 (µg/m³)':'PM2,5 P99','Dias PM2,5 >15 (%)':'Dias > 15 µg/m³'};
const envOutcomeLabels={'Mortalidade geral média 2010–2019':'Mortalidade geral','60–69 média':'60–69 anos','70–79 média':'70–79 anos','80+ média':'80+ anos'};
function setupEnvControls(){
  $('#envExposure').innerHTML=Object.entries(envExposureLabels).map(([v,l])=>`<option value="${v}">${l}</option>`).join(''); $('#envExposure').value=state.envExposure;
  $('#envOutcome').innerHTML=Object.entries(envOutcomeLabels).map(([v,l])=>`<option value="${v}">${l}</option>`).join(''); $('#envOutcome').value=state.envOutcome;
  $('#envExposure').addEventListener('change',e=>{state.envExposure=e.target.value;renderEnvironment();}); $('#envOutcome').addEventListener('change',e=>{state.envOutcome=e.target.value;renderEnvironment();});
}
function renderEnvironment(){
  const xk=state.envExposure, yk=state.envOutcome, rows=D.pm25_pilot.filter(r=>r[xk]!=null&&r[yk]!=null); const x=rows.map(r=>r[xk]),y=rows.map(r=>r[yk]); const fit=linearFit(x,y), st=D.pm25_pilot_stats[xk][yk];
  const xs=[Math.min(...x),Math.max(...x)], ys=xs.map(v=>fit.intercept+fit.slope*v);
  const groups=[...new Set(rows.map(r=>r['Região']))]; const tr=groups.map(g=>{const rr=rows.filter(r=>r['Região']===g);return {x:rr.map(r=>r[xk]),y:rr.map(r=>r[yk]),text:rr.map(r=>r.Capital),mode:'markers+text',textposition:'top center',name:g,marker:{size:11,color:regionColors[g]||colors.teal,line:{color:'#fff',width:1.5}},hovertemplate:'<b>%{text}</b><br>x %{x:.2f}<br>y %{y:.2f}%<extra></extra>'};}); tr.push({x:xs,y:ys,mode:'lines',name:'OLS',line:{color:colors.navy,width:2,dash:'dash'},hoverinfo:'skip'});
  $('#envScatterTitle').textContent=`${envExposureLabels[xk]} × ${envOutcomeLabels[yk]}`; const sig=$('#envSig'); sig.textContent=st.p_pearson<.05?'associação detectável':'evidência fraca'; sig.style.background=st.p_pearson<.05?'#e8f8f1':'#f2f5f8'; sig.style.color=st.p_pearson<.05?'#176c49':'#647486';
  plot('envScatter',tr,{xaxis:{title:envExposureLabels[xk],gridcolor:'#edf2f6'},yaxis:{title:'Taxa hospitalar média (%)',gridcolor:'#edf2f6'},legend:{orientation:'h',y:-.23}});
  $('#envMetrics').innerHTML=`
    <div class="metric-block emphasis"><span>Pearson</span><strong>r = ${f(st.r,3)}</strong><small>p ${fp(st.p_pearson)} · R² ${f(st.r2,3)}</small></div>
    <div class="metric-block"><span>Spearman</span><strong>ρ = ${f(st.rho,3)}</strong><small>p ${fp(st.p_spearman)} · robusto à forma linear</small></div>
    <div class="metric-block"><span>Regressão HC1</span><strong>${pp(st.slope*10,2)}</strong><small>por +10 unidades da exposição; IC95% ${f(st.ci_low*10,2)} a ${f(st.ci_high*10,2)}</small></div>
    <div class="metric-block"><span>Leave-one-out</span><strong>r ${f(st.loo_r_min,2)} → ${f(st.loo_r_max,2)}</strong><small>maior p ao retirar uma capital: ${fp(st.loo_p_max)}</small></div>`;
  const loo=rows.map((r0,i)=>{const rr=rows.filter((_,j)=>j!==i);return {cap:r0.Capital,r:pearson(rr.map(r=>r[xk]),rr.map(r=>r[yk]))};}).sort((a,b)=>a.r-b.r);
  plot('envLoo',[{x:loo.map(d=>d.r),y:loo.map(d=>d.cap),mode:'markers',marker:{size:9,color:loo.map(d=>d.r>=0?colors.teal:colors.red)},type:'scatter'}],{margin:{l:95,r:25,t:10,b:40},xaxis:{title:'r após excluir a capital',zeroline:true,zerolinecolor:'#607386',gridcolor:'#edf2f6'},yaxis:{gridcolor:'rgba(0,0,0,0)'}});
  const outs=['Mortalidade geral','Masculino','Feminino','60–69','70–79','80+']; const vals=outs.map(o=>D.pm25_panel_stats[o].full);
  plot('envFixedEffects',[{x:vals.map(v=>v.coef*10),y:outs,mode:'markers',marker:{size:9,color:vals.map(v=>v.p<.05?colors.red:colors.violet)},error_x:{type:'data',symmetric:false,array:vals.map(v=>(v.ci_high-v.coef)*10),arrayminus:vals.map(v=>(v.coef-v.ci_low)*10),color:'#8798a9'},customdata:vals.map(v=>[v.p,v.r2]),hovertemplate:'<b>%{y}</b><br>%{x:.2f} p.p. por +10 µg/m³<br>p %{customdata[0]:.4f}<br>R² modelo %{customdata[1]:.2f}<extra></extra>'}],{margin:{l:105,r:25,t:10,b:42},xaxis:{title:'Coeficiente por +10 µg/m³',zeroline:true,zerolinecolor:'#33485d',gridcolor:'#edf2f6'},yaxis:{gridcolor:'rgba(0,0,0,0)'}});
  $('#envCaveat').textContent=`No piloto de 12 capitais, a associação é entre médias de exposição e médias de mortalidade de 2010–2019; portanto, diferenças estruturais entre cidades podem confundir o resultado. O painel de 7 capitais controla características fixas da capital e do ano, mas ainda tem apenas 42 observações e 7 cidades. Por isso, efeito, IC95%, estabilidade leave-one-out e análise de primeira diferença são mostrados juntos.`;
}

function renderModels(){
  const keys=['Taxa mortalidade geral','Masc','Fem','60 a 69 anos','70 a 79 anos','80 anos e mais']; const realKeys=keys.filter(k=>D.analysis[k].segmented_2020);
  const pre=realKeys.map(k=>D.analysis[k].segmented_2020), post=pre;
  plot('segmentedForest',[
    {x:pre.map(v=>v.pre_slope),y:realKeys.map(outcomeLabel),mode:'markers',name:'pré-2020',marker:{size:8,color:colors.muted},error_x:{type:'data',symmetric:false,array:pre.map(v=>v.pre_ci[1]-v.pre_slope),arrayminus:pre.map(v=>v.pre_slope-v.pre_ci[0]),color:'#aab6c0'}},
    {x:post.map(v=>v.post_slope),y:realKeys.map(outcomeLabel),mode:'markers',name:'pós-2020',marker:{size:10,color:colors.teal},error_x:{type:'data',symmetric:false,array:post.map(v=>v.post_ci[1]-v.post_slope),arrayminus:post.map(v=>v.post_slope-v.post_ci[0]),color:colors.teal}}
  ],{margin:{l:120,r:30,t:10,b:60},xaxis:{title:'Inclinação (p.p./ano)',zeroline:true,zerolinecolor:'#2f4457',gridcolor:'#edf2f6'},yaxis:{gridcolor:'rgba(0,0,0,0)'},legend:{orientation:'h',y:-.16}});
  const g=D.analysis['Taxa mortalidade geral'], bp=g.breakpoint, s=g.segmented_2020;
  $('#modelNarrative').innerHTML=`
    <div class="model-row"><div><b>Linha única 2008–2025</b><span>explica mal uma série que muda de direção</span></div><span class="model-value">AIC ${f(bp?.linear_aic,1)}</span></div>
    <div class="model-row"><div><b>Duas inclinações</b><span>melhor ponto descritivo em ${bp?.year||'—'}</span></div><span class="model-value">AIC ${f(bp?.aic,1)}</span></div>
    <div class="model-row"><div><b>Ganho do modelo segmentado</b><span>ΔAIC > 10 é suporte forte</span></div><span class="model-value">Δ ${f(bp?.delta_aic,1)}</span></div>
    <div class="model-row"><div><b>Pós-2020 — painel</b><span>efeitos fixos + SE por capital</span></div><span class="model-value">${pp(s?.post_slope,2)}/ano</span></div>`;
  const p80=D.pm25_panel_stats['80+'];
  $('#sensitivityNarrative').innerHTML=`
    <div class="model-row"><div><b>Modelo completo</b><span>7 capitais × 2018–2023</span></div><span class="model-value">${pp(p80.full.coef*10,2)} / +10 µg/m³</span></div>
    <div class="model-row"><div><b>Sem 2020–2021</b><span>sensibilidade ao choque pandêmico</span></div><span class="model-value">${pp(p80.exclude_2020_2021.coef*10,2)}</span></div>
    <div class="model-row"><div><b>Primeira diferença</b><span>ΔPM2,5 × Δmortalidade anual</span></div><span class="model-value">p ${fp(p80.first_difference.p_coef)}</span></div>
    <div class="model-row"><div><b>Interpretação</b><span>sinal positivo, porém ainda impreciso</span></div><span class="model-value">p ${fp(p80.full.p)}</span></div>`;
}

function renderQuality(){
  const m=[...D.missingness].sort((a,b)=>a.coverage_pct-b.coverage_pct);
  plot('coveragePlot',[{x:m.map(d=>d.coverage_pct),y:m.map(d=>d.label),type:'bar',orientation:'h',marker:{color:m.map(d=>d.coverage_pct<50?colors.red:d.coverage_pct<80?colors.amber:colors.teal)},text:m.map(d=>`${f(d.coverage_pct,1)}%`),textposition:'outside',hovertemplate:'<b>%{y}</b><br>cobertura %{x:.1f}%<extra></extra>'}],{height:Math.max(400,m.length*22),margin:{l:120,r:48,t:10,b:40},xaxis:{range:[0,106],title:'Cobertura (%)',gridcolor:'#edf2f6'},yaxis:{gridcolor:'rgba(0,0,0,0)'},showlegend:false});
  $('#anomalyBody').innerHTML=D.anomalies.slice(0,18).map(a=>`<tr><td><b>${a.capital}</b></td><td>${a.from} → ${a.to}</td><td>${f(a.before)}</td><td>${f(a.after)}</td><td>${pp(a.delta,2)}</td><td>${f(a.modified_z,2)}</td></tr>`).join('');
}

function renderPage(p){ if(p==='overview')renderOverview(); if(p==='trends')renderTrends(); if(p==='profiles')renderProfiles(); if(p==='environment')renderEnvironment(); if(p==='models')renderModels(); if(p==='quality')renderQuality(); }
function renderAll(){ updateContext(); renderOverview(); if(state.page!=='overview')renderPage(state.page); }

function init(){
  populateOutcomeSelect(); populateRegions(); populateCapitals(); setupNav(); setupFilters(); setupEnvControls();
  $('#trendSearch').addEventListener('input',renderTrendTable);
  updateContext(); renderOverview(); renderTrends(); renderProfiles(); renderEnvironment(); renderModels(); renderQuality();
  window.addEventListener('resize',()=>{window.Plotly&&$$('.page.active .js-plotly-plot').forEach(el=>Plotly.Plots.resize(el));});
}
window.addEventListener('DOMContentLoaded',init);
