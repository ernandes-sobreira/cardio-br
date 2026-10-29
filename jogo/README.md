# Pulso da Cidade — CardioClima Kids

**Jogo educacional navegável e instalável em dispositivos compatíveis.** Não é quiz: a criança move personagens, arrasta recursos urbanos, conduz uma hemácia pela circulação e constrói dados durante as decisões.

## Acesso
[**Jogar no navegador**](https://ernandes-sobreira.github.io/cardio-br/jogo/)

## Três missões
1. **Calor na escola:** caminhar sob o sol, buscar sombra e água, chegar à escola e completar a circulação da hemácia.
2. **Fumaça no bairro:** buscar abrigo e ar interno filtrado, evitar corrida durante fumaça e completar a circulação.
3. **Calor + fumaça:** combinar medidas de proteção e comparar índices do jogo.

## Mecânicas
- Mova o personagem por toque, arrasto, teclado ou setas; caminhe ou corra.
- Toque/arraste toldos, árvores e bebedouros para planejar proteção.
- Entre num abrigo, beba água e ligue filtragem de ar.
- Ajuste temperatura e PM2,5 de **cenários fictícios**. Calor, irritação, hidratação, índice de proteção e batimentos **ilustrativos** respondem a ações; **não são medições ou predições médicas**.
- Arraste a hemácia entre tecidos, veias cavas, átrio direito, valva tricúspide, ventrículo direito, artéria pulmonar, pulmões, veias pulmonares, átrio esquerdo, valva mitral, ventrículo esquerdo, aorta e tecidos; alternativamente toque nos nós ou avance pelo botão.
- A simulação constrói um gráfico e permite CSV explicitamente rotulado como fictício.
- A guia **Dados reais** carrega as séries SIH/SUS (mortalidade hospitalar, 2008–2025) e PM2,5 CAMS/EAC4 (2008–2024) **do repositório CardioClima**, em gráficos independentes por capital e ano. Se não houver acesso, não se inventam números.
- Progresso local, som opcional, design responsivo.

## Ciência
O sangue passa pelo coração direito para os pulmões, recebe oxigênio e volta ao coração esquerdo antes de seguir para o corpo. O calor pede hidratação, sombra e menor esforço; em eventos de fumaça, reduzir exposição e buscar ar interno mais limpo são estratégias de proteção. Os índices do jogo **não** são usados para inferência clínica nem para atribuir causalidade às séries reais.

Fontes: [NIH — circulação](https://www.nhlbi.nih.gov/health/heart/blood-flow), [CDC — calor](https://www.cdc.gov/heat-health/about/), [CDC — fumaça e crianças](https://www.cdc.gov/wildfires/risk-factors/wildfire-smoke-and-children.html), [PM2,5 Zenodo](https://doi.org/10.5281/zenodo.16374139).

## Implementação
Jogo em HTML/CSS/JS sem bibliotecas. PWA com recursos essenciais disponíveis offline; carregamento das bases reais depende de conexão. O jogo permanece numa pasta separada e não altera a plataforma científica.

## Registro e governança
O software original **Cardio BR** possui registro INPI **BR512026007006-6**, titular UNEMAT e autores Ernandes Sobreira Oliveira Junior e Letícia Carvalho Zen. **Este jogo é uma nova aplicação e não se deve afirmar que possui registro próprio no INPI.** Recomenda-se consultar a AGINOV sobre novo depósito e uso institucional.
