# Meu Caixa do Mês

Controle de gastos pessoal: limite do mês, cartões (limite total, limite de uso, fatura atual e limite já usado), entradas, dinheiro guardado, gráfico de gasto × guardado e avisos de limite. Uma IA (Claude) escreve avisos e relatórios que chegam no WhatsApp.

- `public/`: o app (HTML, CSS e JavaScript puros).
- `api/`: funções do Vercel: contas com e-mail e senha, banco de dados na nuvem, IA e envio no WhatsApp.

> **Contas e dados na nuvem:** depois de ligar o banco (passo 2.1), o app abre pedindo para criar uma conta ou entrar. Tudo o que a pessoa lança fica guardado no banco e volta em qualquer aparelho, é só entrar com o mesmo e-mail e senha.
> Sem o banco, o app funciona do mesmo jeito, mas os dados ficam só no navegador de cada aparelho.
> O WhatsApp só envia depois dos passos 2.2 a 2.4. Cada atualização no GitHub gera um novo deploy sozinho.

---

## 1. Publicar no Vercel

1. Suba esta pasta para um repositório no GitHub.
2. No Vercel: **Add New… → Project → Import** o repositório. Framework Preset: **Other**. Clique em **Deploy**.

Pronto: o app já está no ar em `https://seu-projeto.vercel.app`.

## 2. Ligar o WhatsApp (pode ser depois)

Todas as variáveis ficam em **Settings → Environment Variables** do projeto. Depois de mudar variáveis, faça **Redeploy** (aba Deployments → ⋯ → Redeploy). A lista completa está em `.env.example`.

### 2.1 Banco de dados (contas e dados na nuvem)
Aba **Storage → Create Database → Upstash (Redis)** → escolha a região **São Paulo (gru1)** se aparecer → **Connect** ao projeto. O Vercel cria sozinho `KV_REST_API_URL` e `KV_REST_API_TOKEN`. Depois faça **Redeploy**. O plano gratuito é suficiente para uso pessoal.

O que fica guardado no banco:
- `user:<id>`: e-mail, senha **criptografada** (scrypt), nome, WhatsApp e o resumo usado nos relatórios.
- `data:<id>`: todos os dados do app (cartões, gastos, entradas, guardado e ajustes).
- `sess:<…>`: as sessões de cada aparelho conectado (valem 180 dias).

Proteções: no máximo 8 tentativas de login por e-mail a cada 15 minutos e 10 contas novas por hora por rede.

### 2.2 Segurança (recomendado)
- `ALLOWED_PHONES`: seu número com DDI e DDD, por exemplo `5592999998888`. Só ele poderá receber mensagens, assim ninguém usa o seu servidor para mandar mensagens para outras pessoas.
- `CRON_SECRET`: uma senha longa qualquer. O Vercel usa para disparar os relatórios automáticos.

### 2.3 IA que escreve as mensagens (opcional)
Crie uma chave em https://console.anthropic.com e coloque em `ANTHROPIC_API_KEY`. Sem a chave, as mensagens saem com um texto padrão (com os mesmos números).

### 2.4 Provedor de WhatsApp (escolha um)
Defina `WHATSAPP_PROVIDER` como `meta`, `evolution` ou `zapi`.

**Meta — WhatsApp Cloud API (oficial)**
1. Em https://developers.facebook.com crie um app do tipo *Business* e adicione o produto **WhatsApp**.
2. Pegue o **Phone number ID** → `META_PHONE_NUMBER_ID` e gere um **token permanente** (usuário do sistema no Business Manager) → `META_ACCESS_TOKEN`.
3. Crie um template de mensagem (categoria **Utilidade**, idioma **Português (BR)**), nome `meu_caixa_mensagem`, com este corpo:
   ```
   Olá, {{1}}!

   {{2}}

   — Meu Caixa do Mês
   ```
   O `{{1}}` recebe o nome e o `{{2}}` recebe o texto da IA (em uma linha só, separado por "•", porque templates não aceitam quebra de linha nas variáveis).
4. `META_TEMPLATE_NAME=meu_caixa_mensagem`.
- A Meta cobra por mensagem de template iniciada pela empresa e precisa aprovar o template.

**Evolution API (servidor próprio, usa um WhatsApp comum)**: `EVOLUTION_URL`, `EVOLUTION_INSTANCE`, `EVOLUTION_API_KEY`. Envia texto livre com quebras de linha.

**Z-API (serviço pago brasileiro)**: `ZAPI_INSTANCE`, `ZAPI_TOKEN` e, se a conta usar, `ZAPI_CLIENT_TOKEN`.

> Evolution API e Z-API conectam um número de WhatsApp comum via QR code. Não são oficiais da Meta e o número pode ser bloqueado se mandar muitas mensagens. Para uso pessoal (mensagens só para você) o risco é baixo; use um número separado se possível.

## 3. Como funciona

| Quando | O que chega no WhatsApp |
|---|---|
| Você termina a tela de boas-vindas com o número | Mensagem de boas-vindas |
| Um gasto faz você chegar na % de aviso, atingir ou passar do limite (do mês ou de um cartão) | Aviso com a porcentagem e quanto resta ou passou |
| Todo dia às 8h (Manaus) / 9h (Brasília) | Relatório, se você escolheu "Todo dia" |
| Segunda-feira às 8h (Manaus) / 9h (Brasília) | Relatório, se você escolheu "Toda segunda" |
| Botão **Enviar relatório agora** em Ajustes | Relatório na hora |

O relatório traz: limite de uso do mês, quanto gastou e a %, quanto resta, dinheiro livre e por dia até o pagamento, quanto sobrou em cada cartão, quanto guardou e a meta.

Os relatórios automáticos usam os números da última vez que o app foi aberto (o app envia um resumo a cada alteração). Para mudar o horário, altere `schedule` em `vercel.json` (horário UTC).

**Limites contra abuso:** no máximo 12 mensagens por número por dia e 60 no total (`MAX_MSGS_PER_PHONE_DAY`, `MAX_MSGS_TOTAL_DAY`).

## 4. Privacidade
- Com conta, todos os dados do app ficam no seu banco Upstash (só o dono do projeto no Vercel tem acesso).
- Para a IA (Anthropic) e o provedor de WhatsApp vai só o **resumo** dos totais (limite, gasto, %, cartões, guardado), nunca a lista de gastos.
- Ainda não existe "esqueci minha senha". Se esquecer, dá para apagar a conta pelo painel do Upstash (chaves `email:<e-mail>` e `user:<id>`) e criar de novo.

## 5. Instalar no celular como app
- **Android (Chrome):** menu ⋮ → **Instalar app**.
- **iPhone (Safari):** Compartilhar → **Adicionar à Tela de Início**.

## 6. Seus dados
- **Com conta:** salvos na nuvem a cada alteração e também no aparelho (abre mesmo sem internet). Em outro aparelho, é só entrar.
- **Sem conta:** ficam só no navegador daquele aparelho.
- **Ajustes → Exportar / Importar** gera um arquivo de backup a qualquer momento.

## 7. Rodar no computador
```bash
npm i -g vercel
vercel dev
```
