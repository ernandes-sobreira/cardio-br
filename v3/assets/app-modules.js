function renderTrends(){
  const aggregate=state.capital==='ALL';
  const scope=scopeName();
  const t=aggregate
    ? window.CARDIOCLIMA_SCOPE_TRENDS?.[scope]?.[state.outcome] || null
    : getTrendForCapital(state.capital,state.outcome);
  const s=seriesForScope(state.outcome).filter(d=>d.mean!=null);
  const x=s.map(d=>d.year), y=s.map(d=>d.mean);

  $('#capitalTrendTitle').textContent=`${scope} · ${outcomeLabel(state.outcome)}`;
  const badge=$('#capitalTrendBadge');
  badge.textContent=t?.classificacao||'cobertura insuficiente';
  badge.className=`trend-badge ${classForTrend(t)}`;

  if(s.length){
    const lf=linearFit(x,y);
    const traces=[];
    if(aggregate && s.some(d=>d.ci_low!=null&&d.ci_high!=null)){
      const lo=s.map(d=>d.ci_low), hi=s.map(d=>d.ci_high);
      traces.push({
        x:x.concat([...x].reverse()),y:hi.concat([...lo].reverse()),
        fill:'toself',fillcolor:'rgba(11,143,138,.10)',line:{color:'rgba(0,0,0,0)'},
        hoverinfo:'skip',showlegend:false
      });
    }
    traces.push({
      x,y,mode:'lines+markers',name:aggregate?'média anual do escopo':'observado',
      line:{color:colors.navy,width:2},
      marker:{size:7,color:'#fff',line:{color:colors.navy,width:2}}
    });
    if(t) traces.push({
      x,y:lf.pred,mode:'lines',name:'tendência linear',
      line:{color:colors.teal,width:3,dash:'dash'}
    });
    plot('capitalTrendPlot',traces,{
      yaxis:{title:'Taxa hospitalar (%)',gridcolor:'#edf2f6'},
      xaxis:{dtick:2,gridcolor:'#f0f3f6'}
    });
  }

  if(t){
    const third=aggregate
      ? `<div class="metric-block"><span>Escopo da análise</span><strong>${scope}</strong><small>${state.region==='ALL'?'média anual entre as 27 capitais':'média anual das capitais da região'} · FDR não se aplica ao agregado</small></div>`
      : `<div class="metric-block"><span>FDR entre capitais</span><strong>q = ${fp(t.q_fdr)}</strong><small>${t.q_fdr<.05?'permanece significativo após múltiplos testes':'não permanece significativo a 5%'}</small></div>`;
    $('#capitalTrendMetrics').innerHTML=`
      <div class="metric-block emphasis"><span>APC log-linear</span><strong>${pct(t.apc,2)}/ano</strong><small>IC95% ${pct(t.apc_low,2)} a ${pct(t.apc_high,2)}</small></div>
      <div class="metric-block"><span>Inclinação linear · HAC(1)</span><strong>${pp(t.slope,2)}/ano</strong><small>IC95% ${f(t.ci_low)} a ${f(t.ci_high)} · p ${fp(t.p)}</small></div>
      ${third}
      <div class="metric-block"><span>Theil–Sen</span><strong>${pp(t.theil_sen,2)}/ano</strong><small>estimador robusto a valores extremos</small></div>
      <div class="metric-block"><span>Variação ponta a ponta</span><strong>${pct(t.pct_change,1)}</strong><small>${t.year_start} → ${t.year_end}; não substitui a tendência</small></div>`;
  } else {
    $('#capitalTrendMetrics').innerHTML='<div class="metric-block">Observações insuficientes para estimar a tendência.</div>';
  }

  const forestScope=$('#trendForestScope');
  if(forestScope) forestScope.textContent=state.region==='ALL'?'27 CAPITAIS':`CAPITAIS · ${state.region.toUpperCase()}`;
  renderSlopeForest();
  renderTrendTable();
}
function renderSlopeForest(){
  const items=Object.entries(D.analysis[state.outcome].capital_trends||{})
    .filter(([capital,t])=>t&&t.n>=8&&(state.region==='ALL'||D.capitals[capital]?.region===state.region))
    .map(([capital,t])=>({capital,...t}))
    .sort((a,b)=>a.slope-b.slope);
  plot('slopeForest',[{
    x:items.map(d=>d.slope),y:items.map(d=>d.capital),mode:'markers',type:'scatter',
    marker:{size:8,color:items.map(d=>d.q_fdr<.05?(d.slope<0?colors.green:colors.red):'#9aa9b8')},
    error_x:{type:'data',symmetric:false,array:items.map(d=>d.ci_high-d.slope),arrayminus:items.map(d=>d.slope-d.ci_low),color:'#9aabba',thickness:1},
    customdata:items.map(d=>[d.apc,d.p,d.q_fdr,d.classificacao]),
    hovertemplate:'<b>%{y}</b><br>inclinação %{x:.3f} p.p./ano<br>APC %{customdata[0]:.2f}%<br>p %{customdata[1]:.4f}<br>q %{customdata[2]:.4f}<br>%{customdata[3]}<extra></extra>'
  }],{
    height:Math.max(420,items.length*24),margin:{l:105,r:30,t:10,b:45},
    xaxis:{title:'Mudança estimada por ano (p.p.)',gridcolor:'#edf2f6',zeroline:true,zerolinecolor:'#31465a',zerolinewidth:1},
    yaxis:{gridcolor:'rgba(0,0,0,0)'}
  });
}
function renderTrendTable(){
  const term=($('#trendSearch')?.value||'').toLowerCase();
  const rows=Object.entries(D.analysis[state.outcome].capital_trends||{})
    .filter(([capital,t])=>t&&capital.toLowerCase().includes(term)&&(state.region==='ALL'||D.capitals[capital]?.region===state.region))
    .map(([capital,t])=>({capital,...t}))
    .sort((a,b)=>a.apc-b.apc);
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
  $('#raceWarning').innerHTML=`A completude varia fortemente: <b>${race[0].label}</b> tem apenas ${f(race[0].coverage_pct,1)}% de cobertura, enquanto <b>${race.at(-1).label}</b> chega a ${f(race.at(-1).coverage_pct,1)}%. Comparações de raça/cor devem ser secundárias e acompanhadas da cobertura.`;
  plot('raceCoverage',[{x:race.map(d=>d.coverage_pct),y:race.map(d=>d.label),type:'bar',orientation:'h',marker:{color:race.map(d=>d.coverage_pct<70?colors.amber:colors.teal)},text:race.map(d=>`${f(d.coverage_pct,1)}%`),textposition:'outside'}],{margin:{l:100,r:45,t:10,b:40},xaxis:{range:[0,105],title:'Cobertura (%)',gridcolor:'#edf2f6'},showlegend:false});
}

const envExposureLabels = {
  pm25_media:'PM2,5 média anual (µg/m³)',
  pm25_p95:'PM2,5 P95 diário (µg/m³)',
  pm25_p99:'PM2,5 P99 diário (µg/m³)',
  dias_acima_15_pct:'Dias > 15 µg/m³ (%)',
  dias_acima_25_pct:'Dias > 25 µg/m³ (%)'
};

function setupEnvControls(){
  const P=window.CARDIOCLIMA_PM25_ALL;
  const ex=$('#envExposure'), oy=$('#envOutcome'), run=$('#envRun');
  if(!P){
    $('#envRunStatus').textContent='Base nacional de PM2,5 não carregada.';
    run.disabled=true;
    return;
  }

  ex.innerHTML=Object.entries(P.exposures||envExposureLabels)
    .map(([v,l])=>`<option value="${v}">${l}</option>`).join('');

  const groups=['Geral','Sexo','Idade','Raça/cor'];
  oy.innerHTML='';
  groups.forEach(g=>{
    const entries=Object.entries(P.outcomes||{}).filter(([,m])=>m.group===g);
    if(!entries.length) return;
    const og=document.createElement('optgroup'); og.label=g;
    entries.forEach(([v,m])=>{
      const o=document.createElement('option');
      o.value=v; o.textContent=m.label||v; og.appendChild(o);
    });
    oy.appendChild(og);
  });

  if(!(state.envExposure in P.exposures)) state.envExposure='pm25_media';
  if(!(state.envOutcome in P.outcomes)) state.envOutcome='Taxa mortalidade geral';
  ex.value=state.envExposure;
  oy.value=state.envOutcome;

  run.addEventListener('click',()=>{
    state.envExposure=ex.value;
    state.envOutcome=oy.value;
    renderEnvironment();
    const meta=P.meta||{};
    $('#envRunStatus').innerHTML=`Análise recalculada: <b>${P.exposures[state.envExposure]}</b> × <b>${P.outcomes[state.envOutcome]?.label||state.envOutcome}</b> · ${meta.n_capitals||27} capitais · ${meta.period||'2008–2024'}.`;
  });
}

function envScaleInfo(xk){
  if(String(xk).endsWith('_pct')) return {scale:10,label:'+10 p.p. de dias'};
  return {scale:10,label:'+10 µg/m³'};
}

function envMergedRows(xk,yk){
  const P=window.CARDIOCLIMA_PM25_ALL;
  if(!P) return [];
  const healthMap=new Map(D.mortality.map(r=>[`${r.Capital}|${r.Ano}`,r]));
  return P.annual.map(pm=>{
    const h=healthMap.get(`${pm.Capital}|${pm.Ano}`);
    const y=h?safe(h[yk]):null;
    const x=safe(pm[xk]);
    return {pm,h,x,y,Capital:pm.Capital,Ano:pm.Ano,Região:pm['Região']};
  }).filter(r=>r.x!=null&&r.y!=null);
}

function renderEnvironment(){
  const P=window.CARDIOCLIMA_PM25_ALL;
  if(!P){
    $('#envMetrics').innerHTML='<div class="metric-block">Base nacional de PM2,5 não carregada.</div>';
    return;
  }

  const xk=state.envExposure, yk=state.envOutcome;
  const exposureLabel=P.exposures[xk]||xk;
  const outcomeMeta=P.outcomes[yk]||{label:yk,group:'Outro'};
  const rows=envMergedRows(xk,yk);
  const st=P.stats?.[xk]?.outcomes?.[yk];
  const fe=st?.fixed_effects?.full;
  const sens=st?.fixed_effects?.exclude_2020_2021;
  const diff=st?.fixed_effects?.first_difference;
  const scale=envScaleInfo(xk);

  if(!rows.length||!st){
    $('#envMetrics').innerHTML='<div class="metric-block">Não há observações suficientes para esta combinação.</div>';
    return;
  }

  const regions=['Norte','Nordeste','Centro-Oeste','Sudeste','Sul'];
  const traces=regions.map(reg=>{
    const rr=rows.filter(r=>r.Região===reg);
    return {
      x:rr.map(r=>r.x),
      y:rr.map(r=>r.y),
      text:rr.map(r=>`${r.Capital} · ${r.Ano}`),
      mode:'markers',
      type:'scatter',
      name:reg,
      marker:{size:7,opacity:.66,color:regionColors[reg]||colors.teal,line:{color:'#fff',width:.6}},
      hovertemplate:'<b>%{text}</b><br>Exposição: %{x:.2f}<br>Saúde: %{y:.2f}%<extra></extra>'
    };
  }).filter(t=>t.x.length);

  const lf=linearFit(rows.map(r=>r.x),rows.map(r=>r.y));
  const xmin=Math.min(...rows.map(r=>r.x)), xmax=Math.max(...rows.map(r=>r.x));
  traces.push({
    x:[xmin,xmax],y:[lf.intercept+lf.slope*xmin,lf.intercept+lf.slope*xmax],
    mode:'lines',name:'OLS bruta',line:{color:colors.navy,width:2,dash:'dash'},hoverinfo:'skip'
  });

  $('#envScatterTitle').textContent=`${exposureLabel} × ${outcomeMeta.label}`;
  const sig=$('#envSig');
  if(fe){
    sig.textContent=fe.p<.05?'efeito fixo: p < 0,05':'efeito fixo: p ≥ 0,05';
    sig.style.background=fe.p<.05?'#e8f8f1':'#f2f5f8';
    sig.style.color=fe.p<.05?'#176c49':'#647486';
  } else {
    sig.textContent='modelo indisponível';
  }

  plot('envScatter',traces,{
    xaxis:{title:exposureLabel,gridcolor:'#edf2f6'},
    yaxis:{title:`${outcomeMeta.label} · taxa hospitalar (%)`,gridcolor:'#edf2f6'},
    legend:{orientation:'h',y:-.22}
  });

  const coefText=fe?pp(fe.coef*scale.scale,2):'—';
  const ciText=fe?`${f(fe.ci_low*scale.scale,2)} a ${f(fe.ci_high*scale.scale,2)}`:'—';
  $('#envMetrics').innerHTML=`
    <div class="metric-block emphasis"><span>Efeitos fixos</span><strong>${coefText}</strong><small>${scale.label} · IC95% ${ciText} · p ${fe?fp(fe.p):'—'}</small></div>
    <div class="metric-block"><span>Cobertura</span><strong>${st.capitals} capitais</strong><small>${st.n} capital-anos com dados do grupo selecionado</small></div>
    <div class="metric-block"><span>Pearson bruto</span><strong>r = ${f(st.pearson?.r,3)}</strong><small>p ${fp(st.pearson?.p)} · não controla diferenças entre capitais/anos</small></div>
    <div class="metric-block"><span>Spearman bruto</span><strong>ρ = ${f(st.spearman?.rho,3)}</strong><small>p ${fp(st.spearman?.p)} · associação monotônica descritiva</small></div>
    <div class="metric-block"><span>R² do modelo FE</span><strong>${fe?f(fe.r2,3):'—'}</strong><small>efeitos fixos de capital + ano; SE agrupado por capital</small></div>`;

  // Tendência ambiental por região
  const years=[...new Set(P.annual.map(r=>r.Ano))].sort((a,b)=>a-b);
  const regTr=regions.map(reg=>{
    const y=years.map(year=>{
      const vals=P.annual.filter(r=>r.Região===reg&&r.Ano===year&&r[xk]!=null).map(r=>+r[xk]);
      return vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:null;
    });
    return {x:years,y,mode:'lines+markers',name:reg,line:{width:2.5,color:regionColors[reg]},marker:{size:4}};
  });
  plot('envRegionTrend',regTr,{
    xaxis:{dtick:2,gridcolor:'#edf2f6'},
    yaxis:{title:exposureLabel,gridcolor:'#edf2f6'},
    legend:{orientation:'h',y:-.24}
  });

  // Ranking mais recente completo
  const latest=Math.max(...P.annual.map(r=>r.Ano));
  const rank=P.annual.filter(r=>r.Ano===latest&&r[xk]!=null)
    .sort((a,b)=>a[xk]-b[xk]);
  $('#envRankingTitle').textContent=`Ranking da exposição · ${latest}`;
  plot('envCapitalRanking',[{
    x:rank.map(r=>r[xk]),y:rank.map(r=>r.Capital),type:'bar',orientation:'h',
    marker:{color:rank.map(r=>regionColors[r.Região]||colors.teal)},
    text:rank.map(r=>f(r[xk],1)),textposition:'outside',
    hovertemplate:'<b>%{y}</b><br>%{x:.2f}<extra></extra>'
  }],{
    height:Math.max(520,rank.length*19),margin:{l:105,r:45,t:10,b:45},
    xaxis:{title:exposureLabel,gridcolor:'#edf2f6'},yaxis:{gridcolor:'rgba(0,0,0,0)'},showlegend:false
  });

  $('#envPanelSummaryTitle').textContent=`${outcomeMeta.label} · efeitos fixos de capital e ano`;
  const psig=$('#envPanelSig');
  psig.textContent=fe?(fe.p<.05?'p < 0,05':'p ≥ 0,05'):'—';
  psig.style.background=fe?.p<.05?'#e8f8f1':'#f2f5f8';
  psig.style.color=fe?.p<.05?'#176c49':'#647486';

  $('#envPanelSummaryBody').innerHTML=`
    <div class="model-row"><div><b>Modelo completo 2008–2024</b><span>27 capitais; efeitos fixos de capital e ano</span></div><span class="model-value">${fe?pp(fe.coef*scale.scale,2):'—'} / ${scale.label}</span></div>
    <div class="model-row"><div><b>IC95% e p</b><span>erros-padrão agrupados por capital</span></div><span class="model-value">${fe?`${f(fe.ci_low*scale.scale,2)} a ${f(fe.ci_high*scale.scale,2)} · p ${fp(fe.p)}`:'—'}</span></div>
    <div class="model-row"><div><b>Sem 2020–2021</b><span>sensibilidade ao período pandêmico</span></div><span class="model-value">${sens?pp(sens.coef*scale.scale,2)+' · p '+fp(sens.p):'—'}</span></div>
    <div class="model-row"><div><b>Primeira diferença</b><span>mudanças anuais dentro de cada capital</span></div><span class="model-value">${diff?pp(diff.coef*scale.scale,2)+' · p '+fp(diff.p):'—'}</span></div>
    <div class="model-row"><div><b>Amostra efetiva</b><span>a cobertura do desfecho pode variar entre grupos</span></div><span class="model-value">${st.n} observações · ${st.capitals} capitais</span></div>`;

  $('#envCaveat').textContent=`A exposição ambiental agora usa uma única fonte para as 27 capitais: reanálise CAMS/EAC4 agregada aos limites municipais, com dados diários de 2008 a 2024. As correlações brutas são descritivas. O modelo longitudinal controla diferenças fixas entre capitais e choques comuns de cada ano, com erros-padrão agrupados por capital. Ainda assim, esta é uma análise ecológica e não estabelece causalidade individual. Para raça/cor e grupos com menor completude, a amostra efetiva aparece explicitamente na tela.`;
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
  const nat=window.CARDIOCLIMA_PM25_ALL;
  const envKey=nat?.outcomes?.[state.envOutcome]?state.envOutcome:'80 anos e mais';
  const pst=nat?.stats?.pm25_media?.outcomes?.[envKey];
  const full=pst?.fixed_effects?.full, sens=pst?.fixed_effects?.exclude_2020_2021, diff=pst?.fixed_effects?.first_difference;
  $('#sensitivityNarrative').innerHTML=`
    <div class="model-row"><div><b>PM2,5 nacional · modelo completo</b><span>27 capitais · 2008–2024 · ${nat?.outcomes?.[envKey]?.label||envKey}</span></div><span class="model-value">${full?pp(full.coef*10,2):'—'} / +10 µg/m³</span></div>
    <div class="model-row"><div><b>IC95% e p</b><span>efeitos fixos de capital e ano</span></div><span class="model-value">${full?`${f(full.ci_low*10,2)} a ${f(full.ci_high*10,2)} · p ${fp(full.p)}`:'—'}</span></div>
    <div class="model-row"><div><b>Sem 2020–2021</b><span>sensibilidade ao período pandêmico</span></div><span class="model-value">${sens?pp(sens.coef*10,2)+' · p '+fp(sens.p):'—'}</span></div>
    <div class="model-row"><div><b>Primeira diferença</b><span>mudança anual dentro da capital</span></div><span class="model-value">${diff?pp(diff.coef*10,2)+' · p '+fp(diff.p):'—'}</span></div>`;
}

function median(values){
  const a=[...values].filter(v=>v!=null&&Number.isFinite(+v)).map(Number).sort((x,y)=>x-y);
  if(!a.length) return null;
  const m=Math.floor(a.length/2);
  return a.length%2?a[m]:(a[m-1]+a[m])/2;
}

function qualityCoverage(){
  const rows=scopedRows();
  const total=rows.length;
  return Object.entries(D.outcomes).map(([key,meta])=>{
    const n=rows.filter(r=>safe(r[key])!=null).length;
    return {key,label:meta.label,group:meta.group,n,total,coverage_pct:total?100*n/total:0};
  }).sort((a,b)=>a.coverage_pct-b.coverage_pct);
}

function qualityAnomalies(){
  const outcome=state.outcome;
  const rows=scopedRows().filter(r=>safe(r[outcome])!=null);
  const capitals=[...new Set(rows.map(r=>r.Capital))];
  const out=[];

  capitals.forEach(capital=>{
    const s=rows.filter(r=>r.Capital===capital)
      .sort((a,b)=>a.Ano-b.Ano)
      .map(r=>({year:+r.Ano,value:safe(r[outcome])}))
      .filter(d=>d.value!=null);

    const diffs=[];
    for(let i=1;i<s.length;i++){
      if(s[i].year!==s[i-1].year+1) continue;
      diffs.push({
        capital,
        from:s[i-1].year,
        to:s[i].year,
        before:s[i-1].value,
        after:s[i].value,
        delta:s[i].value-s[i-1].value
      });
    }
    const med=median(diffs.map(d=>d.delta));
    const mad=med==null?null:median(diffs.map(d=>Math.abs(d.delta-med)));
    diffs.forEach(d=>{
      d.modified_z=mad&&mad>0?0.6745*(d.delta-med)/mad:null;
      out.push(d);
    });
  });

  return out.sort((a,b)=>{
    const az=a.modified_z==null?-1:Math.abs(a.modified_z);
    const bz=b.modified_z==null?-1:Math.abs(b.modified_z);
    if(bz!==az) return bz-az;
    return Math.abs(b.delta)-Math.abs(a.delta);
  });
}

function renderQuality(){
  const cov=qualityCoverage();
  const scope=scopeName();
  $('#coverageTitle').textContent=`Cobertura por indicador · ${scope}`;
  $('#coverageNote').textContent=`${scopedRows().length} registros capital-ano no escopo`;
  plot('coveragePlot',[{
    x:cov.map(d=>d.coverage_pct),y:cov.map(d=>d.label),type:'bar',orientation:'h',
    marker:{color:cov.map(d=>d.coverage_pct<50?colors.red:d.coverage_pct<80?colors.amber:colors.teal)},
    text:cov.map(d=>`${f(d.coverage_pct,1)}%`),textposition:'outside',
    customdata:cov.map(d=>[d.n,d.total,d.group]),
    hovertemplate:'<b>%{y}</b><br>cobertura %{x:.1f}%<br>%{customdata[0]}/%{customdata[1]} registros<br>%{customdata[2]}<extra></extra>'
  }],{
    height:Math.max(400,cov.length*22),margin:{l:120,r:48,t:10,b:40},
    xaxis:{range:[0,106],title:'Cobertura (%)',gridcolor:'#edf2f6'},
    yaxis:{gridcolor:'rgba(0,0,0,0)'},showlegend:false
  });

  const anomalies=qualityAnomalies();
  const top=anomalies[0];
  const label=outcomeLabel(state.outcome);

  if(top){
    const direction=top.delta<0?'queda':'aumento';
    $('#qualityAlertTitle').textContent=`${top.capital} · ${top.from} → ${top.to}`;
    $('#qualityAlertValues').textContent=`${f(top.before,2)} → ${f(top.after,2)}`;
    $('#qualityAlertDelta').textContent=`${direction} de ${f(Math.abs(top.delta),2)} pontos percentuais · ${label}`;
    $('#qualityAlertText').textContent=top.modified_z==null
      ? `Esta é a maior mudança ano a ano encontrada no escopo ${scope} para ${label}. O MAD das variações da capital não permite um z modificado estável; interprete pela magnitude e confira a série original.`
      : `Esta é a ruptura mais extrema no escopo ${scope} para ${label}, considerando o z modificado calculado dentro da própria série de ${top.capital} (|z| = ${f(Math.abs(top.modified_z),2)}). O alerta serve para auditoria do dado, não para concluir que a mudança seja erro ou efeito causal.`;
  } else {
    $('#qualityAlertTitle').textContent=`${scope} · ${label}`;
    $('#qualityAlertValues').textContent='—';
    $('#qualityAlertDelta').textContent='Sem pares de anos consecutivos suficientes';
    $('#qualityAlertText').textContent='Não há dados suficientes no escopo selecionado para calcular mudanças ano a ano.';
  }

  $('#anomalyTableTitle').textContent=`Maiores mudanças · ${scope} · ${label}`;
  $('#anomalyBody').innerHTML=anomalies.slice(0,18).map(a=>`<tr>
    <td><b>${a.capital}</b></td>
    <td>${a.from} → ${a.to}</td>
    <td>${f(a.before)}</td>
    <td>${f(a.after)}</td>
    <td>${pp(a.delta,2)}</td>
    <td>${a.modified_z==null?'—':f(a.modified_z,2)}</td>
  </tr>`).join('');
}

function renderPage(p){ if(p==='overview')renderOverview(); if(p==='trends')renderTrends(); if(p==='profiles')renderProfiles(); if(p==='environment')renderEnvironment(); if(p==='models')renderModels(); if(p==='quality')renderQuality(); }
function renderAll(){ updateContext(); renderOverview(); if(state.page!=='overview')renderPage(state.page); }

function init(){
  populateOutcomeSelect(); populateRegions(); populateCapitals(); setupNav(); setupFilters(); setupEnvControls();
  $('#trendSearch').addEventListener('input',renderTrendTable);
  updateContext(); renderOverview(); renderTrends(); renderProfiles(); renderEnvironment(); renderModels(); renderQuality();
  window.addEventListener('resize',()=>{window.Plotly&&$$('.page.active .js-plotly-plot').forEach(el=>Plotly.Plots.resize(el));});
}
async function boot(){
  try {
    D = window.CARDIOCLIMA_READY ? await window.CARDIOCLIMA_READY : window.CARDIOCLIMA_DATA;
    if (!D) throw new Error('Dados CardioClima não carregados.');
    init();
  } catch (err) {
    console.error('CardioClima boot:', err);
    const showError = () => {
      if (document.querySelector('[data-cardio-boot-error]')) return;
      const box = document.createElement('div');
      box.setAttribute('data-cardio-boot-error','');
      box.style.cssText = 'position:relative;z-index:99999;padding:14px 18px;background:#991b1b;color:#fff;font:600 14px system-ui';
      box.textContent = 'Falha ao iniciar o CardioClima: ' + err.message;
      document.body.prepend(box);
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', showError, {once:true});
    else showError();
  }
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true});
else boot();
