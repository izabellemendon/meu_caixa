# Meu Caixa do Mês

Controle de gastos pessoal: limite do mês, cartões (limite total, limite de uso, fatura atual e limite já usado), entradas, dinheiro guardado, gráfico de gasto × guardado e avisos de limite. Uma IA (Claude) escreve avisos e relatórios que chegam no WhatsApp.

- `public/`: o app (HTML, CSS e JavaScript puros). Os dados ficam no navegador de cada aparelho.
- `api/`: funções do Vercel que guardam um **resumo** dos números, pedem o texto à IA e enviam no WhatsApp.

> O app funciona sem configurar nada. O WhatsApp só começa a enviar depois dos passos da seção 2. Pode publicar agora e configurar depois: cada atualização no GitHub gera um novo deploy sozinho.

---

## 1. Publicar no Vercel

1. Suba esta pasta para um repositório no GitHub.
2. No Vercel: **Add New… → Project → Import** o repositório. Framework Preset: **Other**. Clique em **Deploy**.

Pronto: o app já está no ar em `https://seu-projeto.vercel.app`.

## 2. Ligar o WhatsApp (pode ser depois)

Todas as variáveis ficam em **Settings → Environment Variables** do projeto. Depois de mudar variáveis, faça **Redeploy** (aba Deployments → ⋯ → Redeploy). A lista completa está em `.env.example`.

### 2.1 Banco de dados (obrigatório)
Aba **Storage → Create → Upstash (Redis)** → conecte ao projeto. O Vercel cria sozinho `KV_REST_API_URL` e `KV_REST_API_TOKEN`. O plano gratuito é suficiente.

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
- No servidor fica só: nome, número, frequência e um **resumo** dos totais (limite, gasto, %, cartões, guardado). A lista de gastos não sai do aparelho.
- O resumo é enviado para a IA (Anthropic) para escrever a mensagem e para o provedor de WhatsApp para entregar.

## 5. Instalar no celular como app
- **Android (Chrome):** menu ⋮ → **Instalar app**.
- **iPhone (Safari):** Compartilhar → **Adicionar à Tela de Início**.

## 6. Seus dados no aparelho
- Ficam no navegador de cada aparelho; celular e computador não se sincronizam.
- **Ajustes → Exportar / Importar** leva os dados de um aparelho para outro. Exporte um backup de vez em quando.

## 7. Rodar no computador
```bash
npm i -g vercel
vercel dev
```
