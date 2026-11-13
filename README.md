# Régua do Iguaçu

Página pública com a vazão do Rio Iguaçu na estação Hotel Cataratas (ANA 65992502).

## Como funciona

1. A cada hora, o GitHub roda o `ana_vazao.py`, que busca os dados na ANA e grava o `vazao.json`.
2. O `index.html` lê esse arquivo e desenha a régua, o gráfico e os números.

A página abre no idioma do aparelho (português, inglês, espanhol ou francês), e as bandeiras no topo trocam o idioma à mão. Os textos ficam em `idiomas.js`: ao mudar uma frase, mude nos quatro idiomas. O gráfico mostra 1, 2, 7, 15 ou 30 dias, com as linhas da média e dos limites de cada atração, e o script busca 30 dias na ANA.

A primeira versão continua no ar em `/v1/` e guardada no Git com a marca `v1`.

As regras de leitura ficam em `painel.js`. Nesse arquivo você altera os limites das atrações (`ATRACOES`), as linhas de comparação (`REFERENCIAS`) e a vazão média. Quando a Garganta del Diablo voltar a funcionar, apague o campo `foraDeServico: true`.

## Publicar no GitHub

1. Crie um repositório público e envie esta pasta. O `.gitignore` deixa o `.env` de fora.
2. Em **Settings > Secrets and variables > Actions**, crie os secrets `ANA_IDENTIFICADOR` e `ANA_SENHA`.
3. Em **Settings > Pages**, escolha **Deploy from a branch**, branch `main`, pasta `/ (root)`.
4. Em **Actions > Atualizar vazao**, clique em **Run workflow** para testar.

Se essa execução falhar com erro de conexão ou HTTP 403, a ANA pode estar recusando os servidores do GitHub. Nesse caso, rode o script no seu PC pelo Agendador de Tarefas e envie o `vazao.json` ao repositório.

## Ativar o registro de ocorrências

Enquanto o `config.js` estiver vazio, a seção de relatos não aparece e as atrações usam só o cálculo pela vazão.

1. Em [script.google.com](https://script.google.com), crie um projeto, cole o conteúdo de `criar-formulario.gs` e execute `criarOcorrencias`. Autorize com a sua conta Google. Os links aparecem no registro de execução.
2. Na planilha, abra **Arquivo > Compartilhar > Publicar na Web**, escolha só a aba **Publico**, formato **CSV**, e publique. Não publique a planilha inteira: a aba **Respostas** tem os relatos ainda não revisados.
3. Coloque o link do formulário e o link CSV no `config.js`.
4. Para publicar um relato, escreva **Sim** na coluna **Aprovado** da aba Respostas. O dashboard mostra a mudança em alguns minutos.

Um relato de fechamento vale por 12 horas. Se marcar "Sem previsão de reabertura", vale até surgir um relato de reabertura.

## Visitas

As visitas são contadas de forma anônima, sem cookies, pelo GoatCounter, no painel `https://regua-iguacu.goatcounter.com`. Os cliques nos botões aparecem como eventos: `compartilhar-whatsapp`, `atalho-clique`, `atalho-criado`, `idioma-xx`, `grafico-Ndias` e `simulacao`.

Para saber de qual grupo vieram as visitas, compartilhe o link com `?ref=` no fim, por exemplo `https://rovigattidenis-code.github.io/regua-do-iguacu/?ref=familia`. O nome aparece no painel como origem da visita.

## QR code e prints

O `qrcode.svg` abre `https://rovigattidenis-code.github.io/regua-do-iguacu/?ref=qrcode`, e as visitas por ele aparecem no GoatCounter com a origem `qrcode`. Se o endereço do site mudar, o QR precisa ser gerado de novo.

Não é possível impedir um print de tela num site. Em vez disso, o gráfico leva uma marca d'água com o nome, o endereço e a hora da leitura, e a impressão em papel ou PDF mostra o QR e os créditos.

## Ver e testar no computador

```bash
python -m http.server 8765
```

Depois abra `http://localhost:8765`. Abrir o `index.html` com dois cliques não funciona, porque o navegador bloqueia a leitura do `vazao.json`.

```bash
node --test
```

## De onde vêm as referências

- **Vazão média de 1.500 m³/s:** valor citado pelo Parque Nacional do Iguaçu na imprensa.
- **Linha de 8.000 m³/s da passarela:** as notícias citam entre 8 e 8,5 milhões de L/s, com tendência de alta. Não é um limite oficial.
- **Limites de 7.000 e 11.000 m³/s (Argentina):** copiados da primeira versão da Régua do Iguaçu, sem confirmação em outra fonte.
- **Cota em centímetros:** conforme o manual do HidroWebService da ANA.
