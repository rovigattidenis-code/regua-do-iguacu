// Regras das atracoes, da comparacao e dos relatos. Rode com: node --test
const test = require("node:test");
const assert = require("node:assert");
const p = require("./painel.js");

const passarela = p.ATRACOES.find((a) => a.id === "br-passarela");
const agora = Date.parse("2026-11-06T18:00:00-03:00");
const relato = (extra) => ({
  local: "br-passarela", lado: "BR", situacao: "fechado", indefinido: false,
  quando: "2026-11-06T15:00:00-03:00", ...extra,
});

test("piscinas usa 2.500 m3 por piscina", () => {
  assert.strictEqual(p.piscinas(8250), 3.3);
});

test("formatarVazao troca a unidade", () => {
  assert.strictEqual(p.formatarVazao(8297, "m3"), "8.297 m³/s");
  assert.strictEqual(p.formatarVazao(8297, "ml"), "8,3 milhões de L/s");
});

test("ritmo24h usa a taxa por hora quando falta a variacao de 24 h", () => {
  assert.strictEqual(p.ritmo24h({ variacao_24h_m3s: 900, taxa_m3s_por_hora: 1 }), 900);
  assert.strictEqual(p.ritmo24h({ variacao_24h_m3s: null, taxa_m3s_por_hora: 10 }), 240);
  assert.strictEqual(p.ritmo24h({ variacao_24h_m3s: null, taxa_m3s_por_hora: null }), null);
});

test("estado pela vazao nunca diz fechado", () => {
  assert.strictEqual(p.estadoAtracao(passarela, 8297, 3225, [], agora).chave, "acima");
  assert.strictEqual(p.estadoAtracao(passarela, 6900, 0, [], agora).chave, "atencao");
  assert.strictEqual(p.estadoAtracao(passarela, 5700, 900, [], agora).chave, "atencao");
  assert.strictEqual(p.estadoAtracao(passarela, 3000, 0, [], agora).chave, "dentro");
});

test("relato de fechamento recente vira fechado relatado", () => {
  const e = p.estadoAtracao(passarela, 3000, 0, [relato()], agora);
  assert.strictEqual(e.chave, "fechado");
  assert.strictEqual(e.relatado, true);
});

test("relato de fechamento antigo expira depois de 12 h", () => {
  const velho = relato({ quando: "2026-11-05T12:00:00-03:00" });
  assert.strictEqual(p.estadoAtracao(passarela, 3000, 0, [velho], agora).chave, "dentro");
});

test("fechamento sem previsao nao expira", () => {
  const velho = relato({ quando: "2026-11-01T12:00:00-03:00", indefinido: true });
  assert.strictEqual(p.estadoAtracao(passarela, 3000, 0, [velho], agora).chave, "fechado");
});

test("reabertura mais recente derruba o fechamento", () => {
  const lista = [relato({ indefinido: true }), relato({ situacao: "aberto", quando: "2026-11-06T17:00:00-03:00" })];
  assert.strictEqual(p.estadoAtracao(passarela, 3000, 0, lista, agora).chave, "dentro");
});

test("relato de outro local nao interfere", () => {
  const e = p.estadoAtracao(passarela, 3000, 0, [relato({ local: "ar-superior" })], agora);
  assert.strictEqual(e.chave, "dentro");
});

test("atracao fora de servico nao aparece como dentro do limite", () => {
  const garganta = p.ATRACOES.find((a) => a.id === "ar-garganta");
  assert.strictEqual(p.estadoAtracao(garganta, 3000, 0, [], agora).rotulo, "Fora de serviço");
  const reaberta = [relato({ local: "ar-garganta", lado: "AR", situacao: "aberto" })];
  assert.strictEqual(p.estadoAtracao(garganta, 3000, 0, reaberta, agora).chave, "dentro");
});

test("projecao calcula o tempo ate o limite", () => {
  assert.strictEqual(p.projecao(passarela, 7000, 1000), "No ritmo atual, chega ao limite em ~24 h.");
  assert.strictEqual(p.projecao(passarela, 5000, 1000), "No ritmo atual, chega ao limite em ~3,0 dias.");
  assert.strictEqual(p.projecao(passarela, 7900, 1200), "No ritmo atual, chega ao limite em ~2 h.");
  assert.strictEqual(p.projecao(passarela, 7000, -50), "Estável ou descendo, sem aproximação do limite.");
  assert.strictEqual(p.projecao(passarela, 7000, null), "Sem ritmo de subida para projetar.");
});

test("projecao acima do limite cita a reabertura conhecida", () => {
  assert.match(p.projecao(passarela, 8297, -100), /6\.800/);
  assert.strictEqual(p.projecao(passarela, 8297, 500), "Acima do limite e sem queda no ritmo atual.");
});

test("lerCSV respeita aspas, virgulas e quebras de linha", () => {
  const linhas = p.lerCSV('a,b\r\n"x, y","linha 1\nlinha ""2"""\r\n');
  assert.deepStrictEqual(linhas, [["a", "b"], ["x, y", 'linha 1\nlinha "2"']]);
});

test("lerRelatos converte a aba Publico da planilha", () => {
  const csv = [
    "Carimbo,Local,Situação,Motivo,Quando,Vazão,Quem relatou,Sem previsão,Observação",
    '06/11/2026 15:10:00,Passarela principal (Brasil),Fechado,Vazão do rio,06/11/2026 15:00:00,8.297,Guia,Sim,"Sem acesso, só mirante"',
    "06/11/2026 16:00:00,Circuito Superior (Argentina),Restrito,Chuva forte,06/11/2026 15:30:00,,,Não,",
  ].join("\n");
  const r = p.lerRelatos(csv);
  assert.strictEqual(r.length, 2);
  assert.strictEqual(r[0].local, "ar-superior");
  assert.strictEqual(r[0].lado, "AR");
  assert.strictEqual(r[0].situacao, "restrito");
  assert.strictEqual(r[0].vazao, null);
  assert.strictEqual(r[1].local, "br-passarela");
  assert.strictEqual(r[1].indefinido, true);
  assert.strictEqual(r[1].vazao, 8297);
  assert.strictEqual(r[1].quando, "2026-11-06T15:00:00-03:00");
  assert.strictEqual(r[1].obs, "Sem acesso, só mirante");
});

test("lerRelatos descarta linha sem data ou situacao validas", () => {
  const csv = "cabecalho\n06/11/2026 15:10:00,Passarela principal (Brasil),Talvez,,ontem,,,,\n";
  assert.deepStrictEqual(p.lerRelatos(csv), []);
});

test("local fora da lista vira Outro, mantendo o lado", () => {
  const csv = "cabecalho\n06/11/2026 15:10:00,Outro local (Argentina),Fechado,,06/11/2026 15:00:00,,,,";
  const [r] = p.lerRelatos(csv);
  assert.strictEqual(r.local, "outro");
  assert.strictEqual(r.lado, "AR");
});
