# Flix

Duas coisas em um app só:

1. **Biblioteca pessoal** — organizador de vídeos do YouTube: categorias, coleções compartilháveis, histórico, favoritos, estatísticas.
2. **Catálogo por assinatura** — vídeos autorais enviados pelo próprio criador, hospedados no servidor da aplicação, com acesso liberado conforme o plano do assinante (free / premium / pro). Vídeos gratuitos podem ser assistidos sem conta.

## Stack

- [Next.js 16](https://nextjs.org) (App Router, Turbopack) + React 19 + TypeScript
- [Prisma](https://www.prisma.io) + MySQL
- [NextAuth v4](https://next-auth.js.org) (sessão JWT, credenciais e-mail/senha)
- [Resend](https://resend.com) para e-mail transacional (recuperação de senha)
- [Vitest](https://vitest.dev) para testes
- Tailwind CSS instalado, mas a UI é majoritariamente estilo inline (`style={{...}}`)

## Setup

**1. Dependências:**

```bash
npm install
```

**2. Variáveis de ambiente** — copie `.env.example` para `.env` e preencha:

| Variável | Obrigatória | Descrição |
|---|---|---|
| `DATABASE_URL` | sim | conexão MySQL |
| `NEXTAUTH_SECRET` | sim | chave aleatória pra assinar a sessão |
| `NEXTAUTH_URL` | sim | URL base da aplicação (ex: `http://localhost:3000`) |
| `RESEND_API_KEY` | não | sem ela, o link de recuperação de senha só é logado no console do servidor em dev (nenhum e-mail é enviado de verdade) |
| `EMAIL_FROM` | não | remetente do e-mail de recuperação de senha |

**3. Banco de dados** — o schema é aplicado direto, sem migrations versionadas:

```bash
npx prisma db push
```

> As tabelas precisam estar em **InnoDB** (não MyISAM) pra que as foreign keys do schema realmente existam no banco — `db push` só cria a constraint se o engine suportar. Se o `CREATE TABLE` do seu MySQL usa MyISAM por padrão, converta antes: `ALTER TABLE nome_da_tabela ENGINE=InnoDB;`.

**4. Rodar:**

```bash
npm run dev
```

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | servidor de desenvolvimento (Turbopack) |
| `npm run build` / `npm start` | build e start de produção |
| `npm run lint` | ESLint |
| `npm test` | roda a suíte de testes uma vez |
| `npm run test:watch` | testes em modo watch |
| `node scripts/list-users.mjs` | lista usuários e seus papéis/planos |
| `node scripts/set-admin.mjs` | promove o primeiro usuário cadastrado a admin |

## Arquitetura, em poucas palavras

- **Autenticação**: NextAuth com provider de credenciais, sessão JWT (24h). `lib/session.ts` centraliza `requireUserId`/`requireAdmin` — toda rota de API que precisa de autenticação passa por ali, e a checagem revalida `status`/`role` contra o banco a cada chamada (não confia cegamente no JWT).
- **Proteção de rota**: `proxy.ts` (era `middleware.ts` — Next.js 16 renomeou a convenção) bloqueia `/admin/*` no servidor antes de renderizar a página.
- **Vídeo**: um único modelo `Video` serve os dois modos, diferenciados pelo campo `source` (`"youtube"` | `"upload"`). Vídeo autoral fica em `storage/videos/` (fora de `public/`, nunca servido diretamente — só pela rota autenticada `/api/videos/[id]/stream`, que valida sessão + plano a cada request e suporta `Range` pra dar seek no player).
- **Controle de acesso ao catálogo**: `lib/session.ts` → `canAccessCatalogVideo` decide se um vídeo está liberado comparando o plano do assinante com `Video.requiredPlan`. Visitante sem conta é tratado como plano `"free"`.
- **Assinatura**: cobrança é **manual** — admin registra pagamentos em `/admin/assinaturas`. `computeSubscriptionStatus`/`syncSubscriptionStatus` (`lib/session.ts`) calculam vencimento e rebaixam o plano pra `"free"` automaticamente quando a assinatura expira (sem cron: calculado no momento do acesso).
- **Favoritos e progresso de reprodução**: `Video.favorite`/`Video.watched` são específicos da biblioteca pessoal (uma linha por usuário). O catálogo usa tabelas próprias (`Favorite`, `WatchProgress`) — não reaproveitar os campos do `Video` pra isso, ou o dado de um assinante vaza pra todos os outros que veem o mesmo vídeo.

## Segurança

- Rate limiting em memória (`lib/rate-limit.ts`) em login, cadastro e recuperação de senha — assume uma única instância; com múltiplas instâncias em produção, precisaria de um store compartilhado (Redis/Upstash).
- Cabeçalhos de segurança e CSP em `next.config.ts`.
- Erros do Prisma (duplicado, não encontrado, foreign key) têm tratamento padronizado via `lib/api-error.ts`.

## Testes

```bash
npm test
```

Cobrem principalmente a lógica pura em `lib/` (hierarquia de plano, expiração de assinatura, validação de upload, rate limiting, tratamento de erro, tokens de reset de senha) — não há testes automatizados de componentes React nem testes de integração das rotas de API contra um banco real.
