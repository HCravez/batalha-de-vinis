# 🎙️ Batalha de Vinis

Um jogo **multiplayer em tempo real** onde cada pessoa abre uma **loja de disco**
e garimpa **álbuns de verdade** — capas, ano e nota dos usuários reais, vindos do
**MusicBrainz** e do **Cover Art Archive**. Você compra barato, vende na batalha
e guarda os melhores discos. No fim, **vence a loja com o melhor acervo de
crítica**.

Feito com **Node.js + Express + Socket.IO**. Sem banco de dados: as salas vivem
na memória do servidor, e os engradados de discos ficam em cache.

> **Sobre as notas:** os álbuns e as capas são reais. Já as notas (crítica e
> usuários) **não existem em nenhuma API gratuita** — então são derivadas de
> forma determinística do identificador (MBID) de cada álbum: ficam estáveis e
> jogáveis, mas não são notas reais de Metacritic/RYM. O preço segue a nota dos
> usuários (♪) com ±25% de variação; a nota da crítica (★) fica oculta até a
> batalha.

---

## ▶️ Como rodar

Você precisa do **Node.js 18+** instalado.

```bash
# 1. instalar as dependências
npm install

# 2. subir o servidor
npm start
```

Vai aparecer no terminal:

```
  🎙️  Batalha de Vinis no ar  →  http://localhost:3000
```

Abra **http://localhost:3000** no navegador.

> Durante o desenvolvimento, `npm run dev` reinicia o servidor a cada alteração
> (usa o `--watch` do Node).

---

## 🎮 Como jogar com os amigos

1. Na vitrine, clique em **“Abrir minha loja”**. Você cai numa URL com o código
   da sala, tipo `http://localhost:3000/K7QP`.
2. **Compartilhe esse link** (botão *Copiar link* no topo da sala). Cada pessoa
   abre em outro navegador, aba anônima ou celular.
   - Na mesma máquina: use abas/janelas diferentes (cada aba é um lojista).
   - Em outros aparelhos da mesma rede: troque `localhost` pelo IP da sua
     máquina, ex.: `http://192.168.0.10:3000/K7QP`.
3. Cada um digita o **nome da loja** e aperta **“Estou pronto”**.
4. Quando todos estiverem prontos (2 a 6 lojistas), o **anfitrião** (★) clica em
   **“Abrir as portas”** e o jogo começa.

---

## 📜 Regras

- 2 a 6 lojistas, **5 rodadas**, **$500** no caixa (o dinheiro é acumulado entre
  as rodadas). Cada rodada tem duas fases: **compra** e **venda**.

**Compra** 🛒
- Sorteia-se um **ano** e um **gênero**; aparece um **engradado** com 20 álbuns
  reais daquele recorte.
- O **preço** segue a nota dos usuários (♪ × 10), mas varia **±25%** — sempre
  aparecem boas barganhas.
- Você compra **1 disco por engradado**. Pode **trocar o ano** uma vez e **trocar
  o gênero** uma vez, e puxar **novos engradados** à vontade.
- Encerre as compras quando quiser (alvo: **4+ discos**, teto **10**).

**Venda** 🏷️ e **Batalha** ⚔️
- Separe o que vai à **batalha** e o que vai **guardar** na loja, e ordene os de
  batalha do **pior → melhor** (é seu palpite; a crítica está oculta).
- A batalha é **rei-do-morro** pela **nota da crítica (★)**, que só agora é
  revelada: o disco de maior crítica vence e segue na disputa.
- Cada **vitória** aumenta o valor de revenda; quem **não vence nenhuma** dá
  **prejuízo** (vende pela metade).

**Acervo e fim** 🏆
- Você pode **guardar até 5 discos** na loja, acumulando entre as rodadas.
- Depois de **5 rodadas**, vence a loja com o **melhor acervo** — a maior soma de
  notas da crítica entre os discos guardados. Empate? Desempata pelo dinheiro.

Os **álbuns e capas são reais** (MusicBrainz / Cover Art Archive). As **notas**
são geradas de forma determinística (veja a nota no topo deste README).

---

## 🗂️ Estrutura

```
batalha-de-vinis/
├── server.js              # Express + Socket.IO (salas, timers, estado)
├── package.json
├── src/
│   ├── gameData.js        # config (gêneros/anos) + modelo de notas/preço
│   ├── musicbrainz.js     # busca de álbuns reais (cache + rate limit)
│   └── rooms.js           # regras puras do jogo (máquina de estados)
└── public/
    ├── index.html         # vitrine (criar / entrar numa loja)
    ├── sala.html          # a sala de batalha
    ├── favicon.svg
    ├── css/styles.css     # identidade visual (cartaz de loja de disco)
    └── js/
        ├── landing.js     # criar sala / entrar por código
        └── sala.js        # lobby, compra, venda, batalha e fim
```

### Como o segredo é garantido

O servidor **nunca** manda os discos de um jogador para os outros, e a **nota da
crítica (★)** de qualquer disco **só viaja revelada na batalha e no fim**. A
função `visao(sala, playerId)` em `src/rooms.js` monta um estado **individual**:
você recebe seu engradado, suas compras e sua loja (sem a crítica), e dos rivais
só vêm números (dinheiro, quantos discos, acervo). Os discos revelados só saem
em dois eventos — `revelacaoVendas` (batalha) e `fimDeJogo` (fim).

---

## 🔧 Configuração

- **Porta:** define a variável `PORT` se quiser (padrão `3000`).
  ```bash
  PORT=8080 npm start
  ```
