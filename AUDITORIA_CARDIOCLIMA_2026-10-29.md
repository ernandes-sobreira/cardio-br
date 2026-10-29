# CardioClima BR — auditoria de funcionamento, conteúdo e interface
**Data:** 29/10/2026  
**Versão examinada:** v17, ramo `main`  
**Versão de correção proposta:** v18, ramo `audit/2026-10-29-filtros-visual`  
**Status:** correções v18 publicadas na branch principal em 29/10/2026, por meio do PR #1 (commit `1d7cdc527a243898edf0b8a9306675dfe6fc533b`).

## 1. Achados confirmados no código original

| Prioridade | Problema | Evidência e efeito |
|---|---|---|
| **Crítica** | Contador de tendências robustas incorreto | `app-core.js` contava classificações com `includes('robusta')`, incluindo literalmente **"sem tendência robusta"**. O cartão "26/27" na captura não deve ser tratado como resultado validado. |
| **Alta** | Mistura de recortes no Panorama | Após filtrar uma região/capital, cartões de inclinação pós-2020 continuavam consumindo o modelo nacional; o ranking ignorava a capital selecionada e a estatística das tendências robustas ignorava o recorte. |
| **Alta** | Ambiente ignora filtros geográficos globais | `envMergedRows` reunia todas as capitais sem usar `state.region` ou `state.capital`. A aba usa `state.envOutcome` separado do indicador superior. |
| **Alta** | Modelos nacionais exibidos mesmo sob filtro local | Modelos de efeitos fixos disponíveis estão pré-calculados para o Brasil; não podem ser descritos como estimativas de uma capital/região apenas pela seleção da interface. |
| **Média** | Perfis e tendências não deixam claro o escopo | Gráficos comparativos são intencionalmente fixos; outros componentes ignoravam o recorte geográfico. |
| **Média** | Responsividade e leitura no celular | A regra `@media(max-width:500px)` escondia o seletor Região; em modo de visualização de desktop no telefone a barra lateral pode permanecer visível. A captura também mostra textos muito pequenos. |
| **Média** | Exportação CSV do topo ignora filtros | O botão inicial sempre exportava todas as 486 linhas, sem considerar capital, região ou indicador selecionado. |
| **Média** | Renderização antecipada de abas ocultas | O `init` tentava construir gráficos de todas as páginas, incluindo seções com dimensão oculta; desperdício de processamento e possibilidade de medições incorretas. |

## 2. Correções implementadas nesta proposta de revisão

- Contagem estrita apenas de `queda robusta` e `alta robusta`; **não publicamos um novo número sem recálculo da base real**.
- Panorama: KPIs, ranking, painel de quebra, interpretações e taxa por idade passam a respeitar o recorte. Estimativa pós-2020 nacional não é mostrada como resultado regional.
- Tendências: tabela e forest plot restringem-se à capital quando uma capital é selecionada.
- Perfis: recorte geográfico aplicado ao comparativo regional e à completude de raça/cor; explicação da independência dos painéis etários/sexo em relação ao indicador principal.
- Ambiente: dispersão, trajetória e ranking acompanham capital/região; indicador global é sincronizado com o desfecho ambiental. Para recortes subnacionais, modelos nacionais ficam **indisponíveis**, com motivo exposto, sem coeficientes, ICs ou p-valores falsamente atribuídos ao local.
- Modelos: aviso explícito de estimativas nacionais pré-calculadas e não vinculadas aos filtros locais.
- Exportação: botão superior fornece CSV do recorte e variável selecionados; a aba Método preserva o CSV completo.
- Interface: tema claro, melhor hierarquia visual, sidebar clara, cartões menos pesados, filtros de Indicador/Capital/Região acessíveis no celular, gráficos compactos para seleções pequenas.
- Legenda científica mais exata para `Taxa mortalidade geral`: *Mortalidade hospitalar · circulatórias*.

## 3. Verificações executadas

1. **Parsing de JavaScript:** `app-core.js` e `app-modules.js` compilam sintaticamente sem erro.
2. **Integridade de interface:** 84 IDs HTML; todos os seletores diretos `$('#...')` presentes; nenhum ausente.
3. **CSS:** chaves equilibradas; seletor de Região restabelecido em regras móveis.
4. **Cache:** referências de scripts e CSS internas atualizadas para `v18`.
5. **Teste lógico com dados simulados:** para duas capitais, com uma classe "sem tendência robusta" e outra "queda robusta", o contador passou a mostrar `1/2` nacional e `1/1` para o recorte regional da capital robusta. O KPI segmentado local mostrou indisponível. O módulo ambiental passou a distinguir modelo nacional de visualização local descritiva.
6. **Dados PM2,5:** verificados os 5 campos de exposição, 21 desfechos e a presença de estatísticas pré-calculadas para todas as combinações.

**Limite de teste:** a página pública está em `main`; não houve teste ponta a ponta com toques reais no navegador móvel, nem recálculo completo independente das estatísticas da base de mortalidade. Após a publicação, é recomendável realizar validação visual e de interação em dispositivo móvel real.

## 4. Pendências metodológicas recomendadas

1. Recuperar consulta exata do TabNet/SIH-SUS, filtros, código de extração e data do download. O próprio projeto informa que essa proveniência não foi preservada. Sem isso, a cadeia de reprodutibilidade da saúde permanece incompleta.
2. Diferenciar claramente **mortalidade hospitalar** (óbitos/internações) de mortalidade populacional; evitar denominar média simples não ponderada das capitais como "taxa brasileira" de todos os residentes/hospitais.
3. Revisar a interpretação de `IC95%` calculado sobre a dispersão entre capitais. As 27 capitais não são uma amostra probabilística de todos os municípios; considerar intervalo de dispersão entre capitais ou declarar explicitamente as hipóteses.
4. Caso se deseje p-valores e modelos locais no módulo Ambiente, ajustar novos modelos para cada recorte com verificação de amostra, graus de liberdade, intervalos e erros-padrão, em vez de reaproveitar resultados nacionais.
5. Revisar, após validação, a dependência de Plotly por CDN externo: quando não carrega, a função `plot` original não explica o motivo da ausência dos gráficos.
6. Executar bateria final de navegação em Android, iOS e desktop; testar todas as combinações de indicador, capital, região, exportação e ausência de dados.

## 5. Checklist de verificação no aplicativo publicado

- [ ] Alterar Indicador, Capital e Região e verificar títulos, gráficos, KPIs e exportação no Panorama.
- [ ] Confirmar que "tendências robustas" corresponde à contagem **exclusiva** das classificações robustas na base real.
- [ ] Escolher capital e checar que nenhum coeficiente nacional de efeitos fixos aparece como estimativa daquela capital.
- [ ] Mudar a seleção de desfecho na aba Ambiente e conferir sincronização com o indicador superior.
- [ ] No celular, acessar os três filtros sem modo desktop obrigatório e testar o menu.
- [ ] Exportar CSV filtrado e CSV integral; comparar linhas e colunas.
- [ ] Conferir o sinal, unidade e métodos de cada gráfico contra dados de origem e relatório estatístico.

> Esta revisão preserva a base científica armazenada e não altera resultados estatísticos pré-calculados; altera a apresentação e o uso coerente dos recortes.