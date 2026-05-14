# Cliquerx Scraper

Scraper do catálogo de medicamentos do Cliquerx → Postgres do med.bula.com.br.

Estratégia: **BFS adaptativo por prefixo**. Não baixa tudo de uma vez — começa
com `q=a`, `q=b`, ..., e só expande pra 2 letras quando a query bater no limite
da API. Isso minimiza o número de requests (~500-2000 ao invés de 17k).

## Pré-requisitos

- Node 20+ (pra `fetch` nativo e `--env-file`)
- Postgres do med.bula.com.br rodando (local ou Docker)
- Migrations rodadas: `0017`, `0018`, `0019`

## Setup

```bash
cd scripts/cliquerx-scraper
npm install
cp .env.example .env
# edita o .env: Bearer, DB_*
```

## Fluxo

```bash
# 1. PROBE — descobre limite, paginação, formato da resposta
npm run probe

# 2. SCRAPE — baixa tudo (resumível, salva incrementalmente em data/)
npm run scrape

# 3. Acompanha
npm run stats

# 4. VALIDATE — checa cobertura com lista de DCBs+marcas e preenche lacunas
npm run validate

# 5. IMPORT — popula o Postgres via COPY (rápido)
npm run import
```

## Resumo dos scripts

| Script        | Função                                                      |
|---------------|-------------------------------------------------------------|
| `probe.mjs`   | Mapeia o comportamento da API (limite, paginação, headers). |
| `scrape.mjs`  | BFS adaptativo. Salva em `data/medications.json` + `data/posologies.json`. State em `data/.scrape-state.json`. |
| `validate.mjs`| Testa ~400 nomes conhecidos (DCBs ANVISA + marcas top BR). Mede cobertura do BFS e adiciona os que ficaram pra trás. Gera `data/validation-report.json`. |
| `import.mjs`  | Lê os JSONs e faz `COPY FROM STDIN` nas tabelas. Trunca antes. |

## Resume / Reset

```bash
# Continua de onde parou (default)
npm run scrape

# Apaga tudo e recomeça do zero
npm run scrape:reset
```

O scraper salva state a cada 20 prefixos processados. **Ctrl+C salva e sai limpo.**

## Parâmetros (no .env)

| Var | Default | O que faz |
|-----|---------|-----------|
| `SCRAPER_CONCURRENCY` | 4 | Workers paralelos |
| `SCRAPER_DELAY_MS` | 180 | Delay entre requests do mesmo worker (com jitter ±30%) |
| `SCRAPER_PAGE_LIMIT` | 50 | Quando count == este, expande o prefixo |
| `SCRAPER_MAX_DEPTH` | 5 | Profundidade máxima do prefixo |
| `SCRAPER_FETCH_POSOLOGIES` | true | Busca posologias junto |

⚠️ **Ajuste `SCRAPER_PAGE_LIMIT` depois de rodar o probe.** O default 50 é
chute — o probe vai te dizer o número real.

## Estrutura dos JSONs

`data/medications.json` — array de objetos do Cliquerx, dedupados pelo `id`:

```json
[
  {
    "id": "uuid",
    "title": "Diclofenaco Potássico 50 mg",
    "subtitle": "Comprimido • 20 un",
    "description": "...",
    "laboratoryName": "Aché",
    "category": "Genérico",
    "maxPrice": "19,78",
    "available": true,
    "listType": "N/A",
    "prescriptionType": "Simples",
    "ean1": "...",
    "requiresCpf": false,
    "unit": { "singular": "comprimido", "plural": "comprimidos" }
  }
]
```

`data/posologies.json` — array com `medicationId` adicionado:

```json
[
  {
    "medicationId": "uuid-do-medicamento",
    "posologyId": "...",
    "content": "Tomar 1 comprimido...",
    "indication": "Dor, Febre, Inflamação",
    "population": "Adultos",
    "type": "leaflet",
    "usageQuantity": 0
  }
]
```

## Busca no banco depois do import

```sql
-- Busca aproximada (tolerante a erros) — usa o índice GIN trgm
SELECT id, title, laboratory_name
FROM medications
WHERE search_text ILIKE '%' || lower(immutable_unaccent('paractm')) || '%'
ORDER BY similarity(search_text, lower(immutable_unaccent('paractm'))) DESC
LIMIT 20;

-- Só medicamentos disponíveis e não controlados
SELECT *
FROM medications
WHERE available = true
  AND (list_type IS NULL OR list_type = 'N/A')
  AND title ILIKE 'dipirona%';

-- Medicamentos com posologia adulto
SELECT m.title, p.content, p.indication
FROM medications m
JOIN medication_posologies p ON p.medication_id = m.id
WHERE p.population = 'Adultos'
  AND m.title ILIKE '%amoxicilina%';
```

## Atenção

- **Bearer token expira em ~2 anos** (decodificando o JWT, `exp=1778709488`).
  Se for re-scraper depois disso, vai precisar de um novo.
- O catálogo é **público entre todas as clínicas** — não tem `clinic_id`.
- A API rejeita user-agents que não pareçam browser. **Não mexa nos headers
  do `lib-api.mjs`** sem motivo.
- Rate limit: se tomar 429 muitas vezes, baixe `SCRAPER_CONCURRENCY` e suba
  `SCRAPER_DELAY_MS`.
