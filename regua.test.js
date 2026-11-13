// Regua nova, cor da agua e linhas do grafico. Rode com: node --test
const test = require("node:test");
const assert = require("node:assert");
const p = require("./painel.js");

test.afterEach(() => p.definirIdioma("pt"));

test("cor da agua vai de 0 (verde) a 1 (barrento) ate 8.000", () => {
  assert.strictEqual(p.misturaAgua(350), 0);
  assert.strictEqual(p.misturaAgua(100), 0);
  assert.strictEqual(p.misturaAgua(8000), 1);
  // No meio da escala a agua ainda e quase toda verde (curva cubica).
  const meio = p.misturaAgua(4175);
  assert.ok(meio > 0.12 && meio < 0.13);
  assert.ok(p.misturaAgua(7000) > 0.6);
});

test("agua fica vermelha a partir de 8.000", () => {
  assert.strictEqual(p.aguaCritica(7999), false);
  assert.strictEqual(p.aguaCritica(8000), true);
});

test("escala da regua cobre o pico de 2026 e cheias maiores", () => {
  assert.strictEqual(p.reguaMax(5000), 18000);
  assert.strictEqual(p.reguaMax(19000), 21000);
});

test("marcas da regua tem nome no idioma", () => {
  const marcas = p.marcasRegua();
  assert.deepStrictEqual(marcas.map((m) => m.v), [17700, 11000, 8000, 7000, 1500, 350]);
  assert.strictEqual(marcas[2].nome, "Passarela BR");
  p.definirIdioma("en");
  assert.strictEqual(p.marcasRegua()[0].nome, "2026 peak");
});

test("grafico vai pelo menos ate 12.000 para mostrar os circuitos", () => {
  assert.strictEqual(p.eixoMax([3000, 5000]), 12000);
  assert.ok(p.eixoMax([17700]) >= 17700);
});

test("linhas do grafico trazem a media e os limites das atracoes", () => {
  const linhas = p.linhasGrafico();
  assert.deepStrictEqual(linhas.map((l) => l.v), [1500, 7000, 8000, 11000]);
  assert.strictEqual(linhas[1].rotulo, "Garganta AR, 7.000");
  assert.strictEqual(linhas[1].abaixo, true);
  assert.strictEqual(linhas[0].limite, false);
});

test("periodos do grafico e seus nomes", () => {
  assert.deepStrictEqual(p.PERIODOS, [24, 48, 168, 360, 720]);
  assert.strictEqual(p.nomePeriodo(24), "1 dia");
  assert.strictEqual(p.nomePeriodo(360), "15 dias");
  assert.strictEqual(p.tituloPeriodo(24), "Últimas 24 horas");
  assert.strictEqual(p.tituloPeriodo(720), "Últimos 30 dias");
  p.definirIdioma("fr");
  assert.strictEqual(p.tituloPeriodo(168), "7 derniers jours");
});

test("marca d'agua traz o nome, o endereco e a hora da leitura", () => {
  const url = "rovigattidenis-code.github.io/regua-do-iguacu";
  assert.strictEqual(
    p.textoMarca({ medicao: "2026-11-13T10:00:00-03:00" }, url),
    "Régua do Iguaçu, rovigattidenis-code.github.io/regua-do-iguacu, leitura de 13/11, 10:00"
  );
  p.definirIdioma("en");
  assert.match(p.textoMarca({ medicao: "2026-11-13T10:00:00-03:00" }, url), /reading from 11\/13, 10:00$/);
});
