# Simple BI — Guia para Codex

## Visão geral

SPA single-file (`index.html`) + servidor Express mínimo (`server.js`). Todo o código de UI, estado e lógica de negócio está em `index.html`. Não há bundler, framework JS ou transpilação — JavaScript vanilla puro.

## Estrutura do index.html

O arquivo é dividido em seções bem delimitadas por comentários `══`:

1. **`<style>`** — todo o CSS (variáveis CSS, componentes, responsivo, print)
2. **`#viewLogin`** — tela de login
3. **`#viewApp`** — app principal: header + sidebar + `<main>`
4. **`#viewAdmin`** — painel administrativo
5. **Modais** — sobreposições (admin auth, alterar senha, empresa)
6. **`<script>`** — todo o JavaScript da aplicação

## Convenções de nomenclatura

### IDs de seções no `<main>`
Prefixo `sec`: `secDashboard`, `secRelatorios`, `secComprasDash`, `secComprasDet`, `secProducaoDash`, `secProducao`, `secReceber`, `secPagar`

### IDs de itens do sidebar
Prefixo `nav`: `navDash`, `navRel`, `navComprasDash`, `navComprasDet`, `navProdDash`, `navProdDet`, `navReceber`, `navPagar`

### Variáveis de estado globais
```js
_token            // JWT da sessão atual
_empresa          // objeto empresa selecionada (api_base, login_endpoint, relatorios[])
_relatorio        // relatório de vendas ativo
_relatorioCompras // relatório de compras ativo
_relatorioProducao// relatório de produção ativo
_gruposVendas     // dados brutos do último relatório de vendas
_gruposCompras    // dados brutos do último relatório de compras
_rowsProducao     // dados brutos do último relatório de produção
_charts           // instâncias Chart.js ativas (destruir antes de recriar)
```

## Como adicionar um novo módulo/seção

1. **Sidebar** — adicionar dentro de um `<div id="grpXxx">` (ou criar novo grupo com `nav-group-hdr`):
   ```html
   <button class="nav-item" id="navXxx" onclick="navTo('xxx')">
     <svg ...>...</svg>
     Rótulo
   </button>
   ```

2. **Seção no `<main>`** — adicionar antes do fechamento de `</main>`:
   ```html
   <div id="secXxx" style="display:none">
     <!-- conteúdo -->
   </div>
   ```

3. **Registrar em `navTo()`**:
   ```js
   const map = {
     ...
     xxx: 'secXxx',
   };
   // e adicionar a linha de toggle active:
   document.getElementById('navXxx').classList.toggle('active', section === 'xxx');
   ```

## Como adicionar novo tipo de relatório

1. No `database.js`, o campo `tipo` da tabela `relatorios` controla o filtro — aceitar novo valor de tipo.
2. No login (`fazerLogin()`), filtrar `rels.filter(r => r.tipo === 'novo_tipo')` e popular o select correspondente.
3. Criar funções `fetchNovo()` e `renderNovo()` seguindo o padrão das existentes.

## Padrão de fetch para APIs externas

```js
async function fetchXxx(dtDe, dtAte, relSelId) {
  const selVal = document.getElementById(relSelId).value;
  if (selVal) _relatorioXxx = JSON.parse(selVal);
  const url = `${_empresa.api_base}${_relatorioXxx.endpoint}?dt_de=${dtDe}&dt_ate=${dtAte}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${_token}` } });
  if (!res.ok) throw new Error(`Erro ao buscar dados (HTTP ${res.status})`);
  return res.json();
}
```
- Datas no formato `DD.MM.YYYY` (função `dateToApi` converte de `YYYY-MM-DD`)
- Autenticação sempre via header `Authorization: Bearer <token>`

## Utilitários disponíveis

```js
toNum(v)          // parseFloat seguro, retorna 0 se NaN
fmtNum(v)         // formata com 2 casas decimais pt-BR
fmtPct(v)         // formata percentual com 1 casa decimal pt-BR
dateToApi(v)      // YYYY-MM-DD → YYYY.MM.DD
truncate(s, n)    // corta string em n chars com '…'
badgeMargem(pct)  // retorna HTML de badge colorido por faixa de margem
sha256(text)      // retorna Promise<string hex>
showView(id)      // alterna entre viewLogin / viewApp / viewAdmin
showModal(id)     // exibe modal overlay
hideModal(id)     // oculta modal overlay
```

## CSS — variáveis principais

```css
--dark:   #1a1a2e   /* fundo escuro (sidebar background usa --mid) */
--mid:    #16213e   /* sidebar */
--blue:   #0f3460   /* cor primária, botões, headers de tabela */
--accent: #e94560   /* destaque, item ativo do sidebar */
--green:  #27ae60
--red:    #e74c3c
--sky:    #2980b9
--muted:  #888
--border: #dde0e7
--bg:     #f0f2f5   /* fundo geral */
```

## Componentes CSS reutilizáveis

- `.panel` — barra de filtros com inputs e botão
- `.kpi-card` — card de KPI com borda colorida lateral (`.green`, `.red`, `.sky`)
- `.card` — igual ao kpi-card, usado em summary de relatórios
- `.report-wrapper` — container de tabela com header azul
- `.badge` / `.badge-green` / `.badge-yellow` / `.badge-red` — badges inline
- `.nav-group-hdr` — cabeçalho colapsável do sidebar (usa `toggleGroup`)
- `.nav-child` — item de menu filho com indentação extra (`padding-left: 30px`)

## Gráficos (Chart.js)

- Sempre destruir instâncias anteriores antes de recriar: `_charts[k].destroy()`
- Paleta: `const PALETTE = ['#0f3460','#e94560','#27ae60','#2980b9',...]`
- Tipos usados: `bar` (horizontal com `indexAxis:'y'`), `doughnut`
- Wrapper de altura fixa: `.chart-wrap { height:260px }` / `.chart-wrap-tall { height:320px }`

## Exportação

- **CSV**: função `downloadCSV(filename, [header, ...rows])` — cria blob e dispara download
- **PDF**: `window.print()` com CSS `@media print` que oculta sidebar/panel e exibe `#printHeader`

## Servidor (server.js)

- Porta padrão: `3001` (env `PORT`)
- Serve arquivos estáticos de `__dirname` (inclui `index.html`)
- Não há sessão server-side — o token JWT é mantido apenas no navegador
- Banco SQLite com WAL mode; migrations feitas com `ALTER TABLE … ADD COLUMN` em try/catch

## O que NÃO fazer

- Não criar arquivos JS/CSS separados — o projeto é intencionalmente single-file
- Não introduzir dependências npm de frontend — sem bundler disponível
- Não adicionar lógica de negócio no server.js — ele só gerencia configuração local
- Não usar `cepcliente` na tabela de detalhes de vendas — substituído por `ndav`
