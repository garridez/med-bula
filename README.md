# med.bula.com.br — Drop 1

Sistema de gestão de consultório. **Drop 1 = base completa do projeto** rodando em containers: Postgres + AdonisJS v6 + Nuxt 3 SSR sobem com **um único comando**.

## Stack

- **Backend:** AdonisJS v6 (TypeScript, ESM) + Lucid ORM + Postgres 16
- **Frontend:** Nuxt 3 + Tailwind (cor primária `#e53935`) + Pinia
- **Auth:** Access tokens (`@adonisjs/auth`)
- **Deploy:** Docker Compose (qualquer host) — testado pra rodar no Coolify

---

## Subir local — um comando

```bash
cp .env.example .env
docker compose up -d --build
```

E pronto:

| Serviço   | URL                        |
| --------- | -------------------------- |
| Frontend  | http://localhost:3000      |
| Backend   | http://localhost:3333      |
| Postgres  | `localhost:5432` (med/med) |

O backend roda **migrations + seed automaticamente** no entrypoint (idempotente — pode reiniciar à vontade). Logs em tempo real:

```bash
docker compose logs -f backend
```

### Credenciais de teste

| Role        | Email                   | Senha     |
|-------------|-------------------------|-----------|
| Super Admin | `super@bula.com.br`     | `senha123`|
| Admin       | `admin@clinica.com.br`  | `senha123`|
| Médico      | `medico@clinica.com.br` | `senha123`|
| Secretária  | `sec@clinica.com.br`    | `senha123`|

A tela de login tem 4 botões pré-preenchidos pra alternar entre perfis rápido.

---

## Deploy no Coolify

### 1. No painel do Coolify

- **New Resource → Docker Compose** (ou **Public Repository** se for puxar do Git)
- Aponte pro repo / cole o `docker-compose.yml`

### 2. Configure os domínios

Atribua dois FQDNs no painel:

| Serviço    | Domínio sugerido            | Porta interna |
| ---------- | --------------------------- | ------------- |
| `frontend` | `med.bula.com.br`           | 3000          |
| `backend`  | `api.med.bula.com.br`       | 3333          |

O Coolify gera os labels do Traefik e SSL via Let's Encrypt automaticamente.
**Não exponha o `postgres`** (deixa só na rede interna).

### 3. Configure as env vars no painel

```bash
# Críticas — geram nova pra prod
APP_KEY=                     # node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
DB_PASSWORD=                 # senha forte
DB_USER=med
DB_DATABASE=med_bula

# URLs públicas
FRONTEND_URL=https://med.bula.com.br
NUXT_PUBLIC_API_BASE=https://api.med.bula.com.br

# Operação
RUN_SEED=true                # primeira deploy. Setar false depois (opcional, é idempotente)
LOG_LEVEL=info

# Vidaas (Drop 4)
VIDAAS_BASE_URL=
VIDAAS_CLIENT_ID=
VIDAAS_CLIENT_SECRET=
VIDAAS_REDIRECT_URI=https://api.med.bula.com.br/api/vidaas/callback
```

### 4. Deploy → Open

O Coolify builda os dois Dockerfiles, sobe o stack e expõe pelos domínios. Migrations rodam no entrypoint do backend.

---

## Estrutura

```
med-bula/
├── docker-compose.yml          # Postgres + backend + frontend
├── .env.example                # vars do compose
├── backend/                    # AdonisJS v6
│   ├── Dockerfile              # multi-stage build
│   ├── docker-entrypoint.sh    # migrations + seed + start
│   ├── app/
│   │   ├── controllers/        # auth_controller
│   │   ├── middleware/         # auth, role
│   │   └── models/             # User, Clinic, Patient, Appointment, MedicalRecord, Document
│   ├── database/
│   │   ├── migrations/         # 7 tabelas
│   │   └── seeders/            # idempotente
│   ├── config/
│   └── start/
└── frontend/                   # Nuxt 3 SSR
    ├── Dockerfile              # multi-stage, output em .output/
    ├── components/
    │   └── OtpInput.vue        # 4-digit OTP (pronto pra v2)
    ├── pages/
    │   ├── login.vue           # split-screen vermelho com logo
    │   ├── index.vue           # dashboard
    │   └── pacientes.vue
    ├── layouts/
    ├── stores/auth.ts          # Pinia + localStorage
    └── composables/useApi.ts
```

## Roles e permissões

- **`super_admin`** — acesso global (v2 expande pra multi-clínica)
- **`admin`** — gestor da clínica
- **`doctor`** — médico, pacientes próprios + prontuário + documentos
- **`secretary`** — agenda + pacientes + cobrança (configurável pelo médico, sem prontuário)

## Comandos úteis

```bash
# Ver logs
docker compose logs -f backend
docker compose logs -f frontend

# Restart só o backend (após mudar código + rebuild)
docker compose up -d --build backend

# Rodar uma migration manual / rollback
docker compose exec backend node ace migration:status
docker compose exec backend node ace migration:rollback

# Acessar o Postgres
docker compose exec postgres psql -U med -d med_bula

# Reset total (apaga volume!)
docker compose down -v
```

---

## Roadmap

- **Drop 1** ✅ skeleton + auth + migrations + seed + login
- **Drop 2** — CRUD pacientes + agenda real (calendário semanal)
- **Drop 3** — prontuário + emissão receita/exame/atestado (PDF)
- **Drop 4** — Vidaas (assinatura) + WhatsApp + OTP do paciente

### V2 (depois do MVP)

Cobrança PIX antecipada com 10% desc + lembretes WhatsApp, mensalidade Efí, IA resumo do prontuário, gravação + transcrição da consulta, maquineta USB/Bluetooth/Serial, multi-clínica + super-admin completo, baixa farmacêutica via CNPJ + QR, posologia automática via bula.com.br, autocomplete CID/TUSS/medicamentos.
