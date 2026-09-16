# Flix

Duas coisas em um app só — gestão de vídeos, não um clone de catálogo Hollywood:

1. **Biblioteca pessoal** — organizador de vídeos do YouTube: categorias, coleções com link público, histórico, favoritos, estatísticas.
2. **Catálogo por assinatura** — aulas do criador (admin), hospedadas no servidor, com acesso conforme o plano do assinante (free / premium / pro). Visitante assiste o gratuito sem conta; Premium/Pro via PIX, com a gestão no admin. Assinante não publica no catálogo.

## Stack

- [Next.js 16](https://nextjs.org) (App Router, Turbopack) + React 19 + TypeScript
- [Prisma](https://www.prisma.io) 5.x + MySQL — fica em 5 de propósito (Next 16 / React 19). Prisma 7 exige driver adapter e muda o client; revisar o changelog na próxima atualização de dependências, não no meio de uma feature.
- [NextAuth v4](https://next-auth.js.org) (sessão JWT, credenciais e-mail/senha)
- [Resend](https://resend.com) para e-mail transacional (recuperação de senha e confirmação de e-mail)
- [Vitest](https://vitest.dev) para testes
- CSS de componentes em `app/css/app.css` (botões, inputs, header, cards, auth)

## Setup

**1. Dependências:**

```bash
npm install
```

**2. Variáveis de ambiente** — copie `.env.example` para `.env` e preencha:

- `DATABASE_URL` — conexão MySQL (obrigatória)
- `NEXTAUTH_SECRET` — chave aleatória pra assinar a sessão (obrigatória)
- `NEXTAUTH_URL` — URL base, ex. `http://localhost:3003` (obrigatória; precisa bater com a porta do `npm run dev`)
- `TRUST_PROXY` — **obrigatória de definir**. `true` em produção atrás de Apache/WAMP/nginx/CDN (senão o rate limit de login/cadastro vira um balde global). `false` só se o Node receber o pedido direto, sem proxy. O boot avisa no console se estiver ausente.
- `RESEND_API_KEY` — sem ela, o link de recuperação de senha, o de confirmação de e-mail e os lembretes de cobrança só são logados no console do servidor em dev
- `EMAIL_FROM` — remetente dos e-mails transacionais
- `CRON_SECRET` — obrigatório para `POST /api/cron/billing` (lembretes) e `POST /api/cron/process-videos` (miniatura/480p). Gere um valor longo e aleatório. Sem ele os endpoints recusam qualquer chamada.
- `FFMPEG_PATH` / `FFPROBE_PATH` — opcionais se `ffmpeg` e `ffprobe` já estiverem no PATH. No Windows, o build “essentials” de https://www.gyan.dev/ffmpeg/builds/ basta. Depois: `npm run ffmpeg:verify`.
- `NEXT_PUBLIC_PIX_KEY` — chave PIX exibida na vitrine e em `/plano`
- `NEXT_PUBLIC_SUPPORT_EMAIL` — e-mail de suporte na UI

**3. Banco de dados:**

```bash
npx prisma migrate deploy
npx prisma generate
```

Na primeira vez num banco já existente (criado com `db push`), faça o baseline:

```bash
npx prisma migrate resolve --applied 20260820140000_init
```

Tabelas precisam estar em **InnoDB** (não MyISAM) pra que as foreign keys existam de verdade.

**4. Rodar:**

```bash
npm run dev
```

Primeiro usuário: cadastre em `/login`. Promova a admin com `node scripts/set-admin.mjs`.

## Scripts

- `npm run dev` — servidor de desenvolvimento
- `npm run build` / `npm start` — produção
- `npm run lint` — ESLint
- `npm test` — testes (Vitest)
- `node scripts/list-users.mjs` — lista usuários
- `node scripts/set-admin.mjs` — promove o primeiro usuário a admin
- `node scripts/seed-test-users.mjs` — cria três contas locais (`test-admin@flix.local`, `test-free@flix.local`, `test-premium@flix.local`) com senha `test1234`. Só use em desenvolvimento; não rode em produção compartilhada.
- `npm run cron:billing` — dispara agora o job de vencidos/lembretes (`POST /api/cron/billing`)
- `npm run cron:videos` — dispara agora o reenfileiramento de uploads travados (`POST /api/cron/process-videos`)
- `npm run cron:install` — registra as tarefas no Agendador do Windows (cobrança diária às 08:00 e vídeos a cada 30 min)
- `npm run ffmpeg:verify` — confere se ffmpeg/ffprobe e o encoder libx264 estão disponíveis

## Arquitetura

- **Auth**: NextAuth Credentials, JWT 24h. O callback JWT atualiza `role`/`plan`/`status`/`emailVerified` no banco. `lib/session.ts` revalida `status`/`role` a cada API.
- **Admin**: `proxy.ts` bloqueia `/admin/*` consultando `role` e `status` no banco (não só o JWT); `app/admin/layout.tsx` revalida de novo. As APIs usam `requireAdmin()`. O mesmo `proxy.ts` aplica a checagem CSRF de Origin/Referer em `/api/*`.
- **Clientes e pagamentos**: gestão em `/admin/clientes` e `/admin/pagamentos`. CSV nos filtros atuais. Comprovante (JPEG/PNG/WebP/PDF) em `storage/receipts/`, só via `/api/admin/receipts/[id]`. Auditoria em `/admin/auditoria`.
- **Assinatura**: cobrança manual (PIX). A chave aparece na vitrine do catálogo e em `/plano`. Admin registra em `/admin/assinaturas`. O botão em `/admin/assinaturas` sincroniza vencidos e dispara lembretes (7 dias antes e no atraso). O mesmo job roda sozinho todo dia via Agendador de Tarefas (`POST /api/cron/billing` com `Authorization: Bearer $CRON_SECRET`).
- **Vídeo**: `source` `youtube` | `upload`. Upload é gravado em streaming para um arquivo temporário e só depois vai pra `storage/videos/` (não carrega o arquivo inteiro na RAM). O registro nasce com `status=processing`. Um job em background (FFmpeg) extrai um frame JPEG em `storage/thumbs/`, gera uma variante ~480p H.264 e, se o original não tocar no browser (ex.: `.mov`/HEVC), transcodifica um MP4 de playback. O player lê por `/api/videos/[id]/stream` com Range e `?quality=480|source`. Miniatura autenticada em `/api/videos/[id]/thumbnail`. Cron de recuperação: `POST /api/cron/process-videos` com o mesmo `CRON_SECRET`. Sem FFmpeg no PATH (ou `FFMPEG_PATH`), o vídeo fica em `processing` até o binário aparecer. Miniaturas do YouTube vêm da CDN do YouTube (cache longo via `next/image`); o placeholder local é imutável. O stream autoral é paywalled — `private, no-cache` com ETag (304) no mesmo processo Node. CDN pública no vídeo vazaría conteúdo pago; quando o volume de streams simultâneos crescer, o próximo passo é objeto em storage + URL assinada (Cloudflare R2 / Stream).
- **Perfis**: uma conta = um espectador. Não há perfis infantis/familiares — o modelo é clube de criador único.
- **CI**: GitHub Actions roda `lint`, `test` e `build` em todo push/PR.
- **Catálogo**: `canAccessCatalogVideo`. Visitante = plano `free`. Favoritos e progresso usam as tabelas `Favorite` e `WatchProgress`.
- **Coleções públicas**: o dono gera um link em `/c/[token]`. Quem tem o link vê só vídeos do YouTube (sem notas, e-mail ou upload).
- **Conta**: `/conta` (nome e senha). Recuperação em `/esqueci-senha` e `/redefinir-senha`. Confirmação de e-mail em `/verificar-email`.

## Cron de cobrança (WAMP / Windows)

Os lembretes (“sua assinatura vence em 7 dias” / “está em atraso”) e a sincronização de status (`active` → `overdue` → `expired`) **não disparam sozinhos** só porque o código existe. É preciso:

1. `CRON_SECRET` preenchido no `.env` (veja `.env.example`)
2. O app no ar (`npm start`) no horário do job
3. Uma tarefa diária chamando a rota

**Instalar o agendamento** (uma vez, no servidor WAMP):

```powershell
npm run cron:install
```

Isso cria `FlixBillingCron` (todo dia às **08:00**, horário local) e `FlixVideosCron` (a cada **30 minutos**). Se o PC estiver desligado no horário da cobrança, o Windows roda na próxima vez que ligar (`StartWhenAvailable`). Se o app ainda não estiver no ar, a tarefa tenta de novo até 3 vezes, a cada 15 minutos.

**Disparar agora** (útil para testar):

```powershell
npm run cron:billing
npm run cron:videos
```

Uploads travados em `processing` (FFmpeg ausente, restart no meio do job) são reenfileirados com `npm run cron:videos` (`POST /api/cron/process-videos`). O processamento imediato já dispara depois do upload; o cron é só rede de segurança.

Logs em `logs/billing-cron.log` e `logs/process-videos-cron.log`. Remover: `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/install-billing-cron.ps1 -Uninstall` e o equivalente em `scripts/install-videos-cron.ps1 -Uninstall`.

Em outro host, o equivalente é um cron diário fazendo `POST /api/cron/billing` com o header `Authorization: Bearer <CRON_SECRET>`. Sem o segredo, a rota responde 401.

## Segurança

- Rate limit compartilhado no MySQL/InnoDB, com incremento transacional (`lib/rate-limit.ts`) e fallback em memória quando o banco estiver indisponível em login, cadastro, recuperação de senha, reenvio de confirmação e GET de coleção pública. Só honra `x-forwarded-for` / `x-real-ip` se `TRUST_PROXY=true`. Em implantação atrás do Apache/WAMP (o cenário deste README), `TRUST_PROXY=true` é obrigatório — sem isso todas as requisições caem no IP `"unknown"` e um único atacante bloqueia o login de todo mundo. Sem proxy na frente, deixe `false` para não aceitar cabeçalho forjado. O boot avisa no console se a variável estiver ausente.
- Upload de vídeo autoral valida magic-bytes (MP4/WebM/MOV) e interrompe o stream se passar de 3 GB.
- Se o Next.js estiver atrás do Apache/WAMP ou outro proxy, suba o limite de body (`LimitRequestBody` no Apache, `client_max_body_size` no nginx) — senão o upload grande morre no proxy, antes da aplicação. No mesmo cenário, defina `TRUST_PROXY=true`.
- Import de playlist só aceita hosts do YouTube (`lib/youtube-url.ts`).
- Cabeçalhos de segurança e CSP em `next.config.ts`.
- CSRF: o NextAuth cobre os próprios endpoints (`/api/auth/signin`, `callback`, `signout`, etc.) com token CSRF nativo. As rotas de negócio (`/api/videos`, `/api/catalog`, `/api/admin/*`, …) são JSON same-origin, sem CORS, com cookie de sessão SameSite=Lax — um POST cross-site típico nem envia o cookie. Em cima disso, `proxy.ts` recusa POST/PUT/PATCH/DELETE em `/api/*` cujo `Origin` (ou a origem do `Referer`) não seja a de `NEXTAUTH_URL` (`lib/csrf.ts`). Ficam de fora: métodos seguros (GET/HEAD/OPTIONS), as rotas nativas do NextAuth e `POST /api/cron/*` (Bearer `CRON_SECRET`).
- Exclusão de usuário limpa shares/coleções numa transação (`lib/delete-user.ts`).

## Validação de UX e operação

- Login aceita modo de cadastro e retorno seguro para uma rota interna.
- Biblioteca e catálogo preservam busca, filtros e paginação na URL.
- Pedidos pagos permitem anexar comprovante JPEG/PNG/WebP/PDF de até 8 MB. O arquivo fica privado em storage/receipts e só pode ser baixado pelo titular ou administrador. Enviar o arquivo não ativa o plano. O administrador consulta o comprovante em Solicitações.
- O painel administrativo mostra disponibilidade do FFmpeg, espaço livre e vídeos com falha/atraso. As rotinas registram seu último resultado local em storage/job-status; sem registro significa que ainda não foram executadas após esta atualização. O status de vídeos indica reenfileiramento, não conclusão da conversão.
- Execute as migrações com npx prisma migrate deploy. As migrações de comprovantes e InnoDB são necessárias.

Testes de navegador: npm run test:e2e. Usam Edge no Windows e Chromium em outros sistemas (npx playwright install chromium). Precisam do MySQL configurado e usam a porta 3003. Criam contas e conteúdo de teste com identificadores aleatórios e removem esses dados ao terminar. Capturas e traces ficam em test-results, ignorado pelo Git.

Teste concorrente real: no PowerShell, defina $env:RUN_DATABASE_TESTS='true' e execute npm run test:database. O teste usa somente um contador temporário e o remove ao terminar. A suíte padrão mantém esse teste desativado para não depender do MySQL.
