# Régua do Iguaçu

Página pública com a vazão do Rio Iguaçu na estação Hotel Cataratas (ANA 65992502).

## Como funciona

1. A cada hora, o GitHub roda o `ana_vazao.py`, que busca os dados na ANA e grava o `vazao.json`.
2. O `index.html` lê esse arquivo e desenha a régua, o gráfico e os números.

As regras de leitura ficam em `painel.js`. Nesse arquivo você altera os limites das atrações (`ATRACOES`), as linhas de comparação (`REFERENCIAS`) e a vazão média. Quando a Garganta del Diablo voltar a funcionar, apague o campo `foraDeServico`.

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
