// Rode com: node --test
const test = require("node:test");
const assert = require("node:assert");
const p = require("./painel.js");

test("nivel compara com a media de 1.500 m3/s", () => {
  assert.strictEqual(p.nivel(1000).chave, "abaixo");
  assert.strictEqual(p.nivel(1500).chave, "normal");
  assert.strictEqual(p.nivel(1800).chave, "normal");
  assert.strictEqual(p.nivel(8250).chave, "acima");
  assert.strictEqual(p.nivel(8250).vezes, 5.5);
});

test("manchete diz quantas vezes a media em portugues", () => {
  assert.strictEqual(p.manchete(8250), "O Iguaçu está com 5,5 vezes a vazão média");
  assert.strictEqual(p.manchete(2250), "O Iguaçu está com 1,5 vez a vazão média");
  assert.strictEqual(p.manchete(1500), "O Iguaçu está perto da vazão média");
  assert.strictEqual(p.manchete(900), "O Iguaçu está abaixo da vazão média");
});

test("fraseTendencia usa a variacao de 24 h", () => {
  const f = p.fraseTendencia({ tendencia: "subindo", variacao_24h_m3s: 3187.6, taxa_m3s_por_hora: 124.2 });
  assert.strictEqual(f, "Subindo: +3.188 m³/s em 24 h");
  const d = p.fraseTendencia({ tendencia: "descendo", variacao_24h_m3s: -400, taxa_m3s_por_hora: -10 });
  assert.strictEqual(d, "Descendo: -400 m³/s em 24 h");
});

test("fraseTendencia cai para a taxa por hora sem variacao de 24 h", () => {
  const f = p.fraseTendencia({ tendencia: "subindo", variacao_24h_m3s: null, taxa_m3s_por_hora: 12.4 });
  assert.strictEqual(f, "Subindo: +12 m³/s por hora");
});

test("fraseTendencia sem dados nao inventa tendencia", () => {
  const f = p.fraseTendencia({ tendencia: null, variacao_24h_m3s: null, taxa_m3s_por_hora: null });
  assert.strictEqual(f, "Tendência indisponível");
});

test("atrasoMin mede da leitura ate agora", () => {
  const agora = Date.parse("2026-11-06T15:00:00-03:00");
  assert.strictEqual(p.atrasoMin("2026-11-06T14:00:00-03:00", agora), 60);
});

test("dado com mais de 3 horas fica atrasado", () => {
  assert.strictEqual(p.dadoAtrasado(180), false);
  assert.strictEqual(p.dadoAtrasado(181), true);
});

test("alertaPassarela so aparece a partir de 8.000 m3/s", () => {
  assert.strictEqual(p.alertaPassarela(7999, "subindo"), null);
  assert.match(p.alertaPassarela(8225, "subindo"), /e subindo/);
  assert.doesNotMatch(p.alertaPassarela(8225, "descendo"), /e subindo/);
});

test("eixoMax sempre mostra a linha de 8.000 e o pico", () => {
  assert.ok(p.eixoMax([2000, 3000]) >= 8000);
  assert.ok(p.eixoMax([2000, 16800]) >= 16800);
});

test("formatarHora usa o horario de Brasilia", () => {
  assert.strictEqual(p.formatarHora("2026-11-06T17:00:00Z"), "06/11, 14:00");
});
