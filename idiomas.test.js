// Traducao, idioma automatico e recorte do grafico. Rode com: node --test
const test = require("node:test");
const assert = require("node:assert");
const p = require("./painel.js");
const textos = require("./idiomas.js");

test.afterEach(() => p.definirIdioma("pt"));

test("todo texto do portugues existe nos outros idiomas", () => {
  const chaves = Object.keys(textos.pt);
  for (const lang of ["en", "es", "fr"]) {
    const faltam = chaves.filter((k) => !(k in textos[lang]));
    assert.deepStrictEqual(faltam, [], "faltam em " + lang);
    const sobram = Object.keys(textos[lang]).filter((k) => !(k in textos.pt));
    assert.deepStrictEqual(sobram, [], "sobram em " + lang);
  }
});

test("detectarIdioma usa o primeiro idioma conhecido do aparelho", () => {
  assert.strictEqual(p.detectarIdioma(["fr-CA", "en-US"]), "fr");
  assert.strictEqual(p.detectarIdioma(["de-DE", "es-AR"]), "es");
  assert.strictEqual(p.detectarIdioma(["pt-PT"]), "pt");
});

test("idioma desconhecido cai no ingles", () => {
  assert.strictEqual(p.detectarIdioma(["de-DE", "ja"]), "en");
  assert.strictEqual(p.detectarIdioma([]), "en");
});

test("definirIdioma ignora idioma que nao existe", () => {
  assert.strictEqual(p.definirIdioma("de"), "pt");
  assert.strictEqual(p.idioma(), "pt");
});

test("t troca as variaveis", () => {
  p.definirIdioma("en");
  assert.strictEqual(p.t("graf.titulo", { h: 96 }), "Last 96 hours");
});

test("manchete e numeros seguem o idioma", () => {
  p.definirIdioma("en");
  assert.strictEqual(p.manchete(8250), "The Iguaçu is at 5.5 times its average flow");
  assert.strictEqual(p.formatarVazao(8297, "m3"), "8,297 m³/s");
  assert.strictEqual(p.formatarVazao(8297, "ml"), "8.3 million L/s");
  p.definirIdioma("es");
  assert.strictEqual(p.manchete(8250), "El Iguazú tiene 5,5 veces su caudal medio");
  p.definirIdioma("fr");
  assert.strictEqual(p.manchete(900), "L'Iguaçu est en dessous de son débit moyen");
});

test("estado da atracao sai traduzido", () => {
  const passarela = p.ATRACOES.find((a) => a.id === "br-passarela");
  p.definirIdioma("es");
  assert.strictEqual(p.estadoAtracao(passarela, 8297, 0, [], Date.now()).rotulo, "Por encima del límite");
  assert.strictEqual(p.nomeAtracao(passarela).nome, "Pasarela principal");
});

test("alerta formata o limite no idioma", () => {
  p.definirIdioma("en");
  assert.match(p.alertaPassarela(8225, "subindo"), /^Above 8,000 m³\/s and rising/);
});

test("recorteSerie guarda so as ultimas horas pedidas", () => {
  const serie = [];
  for (let i = 0; i < 168; i++) serie.push({ t: new Date(Date.UTC(2026, 10, 2, i)).toISOString(), v: i });
  assert.strictEqual(p.recorteSerie(serie, 24).length, 25);
  assert.strictEqual(p.recorteSerie(serie, 168).length, 168);
  assert.strictEqual(p.recorteSerie(serie, 24)[0].v, 143);
  assert.deepStrictEqual(p.recorteSerie([], 24), []);
});

test("mensagem do WhatsApp traz a leitura e o link", () => {
  const url = "https://exemplo.com/regua/";
  assert.strictEqual(
    p.textoCompartilhar({ vazao_m3s: 8250 }, url),
    "O Iguaçu está com 5,5 vezes a vazão média: 8.250 m³/s. Veja ao vivo: https://exemplo.com/regua/"
  );
  assert.strictEqual(p.textoCompartilhar(null, url), "Veja ao vivo a vazão do Rio Iguaçu nas Cataratas: https://exemplo.com/regua/");
  p.definirIdioma("en");
  assert.match(p.textoCompartilhar({ vazao_m3s: 8250 }, url), /^The Iguaçu is at 5\.5 times its average flow: 8,250 m³\/s\. See it live: /);
});

test("link do WhatsApp codifica a mensagem", () => {
  assert.strictEqual(p.linkWhatsApp("a b&c"), "https://wa.me/?text=a%20b%26c");
});
