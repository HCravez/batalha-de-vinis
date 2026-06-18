# 🎙️ Batalha de Vinis

Um jogo **multiplayer em tempo real** onde cada pessoa abre uma **loja de disco**
e garimpa **álbuns de verdade** — capas, ano e nota dos usuários reais, vindos do
**MusicBrainz** e do **Cover Art Archive**. Você compra barato, vende na batalha
e guarda os melhores discos. No fim, **vence a loja com o melhor acervo de
crítica**.

Feito com **Node.js + Express + Socket.IO**. Sem banco de dados: as salas vivem
na memória do servidor, e os engradados de discos ficam em cache.

> **Sobre a avaliação:** os álbuns e as capas são reais. Os "20 mais conhecidos"
> de cada gênero+ano e a **avaliação (★)** de cada disco vêm de **dados reais de
> audiência do ListenBrainz** (quantos ouvintes distintos e quantas execuções).
> Nota da crítica "de verdade" (Metacritic/RYM) **não existe em API gratuita** e
> a avaliação da comunidade do MusicBrainz é rara/lenta demais — por isso a
> popularidade real é a melhor base possível sem chave de API. A avaliação fica
> **oculta na compra** (só o preço, = ★ × 10 ± 25%, dá pista) e é revelada na
> venda.
>
> Para achar os **mais conhecidos** de verdade, o servidor pagina **todos** os
> discos do gênero+ano no MusicBrainz e os ordena pela audiência real (os
> famosos ficam espalhados, não nas primeiras páginas). Isso leva **~5–40s na
> 1ª vez de cada combinação** e depois fica **em cache no disco** (`.cache/`),
> instantâneo para sempre — esse cache de JSON é o "banco de dados" do jogo.
>
> Três formas de matar a espera: (1) o servidor tem um **aquecedor em segundo
> plano** que vai preenchendo o cache nos tempos ociosos, com prioridade menor
> que o jogo (desligue com `BDV_NO_WARM=1`); (2) rode **`npm run prewarm`** uma
> vez para preencher tudo de antemão (resumível); (3) como o cache é só
> arquivos, dá para **versioná-lo/compartilhá-lo** e o jogo já abre instantâneo.

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

## 🎮 Como jogar

### Sozinho 🎧
Na vitrine, clique em **“Jogar sozinho”**. O jogo começa na hora (sem lobby). O
objetivo é montar o melhor **acervo de 5 discos**: ao fim das 5 rodadas, a
**média das avaliações dos seus 5 melhores guardados** vira um **high score**
(o recorde fica salvo no navegador). Aqui não há batalha — o que você não guarda
é **vendido pelo valor real** do disco, com lucro ou prejuízo.

### Com os amigos 👥
1. Na vitrine, clique em **“Abrir loja multiplayer”**. Você cai numa URL com o
   código da sala, tipo `http://localhost:3000/K7QP`.
2. **Compartilhe esse link** (botão *Copiar link* no topo da sala) — a entrada é
   **só pela URL**, não há mais campo de código. Cada pessoa abre em outro
   navegador, aba anônima ou celular.
   - Na mesma máquina: use abas/janelas diferentes (cada aba é um lojista).
   - Em outros aparelhos da mesma rede: troque `localhost` pelo IP da sua
     máquina, ex.: `http://192.168.0.10:3000/K7QP`.
3. Cada um digita o **nome da loja** e aperta **“Estou pronto”**.
4. Quando todos estiverem prontos (2 a 6 lojistas), o **anfitrião** (★) clica em
   **“Abrir as portas”** e o jogo começa.

---

## 📜 Regras

- 2 a 6 lojistas, **3 rodadas**, **$300** no caixa (o dinheiro é acumulado entre
  as rodadas). Cada rodada tem duas fases: **compra** e **venda**.

**Compra** 🛒
- Sorteia-se um **ano** e um **gênero** (cada gênero só nas décadas em que faz
  sentido); aparecem os **20 mais conhecidos** daquele recorte. O mesmo par
  **gênero+ano nunca sai duas vezes** na mesma partida.
- Cada disco tem uma **avaliação (★) OCULTA**. O **preço** é avaliação × 10 com
  **±25%** — então o preço é só uma pista ruidosa: aparecem gemas baratas.
- Escolha uma capa e clique **COMPRAR** — ele leva o disco e já abre o próximo
  engradado. Você pode **trocar o ano** e **trocar o gênero** 1 vez cada por rodada.
- Encerre as compras quando quiser (alvo: **4+ discos**, teto **10**).

**Venda** 🏷️
- Separe o que vai **guardar** na loja e o que vai **vender**. A avaliação (★)
  é revelada agora.
- **Multiplayer — batalha** ⚔️: você ordena os discos do **pior → melhor**
  (palpite) e a venda é **rei-do-morro** pela avaliação; cada **vitória** aumenta
  a revenda, quem não vence dá **prejuízo**.
- **Sozinho — mercado** 🎧: o disco vale **avaliação² × (10/6)** — um clássico
  rende muito, um disco fraco encalha barato. Achou um clássico subvalorizado?
  **lucro alto**. Pagou caro num disco mediano? **prejuízo de verdade**.

**Acervo e fim** 🏆
- Você pode **guardar até 5 discos** na loja, acumulando entre as rodadas, e
  pode **remover** um guardado (botão ✕) para abrir vaga.
- **Multiplayer:** vence a loja com o **melhor acervo** (maior soma das avaliações
  guardadas; desempate pelo dinheiro).
- **Sozinho:** a **média dos 5 melhores** guardados é o seu **high score**.

Os **álbuns e capas são reais** (MusicBrainz / Cover Art Archive). A **avaliação**
vem de **dados reais de audiência do ListenBrainz** — quanto mais conhecido e
ouvido o disco, maior a nota (veja a explicação no topo do README).

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
