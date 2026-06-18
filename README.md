# 🎙️ Batalha de Vinis

Um jogo **multiplayer em tempo real** onde cada pessoa abre uma **loja de disco**
e disputa a freguesia. Você monta uma caixa secreta de vinis e, a cada batalha de
vendas, escolhe um disco para colocar no balcão — **mas ninguém vê o disco do
rival até a hora da revelação.** Quem fatura mais sobe na parada de sucessos.

Feito com **Node.js + Express + Socket.IO**. Sem banco de dados: as salas vivem
na memória do servidor.

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

- Cada lojista começa com **5 discos** na caixa, **escondidos dos rivais** (eles
  só veem *quantos* discos você tem, nunca *quais*).
- São **4 batalhas de venda**. Em cada uma, a freguesia revela um **pedido**:
  - **Gênero** — disco do gênero pedido vende por **3×**; os outros, 1×.
  - **Raridade** — vale `valor × multiplicador` (comum 1×, raro 2×, lendário 4×).
  - **Mais caro** — vence o maior valor de tabela.
- Cada lojista escolhe **em segredo** um disco para vender. Quando todos
  escolhem, os discos **viram ao mesmo tempo** no balcão.
- Quem atende melhor o pedido **leva a venda cheia**; os demais vendem por
  menos (metade do valor de tabela). Empate no topo: todos levam o valor cheio.
- Depois de 4 batalhas sobra **1 disco** na caixa de cada um. No fim ele é
  **revelado** e rende um **bônus de colecionador**.
- **Maior faturamento vence** a Parada de Sucessos. 👑

Todos os álbuns e artistas do catálogo são **fictícios**, criados só para o jogo.

---

## 🗂️ Estrutura

```
batalha-de-vinis/
├── server.js              # Express + Socket.IO (salas, timers, estado)
├── package.json
├── src/
│   ├── gameData.js        # catálogo de discos e cartas de demanda
│   └── rooms.js           # regras puras do jogo (máquina de estados)
└── public/
    ├── index.html         # vitrine (criar / entrar numa loja)
    ├── sala.html          # a sala de batalha
    ├── favicon.svg
    ├── css/styles.css     # identidade visual (cartaz de loja de disco)
    └── js/
        ├── landing.js     # criar sala / entrar por código
        └── sala.js        # lobby, jogo, revelação e fim
```

### Como o segredo dos discos é garantido

O servidor **nunca** manda a mão de um jogador para os outros. A função
`visao(sala, playerId)` em `src/rooms.js` monta um estado **individual** para
cada lojista: você recebe a sua caixa por inteiro, mas dos rivais só vem o
*número* de discos. Os discos só viajam revelados em dois momentos — na
**batalha de vendas** (evento `revelacaoBatalha`) e no **fim do jogo** (evento
`fimDeJogo`).

---

## 🔧 Configuração

- **Porta:** define a variável `PORT` se quiser (padrão `3000`).
  ```bash
  PORT=8080 npm start
  ```
