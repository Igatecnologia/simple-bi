# Simple BI

Business Intelligence multi-empresa que consome APIs externas de ERP e exibe dashboards e relatórios analíticos para Vendas, Compras e Produção.

---

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend | HTML + CSS + JavaScript vanilla (SPA single-file) |
| Gráficos | Chart.js 4 (CDN) |
| Backend | Node.js + Express 4 |
| Banco local | SQLite via better-sqlite3 (WAL mode) |
| Container | Docker / docker-compose |

---

## Arquitetura

```
index.html          ← SPA completa (HTML + CSS + JS em único arquivo)
server.js           ← API REST local (Express) + serve o index.html
database.js         ← Inicialização SQLite, migrations inline, seed inicial
bi.db               ← Banco gerado em runtime (não versionado)
```

O servidor local **não acessa o ERP diretamente**. Ele apenas:
- Serve o `index.html`
- Gerencia o cadastro de empresas e relatórios (SQLite)
- Autentica o painel Admin

O **browser** faz as chamadas diretas à API do ERP com o token JWT recebido no login.

---

## Banco de dados local

### `empresas`
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | INTEGER PK | |
| nome | TEXT | Nome exibido na tela de login |
| api_base | TEXT | URL raiz da API do ERP (ex: `http://erp.empresa.com/prefixo`) |
| login_endpoint | TEXT | Endpoint de autenticação (ex: `/usuario/login`) |
| ativo | INTEGER | Soft-delete (0 = inativo) |

### `relatorios`
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| empresa_id | INTEGER FK | |
| nome | TEXT | Label exibido no select |
| endpoint | TEXT | Path da API (ex: `/vendas/analitico`) |
| tipo | TEXT | `vendas` \| `vendadet` \| `compras` \| `producao` |
| campo_exibicao | TEXT | Campo de agrupamento do relatório |

### `admin_config`
Linha única (id=1). Armazena `usuario` e `senha_hash` (SHA-256) do administrador.  
Credencial padrão: **admin / admin**

---

## API local (Express)

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/empresas` | Lista empresas ativas com seus relatórios |
| POST | `/api/empresas` | Cria empresa + relatórios |
| PUT | `/api/empresas/:id` | Atualiza empresa (re-sincroniza relatórios) |
| DELETE | `/api/empresas/:id` | Soft-delete |
| POST | `/api/admin/auth` | Valida credenciais do admin |
| PUT | `/api/admin/senha` | Altera usuário/senha do admin |

---

## Módulos da SPA

### Dashboard — Vendas
- KPIs: Clientes únicos, Total Venda, Total Custo, Margem Bruta, Margem %
- Gráficos: Top 10 Clientes, Participação por Vendedor, Top 10 Produtos

### Detalhes — Vendas (Relatório Analítico)
- Tabela linha a linha com: Cód./Desc. Produto, Vendedor, Cliente, **Nº DAV**, Venda, Qtde, Und., Custo, Qtde Conv., Und. Conv., Margem Contrib., Margem %
- Qtde Conv. exibe `—` quando Und. Conv. estiver vazia
- Exportação CSV e PDF (via `window.print`)

### Dashboard — Compras
- KPIs: NFs, Fornecedores, Total Comprado, Ticket Médio NF
- Gráficos: Top 10 Fornecedores, Participação por UF, Top 10 Produtos

### Detalhes — Compras
- Tabela: Produto, Fornecedor, Cidade, UF, Qtde, Valor Unit., Total
- Exportação CSV e PDF

### Dashboard — Produção
- KPIs: Produtos, Total Produzido, Com Componentes
- Gráficos: Top 10 por Qtde Produzida, Distribuição por Unidade, Com vs Sem Componentes

### Detalhes — Produção
- Tabela de itens produzidos + tabela de totalização de componentes
- Exportação CSV e PDF

### Financeiro — Receber / Pagar
- Módulos em desenvolvimento (estrutura de navegação já criada)

---

## Campos da API externa (Vendas)

| Campo | Descrição |
|-------|-----------|
| `codprod` | Código do produto |
| `descproditemvenda` | Descrição do produto |
| `codvendedor` | Código do vendedor |
| `nomevendedor` | Nome do vendedor |
| `codcliente` | Código do cliente |
| `nomecliente` | Nome do cliente |
| `ndav` | Número do DAV (substitui CEP) |
| `qtdevendida` | Quantidade vendida |
| `valorunit` | Valor unitário de venda |
| `precocustoitem` | Custo unitário |
| `und` | Unidade de medida |
| `qtdeconvertidavd` | Quantidade convertida |
| `unconvertida` | Unidade convertida (vazio = sem conversão) |

---

## Como rodar

### Desenvolvimento
```bash
npm install
npm run dev       # nodemon com reload automático
# acesse http://localhost:3001
```

### Produção
```bash
npm start
```

### Docker
```bash
docker-compose up -d
# acesse http://localhost:3001
# dados persistidos no volume bi-data
```

### Variáveis de ambiente
| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `PORT` | `3001` | Porta HTTP |
| `DB_PATH` | `./bi.db` | Caminho do banco SQLite |

---

## Administração

Acesso pelo botão **⚙ Administração** na tela de login ou no header do app.  
Credencial padrão: `admin` / `admin` — **altere no primeiro acesso**.

No painel Admin é possível:
- Cadastrar/editar/excluir empresas
- Configurar a URL base da API e o endpoint de login de cada empresa
- Associar múltiplos relatórios por empresa, cada um com tipo (`vendas`, `compras`, `producao`) e endpoint próprio
