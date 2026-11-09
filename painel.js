// Regras de leitura do dashboard. Nao toca na pagina, para poder ser testado com node --test.
(function (raiz, fabrica) {
  if (typeof module !== "undefined" && module.exports) module.exports = fabrica(require("./idiomas.js"));
  else raiz.Painel = fabrica(raiz.ReguaIdiomas);
})(typeof self !== "undefined" ? self : this, function (TEXTOS) {
  // Referencias vindas da imprensa, do Parque e das concessionarias, nao sao limites oficiais da ANA.
  const VAZAO_MEDIA = 1500;
  const VAZAO_PASSARELA = 8000;
  const ATRASO_MAX_MIN = 180;
  const M3_POR_PISCINA = 2500;
  const VALIDADE_RELATO_H = 12;
  const FUSO = "America/Sao_Paulo";

  const IDIOMAS = ["pt", "en", "es", "fr"];
  const LOCALE = { pt: "pt-BR", en: "en-US", es: "es-AR", fr: "fr-FR" };
  let lang = "pt";

  function definirIdioma(l) {
    if (IDIOMAS.includes(l)) lang = l;
    return lang;
  }
  const idioma = () => lang;

  // O primeiro idioma do aparelho que a pagina conhece; sem nenhum, ingles para o turista estrangeiro.
  function detectarIdioma(lista) {
    for (const l of lista || []) {
      const base = String(l).toLowerCase().slice(0, 2);
      if (IDIOMAS.includes(base)) return base;
    }
    return "en";
  }

  function t(chave, vars) {
    const texto = (TEXTOS[lang] && TEXTOS[lang][chave]) || TEXTOS.pt[chave] || chave;
    return texto.replace(/\{(\w+)\}/g, (m, k) => (vars && vars[k] != null ? vars[k] : m));
  }

  // Para informar que uma atracao voltou a funcionar, apague o campo foraDeServico.
  // Nomes e descricoes ficam em idiomas.js (atr.<id>.nome e atr.<id>.sub).
  const ATRACOES = [
    { id: "br-passarela", lado: "BR", limite: 8000, reabertura: 6800, fonte: "Urbia+Cataratas e ICMBio" },
    { id: "ar-garganta", lado: "AR", limite: 7000, reabertura: null, fonte: "Iguazú Argentina S.A.", foraDeServico: true },
    { id: "ar-superior", lado: "AR", limite: 11000, reabertura: null, fonte: "Parque Nacional Iguazú" },
    { id: "ar-inferior", lado: "AR", limite: 11000, reabertura: null, fonte: "Parque Nacional Iguazú" },
  ];

  // Nomes e notas ficam em idiomas.js (ref.<id>.nome e ref.<id>.nota).
  const REFERENCIAS = [
    { id: "cenico", v: 350, limite: false },
    { id: "media", v: 1500, limite: false },
    { id: "reabre", v: 6800, limite: false },
    { id: "garganta", v: 7000, limite: true },
    { id: "fecha", v: 8000, limite: true },
    { id: "circuitos", v: 11000, limite: true },
    { id: "leitura1310", v: 13488, limite: false },
    { id: "pico", v: 17700, limite: false },
  ];

  const nomeAtracao = (a) => ({
    nome: t("atr." + a.id + ".nome"),
    sub: t("atr." + a.id + ".sub"),
    fora: a.foraDeServico ? t("atr." + a.id + ".fora") : null,
  });
  const nomeReferencia = (r) => ({ nome: t("ref." + r.id + ".nome"), nota: t("ref." + r.id + ".nota") });

  // Os nomes precisam ser iguais aos do formulario (criar-formulario.gs).
  const LOCAIS = [
    { id: "br-passarela", lado: "BR", nome: "Passarela principal (Brasil)" },
    { id: "br-trilha", lado: "BR", nome: "Trilha das Cataratas (Brasil)" },
    { id: "br-macuco", lado: "BR", nome: "Macuco Safari (Brasil)" },
    { id: "br-barco", lado: "BR", nome: "Passeio de barco (Brasil)" },
    { id: "ar-garganta", lado: "AR", nome: "Garganta del Diablo (Argentina)" },
    { id: "ar-superior", lado: "AR", nome: "Circuito Superior (Argentina)" },
    { id: "ar-inferior", lado: "AR", nome: "Circuito Inferior (Argentina)" },
    { id: "ar-macuco", lado: "AR", nome: "Sendero Macuco (Argentina)" },
    { id: "ar-verde", lado: "AR", nome: "Sendero Verde (Argentina)" },
    { id: "ar-trem", lado: "AR", nome: "Tren Ecológico (Argentina)" },
  ];
  const SITUACOES = { Fechado: "fechado", Restrito: "restrito", Reaberto: "aberto" };
  const rotuloSituacao = (s) => t("sit." + s);

  const num = (v, casas = 0) =>
    new Intl.NumberFormat(LOCALE[lang], { maximumFractionDigits: casas, minimumFractionDigits: casas }).format(v);
  const comSinal = (v) =>
    new Intl.NumberFormat(LOCALE[lang], { maximumFractionDigits: 0, signDisplay: "always" }).format(v);

  function nivel(v) {
    const vezes = v / VAZAO_MEDIA;
    const chave = vezes < 0.8 ? "abaixo" : vezes <= 1.2 ? "normal" : "acima";
    return { chave, vezes };
  }

  function manchete(v) {
    const n = nivel(v);
    if (n.chave !== "acima") return t("manchete." + n.chave);
    return t(n.vezes < 2 ? "manchete.acima1" : "manchete.acima", { x: num(n.vezes, 1) });
  }

  function fraseTendencia(d) {
    if (!["subindo", "descendo", "estavel"].includes(d.tendencia)) return t("tend.indisp");
    const r = t("tend." + d.tendencia);
    if (d.variacao_24h_m3s != null) return t("tend.24h", { r, v: comSinal(d.variacao_24h_m3s) });
    if (d.taxa_m3s_por_hora != null) return t("tend.hora", { r, v: comSinal(d.taxa_m3s_por_hora) });
    return r;
  }

  const atrasoMin = (medicaoIso, agoraMs) => Math.floor((agoraMs - Date.parse(medicaoIso)) / 60000);
  const dadoAtrasado = (min) => min > ATRASO_MAX_MIN;

  function alertaPassarela(v, tendencia) {
    if (v < VAZAO_PASSARELA) return null;
    return t(tendencia === "subindo" ? "alerta.subindo" : "alerta.acima", { lim: num(VAZAO_PASSARELA) });
  }

  function eixoMax(valores) {
    const pico = Math.max(VAZAO_PASSARELA, ...valores);
    return Math.ceil((pico * 1.1) / 1000) * 1000;
  }

  const dia = (iso) =>
    new Intl.DateTimeFormat(LOCALE[lang], { timeZone: FUSO, day: "2-digit", month: "2-digit" }).format(new Date(iso));
  const hora = (iso) =>
    new Intl.DateTimeFormat(LOCALE[lang], { timeZone: FUSO, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso));
  const formatarHora = (iso) => dia(iso) + ", " + hora(iso);

  function horaLocal(iso) {
    return Number(new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, hour: "2-digit", hourCycle: "h23" }).format(new Date(iso)));
  }

  function textoAtraso(min) {
    if (min < 60) return t("atraso.min", { n: Math.max(min, 0) });
    if (min < 2880) {
      const h = Math.floor(min / 60);
      return h === 1 ? t("atraso.hora") : t("atraso.horas", { n: h });
    }
    return t("atraso.dias", { n: Math.floor(min / 1440) });
  }

  const qualidade = (q) => t("qual." + (["ok", "suspeita", "ruim"].includes(q) ? q : "desconhecida"));

  const piscinas = (v) => v / M3_POR_PISCINA;

  const formatarVazao = (v, unidade) =>
    unidade === "ml" ? num(v / 1000, 1) + " " + t("un.ml") : num(v) + " m³/s";

  function ritmo24h(d) {
    if (d.variacao_24h_m3s != null) return d.variacao_24h_m3s;
    if (d.taxa_m3s_por_hora != null) return d.taxa_m3s_por_hora * 24;
    return null;
  }

  // Leituras das ultimas `horas` horas, contadas a partir da leitura mais recente.
  function recorteSerie(serie, horas) {
    if (!serie.length) return [];
    const fim = Date.parse(serie[serie.length - 1].t);
    return serie.filter((p) => Date.parse(p.t) >= fim - horas * 3600e3);
  }

  function ultimoRelato(id, relatos) {
    return relatos
      .filter((r) => r.local === id)
      .reduce((m, r) => (!m || Date.parse(r.quando) > Date.parse(m.quando) ? r : m), null);
  }

  function estadoPelaVazao(a, v, ritmo) {
    if (v >= a.limite) return { chave: "acima", rotulo: t("estado.acima") };
    if (v >= a.limite * 0.85 || (ritmo > 150 && v >= a.limite * 0.7)) return { chave: "atencao", rotulo: t("estado.atencao") };
    return { chave: "dentro", rotulo: t("estado.dentro") };
  }

  // A pagina calcula pela vazao e nao sabe o que o parque decidiu: "Fechado" so aparece com relato.
  function estadoAtracao(a, v, ritmo, relatos, agoraMs) {
    const ultimo = ultimoRelato(a.id, relatos);
    const base = { relatado: false, ultimo };
    if (ultimo) {
      const horas = (agoraMs - Date.parse(ultimo.quando)) / 36e5;
      if (ultimo.situacao === "fechado" && (ultimo.indefinido || horas < VALIDADE_RELATO_H))
        return { ...base, chave: "fechado", rotulo: t("estado.fechadoRel"), relatado: true };
      if (ultimo.situacao === "restrito" && horas < VALIDADE_RELATO_H)
        return { ...base, chave: "atencao", rotulo: t("estado.restritoRel"), relatado: true };
    }
    if (a.foraDeServico && !(ultimo && ultimo.situacao === "aberto"))
      return { ...base, chave: "fechado", rotulo: t("estado.fora") };
    return { ...base, ...estadoPelaVazao(a, v, ritmo) };
  }

  function tempoAte(horas) {
    return horas < 48 ? t("tempo.h", { n: Math.max(1, Math.round(horas)) }) : t("tempo.dias", { n: num(horas / 24, 1) });
  }

  function projecao(a, v, ritmo) {
    const falta = a.limite - v;
    if (ritmo == null) return t("proj.semRitmo");
    if (falta <= 0) {
      if (ritmo >= 0) return t("proj.acimaSemQueda");
      return a.reabertura ? t("proj.acimaDescendoReab", { v: num(a.reabertura) }) : t("proj.acimaDescendo");
    }
    if (ritmo > 0) return t("proj.chega", { t: tempoAte((falta / ritmo) * 24) });
    return t("proj.estavel");
  }

  function lerCSV(texto) {
    const linhas = [];
    let linha = [], campo = "", aspas = false;
    for (let i = 0; i < texto.length; i++) {
      const c = texto[i];
      if (aspas) {
        if (c === '"' && texto[i + 1] === '"') { campo += '"'; i++; }
        else if (c === '"') aspas = false;
        else campo += c;
      } else if (c === '"') aspas = true;
      else if (c === ",") { linha.push(campo); campo = ""; }
      else if (c === "\n") { linha.push(campo); linhas.push(linha); linha = []; campo = ""; }
      else if (c !== "\r") campo += c;
    }
    if (campo || linha.length) { linha.push(campo); linhas.push(linha); }
    return linhas;
  }

  function dataBR(s) {
    const m = /^(\d{2})\/(\d{2})\/(\d{4})[ ,T]+(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec((s || "").trim());
    if (!m) return null;
    return m[3] + "-" + m[2] + "-" + m[1] + "T" + m[4].padStart(2, "0") + ":" + m[5] + ":" + (m[6] || "00") + "-03:00";
  }

  function vazaoDoRelato(s) {
    const txt = (s || "").trim().replace(/\./g, "").replace(",", ".");
    if (!txt) return null;
    const n = Number(txt);
    return Number.isFinite(n) && n >= 0 ? n : null;
  }

  // Colunas da aba Publico: carimbo, local, situacao, motivo, quando, vazao, quem relatou, sem previsao, observacao.
  function lerRelatos(csv) {
    return lerCSV(csv)
      .slice(1)
      .map((c) => {
        const situacao = SITUACOES[(c[2] || "").trim()];
        const quando = dataBR(c[4]);
        if (!situacao || !quando) return null;
        const nome = (c[1] || "").trim();
        const achado = LOCAIS.find((l) => l.nome === nome);
        return {
          local: achado ? achado.id : "outro",
          lado: achado ? achado.lado : /argentina/i.test(nome) ? "AR" : "BR",
          nome: nome || "Local não informado",
          situacao,
          motivo: (c[3] || "").trim(),
          quando,
          vazao: vazaoDoRelato(c[5]),
          fonte: (c[6] || "").trim(),
          indefinido: situacao === "fechado" && (c[7] || "").trim().toLowerCase() === "sim",
          obs: (c[8] || "").trim(),
        };
      })
      .filter(Boolean)
      .sort((a, b) => Date.parse(b.quando) - Date.parse(a.quando));
  }

  return {
    VAZAO_MEDIA, VAZAO_PASSARELA, ATRACOES, REFERENCIAS, LOCAIS, IDIOMAS,
    t, definirIdioma, idioma, detectarIdioma, nomeAtracao, nomeReferencia, rotuloSituacao,
    num, comSinal, nivel, manchete, fraseTendencia, atrasoMin, dadoAtrasado, alertaPassarela, eixoMax,
    dia, hora, formatarHora, horaLocal, textoAtraso, qualidade, piscinas, formatarVazao, ritmo24h, recorteSerie,
    estadoAtracao, projecao, lerCSV, lerRelatos,
  };
});
