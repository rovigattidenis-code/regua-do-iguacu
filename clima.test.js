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
  return { elevation: 162, hourly, daily: { time: ["2026-11-20"], sunrise: ["2026-11-20T05:25"], sunset: ["2026-11-20T18:52"] } };
}

const tardeComRaios = (h) => (h >= 15 && h <= 17 ? { chuva: 80, cod: 95 } : {});

test("resumo pega o dia, a hora atual e os picos", () => {
  const r = p.resumoClima(previsao((h) => (h === 13 ? { sens: 36 } : {})), "2026-11-20", 10);
  assert.strictEqual(r.horas[0].h, 6);
  assert.strictEqual(r.horas.at(-1).h, 20);
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
  assert.match(s, /^Raios previstos entre 15h e 18h/);
  assert.match(s, /Cataratas cedo/);
  assert.match(s, /protetor solar/);
});

test("sugestao para dia firme com vazao alta", () => {
  const r = p.resumoClima(previsao(), "2026-11-20", 8);
  const s = p.sugestaoDia(r, 8300);
  assert.match(s, /Dia firme/);
  assert.match(s, /confirme com o parque/);
});

test("sugestao para manha chuvosa", () => {
  const r = p.resumoClima(previsao((h) => (h >= 8 && h <= 11 ? { chuva: 70, cod: 63 } : {})), "2026-11-20", 8);
  assert.match(p.sugestaoDia(r, 5000), /Manhã com chuva/);
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
