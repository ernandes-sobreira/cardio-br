# CardioClima BR

Plataforma científica interativa para exploração de tendências de mortalidade **hospitalar** por doenças do aparelho circulatório nas capitais brasileiras e análises ecológicas exploratórias de PM2,5.

**Versão de interface:** v18 (29/10/2026).

**Desenvolvimento:** Ernandes Sobreira Oliveira Junior e Letícia Carvalho Zen.

## Propriedade intelectual

O programa de origem foi registrado como **Cardio BR** no Instituto Nacional da Propriedade Industrial (INPI):

- **Registro:** BR512026007006-6.
- **Data de expedição:** 01/09/2026.
- **Titular:** Universidade do Estado de Mato Grosso (UNEMAT).
- **Autores:** Ernandes Sobreira Oliveira Junior e Letícia Carvalho Zen.
- **Linguagens registradas:** HTML, JavaScript e CSS.

O certificado identifica a documentação técnica registrada na data do depósito, não cada nova versão da plataforma. Esta atualização (v18) não é apresentada como um novo registro INPI. O original associado ao hash SHA-512 do certificado deve continuar preservado pela titular; o ramo `historico/antes-v18-2026-10-29` guarda somente o **estado do repositório antes da atualização**, sem alegação de equivalência com o arquivo original depositado.

## Escopo e limites

- Saúde: dados SIH/SUS 2008–2025, 27 capitais; taxas de mortalidade **hospitalar**, não mortalidade populacional.
- PM2,5: série anual 2008–2024, 27 capitais, derivada de dados CAMS/EAC4 publicados no Zenodo.
- Indicadores agregados representam médias simples das capitais, não taxas nacionais ponderadas.
- Modelos de efeitos fixos na aba Ambiente são nacionais pré-calculados. Recortes de capital ou região mostram informações **descritivas** sem reutilizar coeficientes nacionais como se fossem locais.
- Correlação ecológica não demonstra causalidade individual.
- A consulta original de extração do SIH/SUS não foi preservada nos metadados e precisa ser recuperada para reprodutibilidade integral.

## Revisão técnica

Veja [AUDITORIA_CARDIOCLIMA_2026-10-29.md](AUDITORIA_CARDIOCLIMA_2026-10-29.md) para os achados e os testes realizados.

> O registro de programa de computador não define, por si só, uma licença pública para redistribuição ou exploração comercial. A titularidade indicada no certificado é da UNEMAT.
