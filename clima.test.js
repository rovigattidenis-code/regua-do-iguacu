// Painel do dia: resumo do clima e sugestao. Rode com: node --test
const test = require("node:test");
const assert = require("node:assert");
const p = require("./painel.js");

test.afterEach(() => p.definirIdioma("pt"));

// Monta uma resposta no formato do Open-Meteo para 20/11, de hora em hora.
function previsao(ajuste) {
  const hourly = { time: [], temperature_2m: [], apparent_temperature: [], precipitation_probability: [], weather_code: [], uv_index: [], cloud_cover: [], relative_humidity_2m: [], wind_speed_10m: [], surface_pressure: [] };
  for (let h = 0; h < 24; h++) {
    const x = { temp: 25, sens: 27, chuva: 5, cod: 1, uv: h > 9 && h < 16 ? 9 : 2, nuvens: 20, umid: 70, vento: 10, pressao: 1009, ...(ajuste ? ajuste(h) : {}) };
    hourly.time.push("2026-11-20T" + String(h).padStart(2, "0") + ":00");
    hourly.temperature_2m.push(x.temp);
    hourly.apparent_temperature.push(x.sens);
    hourly.precipitation_probability.push(x.chuva);
    hourly.weather_code.push(x.cod);
    hourly.uv_index.push(x.uv);
    hourly.cloud_cover.push(x.nuvens);
    hourly.relative_humidity_2m.push(x.umid);
    hourly.wind_speed_10m.push(x.vento);
    hourly.surface_pressure.push(x.pressao);
  }
  return { elevation: 162, hourly, daily: { time: ["2026-11-20"], sunrise: ["2026-11-20T05:25"], sunset: ["2026-11-20T18:52"], precipitation_sum: [12.4] } };
}

const tardeComRaios = (h) => (h >= 15 && h <= 17 ? { chuva: 80, cod: 95 } : {});

test("resumo pega o dia, a hora atual e os picos", () => {
  const r = p.resumoClima(previsao((h) => (h === 13 ? { sens: 36 } : {})), "2026-11-20", 10);
  assert.strictEqual(r.horas[0].h, 6);
  assert.strictEqual(r.horas.at(-1).h, 18);
  assert.strictEqual(r.chuvaDia, 12.4);
  assert.strictEqual(r.sensMax, 36);
  assert.strictEqual(r.uvMax, 9);
  assert.strictEqual(r.atual.umidade, 70);
  assert.strictEqual(r.altitude, 162);
  assert.strictEqual(r.nascer, "05:25");
});

test("janela de raios e de chuva forte", () => {
  const r = p.resumoClima(previsao(tardeComRaios), "2026-11-20", 8);
  assert.deepStrictEqual(r.raios, { ini: 15, fim: 18 });
  assert.deepStrictEqual(r.chuva, { ini: 15, fim: 18 });
});

test("arco-iris provavel nas manhas de sol, no horario do parque", () => {
  const r = p.resumoClima(previsao(), "2026-11-20", 8);
  assert.deepStrictEqual(r.arcoIris, { ini: 9, fim: 12 });
  const nublado = p.resumoClima(previsao((h) => ({ nuvens: 90 })), "2026-11-20", 8);
  assert.strictEqual(nublado.arcoIris, null);
});

test("sugestao para tarde com raios", () => {
  const r = p.resumoClima(previsao(tardeComRaios), "2026-11-20", 8);
  const s = p.sugestaoDia(r, 5000);
  assert.match(s, /^Alerta de raios entre 15h e 18h/);
  assert.match(s, /Alerta de chuva à tarde/);
  assert.match(s, /protetor solar/);
  // So alertas: nada de proibir ou mandar evitar atrativos.
  assert.doesNotMatch(s, /evite|proibid|não vá|passeio de barco/i);
});

test("sugestao para dia firme com vazao alta", () => {
  const r = p.resumoClima(previsao(), "2026-11-20", 8);
  const s = p.sugestaoDia(r, 8300);
  assert.match(s, /Tempo firme/);
  assert.match(s, /Alerta de vazão alta/);
});

test("sugestao para manha chuvosa", () => {
  const r = p.resumoClima(previsao((h) => (h >= 8 && h <= 11 ? { chuva: 70, cod: 63 } : {})), "2026-11-20", 8);
  assert.match(p.sugestaoDia(r, 5000), /Alerta de chuva pela manhã/);
});

test("nivel do indice UV", () => {
  assert.strictEqual(p.nivelUV(2), "Baixo");
  assert.strictEqual(p.nivelUV(9), "Muito alto");
  assert.strictEqual(p.nivelUV(11), "Extremo");
});

test("fase da lua", () => {
  assert.strictEqual(p.faseLua(new Date("2026-11-24T12:00:00Z")), "cheia");
  assert.strictEqual(p.faseLua(new Date("2026-11-09T12:00:00Z")), "nova");
});

test("chuva rio acima", () => {
  assert.match(p.textoMontante({ chuva_24h_mm: 38 }), /a vazão pode subir/);
  assert.match(p.textoMontante({ chuva_24h_mm: 2 }), /Sem chuva forte/);
  assert.match(p.textoMontante(null), /Sem dado/);
});

test("previsao curta para turistas", () => {
  const raios = p.resumoClima(previsao(tardeComRaios), "2026-11-20", 8);
  assert.strictEqual(p.previsaoCurta(raios), "chuva com raios das 15h às 18h");
  const firme = p.resumoClima(previsao(), "2026-11-20", 8);
  assert.strictEqual(p.previsaoCurta(firme), "sem chuva forte");
});

test("resumo para turistas traz so o convite para o site", () => {
  const r = p.resumoClima(previsao(tardeComRaios), "2026-11-20", 8);
  const d = { vazao_m3s: 4795, medicao: "2026-11-20T19:00:00-03:00" };
  assert.deepStrictEqual(p.mensagemTuristas(d, r, "sábado, 21/11", "https://exemplo.com/regua/"), [
    "Acesse o site para ter mais informações: https://exemplo.com/regua/",
  ]);
  p.definirIdioma("en");
  assert.deepStrictEqual(p.mensagemTuristas(d, r, "Saturday", "https://x/"), ["Visit the website for more information: https://x/"]);
});

test("hora atual destacada no hora a hora", () => {
  const r = p.resumoClima(previsao(), "2026-11-20", 9);
  assert.deepStrictEqual(r.horas.filter((x) => x.agora).map((x) => x.h), [8]);
  const noite = p.resumoClima(previsao(), "2026-11-20", 21);
  assert.strictEqual(noite.horas.some((x) => x.agora), false);
});
