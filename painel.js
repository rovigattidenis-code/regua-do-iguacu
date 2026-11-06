// Regras de leitura do dashboard. Nao toca na pagina, para poder ser testado com node --test.
(function (raiz, fabrica) {
  if (typeof module !== "undefined" && module.exports) module.exports = fabrica();
  else raiz.Painel = fabrica();
})(typeof self !== "undefined" ? self : this, function () {
  // Referencias vindas da imprensa, do Parque e das concessionarias, nao sao limites oficiais da ANA.
  const VAZAO_MEDIA = 1500;
  const VAZAO_PASSARELA = 8000;
  const ATRASO_MAX_MIN = 180;
  const M3_POR_PISCINA = 2500;
  const VALIDADE_RELATO_H = 12;
  const FUSO = "America/Sao_Paulo";

  // Para informar que uma atracao voltou a funcionar, apague o campo foraDeServico.
  const ATRACOES = [
    { id: "br-passarela", lado: "BR", nome: "Passarela principal", sub: "Garganta do Diabo, lado brasileiro", limite: 8000, reabertura: 6800, fonte: "Urbia+Cataratas e ICMBio" },
    {
      id: "ar-garganta", lado: "AR", nome: "Garganta del Diablo", sub: "Passarela, lado argentino", limite: 7000, reabertura: null, fonte: "Iguazú Argentina S.A.",
      foraDeServico: "Passarela desmontada desde agosto de 2026, sem data de reabertura divulgada.",
    },
    { id: "ar-superior", lado: "AR", nome: "Circuito Superior", sub: "Lado argentino", limite: 11000, reabertura: null, fonte: "Parque Nacional Iguazú" },
    { id: "ar-inferior", lado: "AR", nome: "Circuito Inferior", sub: "Lado argentino", limite: 11000, reabertura: null, fonte: "Parque Nacional Iguazú" },
  ];

  const REFERENCIAS = [
    { v: 350, nome: "Mínimo para beleza cênica", nota: "Referência da ANA, boletim de fev/2025", limite: false },
    { v: 1500, nome: "Média histórica", nota: "Vazão média das Cataratas", limite: false },
    { v: 6800, nome: "Reabertura da passarela (Brasil)", nota: "Nível de 31/out/2026", limite: false },
    { v: 7000, nome: "Limite da Garganta del Diablo (Argentina)", nota: "Protocolo da Iguazú Argentina", limite: true },
    { v: 8000, nome: "Fechamento da passarela (Brasil)", nota: "Com tendência de alta", limite: true },
    { v: 11000, nome: "Limite dos circuitos Superior e Inferior (Argentina)", nota: "Protocolo do Parque Nacional Iguazú", limite: true },
    { v: 13488, nome: "Leitura de 13/out/2026", nota: "Estação Hotel Cataratas, 18h", limite: false },
    { v: 17700, nome: "Pico de 2026", nota: "26/out/2026", limite: false },
  ];

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
  const ROTULO_SITUACAO = { fechado: "Fechado", restrito: "Restrito", aberto: "Reaberto" };

  const num = (v, casas = 0) =>
    new Intl.NumberFormat("pt-BR", { maximumFractionDigits: casas, minimumFractionDigits: casas }).format(v);
  const comSinal = (v) =>
    new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0, signDisplay: "always" }).format(v);

  function nivel(v) {
    const vezes = v / VAZAO_MEDIA;
    const chave = vezes < 0.8 ? "abaixo" : vezes <= 1.2 ? "normal" : "acima";
    return { chave, vezes };
  }

  function manchete(v) {
    const n = nivel(v);
    if (n.chave === "abaixo") return "O Iguaçu está abaixo da vazão média";
    if (n.chave === "normal") return "O Iguaçu está perto da vazão média";
    const vezes = num(n.vezes, 1);
    return "O Iguaçu está com " + vezes + (n.vezes < 2 ? " vez" : " vezes") + " a vazão média";
  }

  function fraseTendencia(d) {
    const rotulo = { subindo: "Subindo", descendo: "Descendo", estavel: "Estável" }[d.tendencia];
    if (!rotulo) return "Tendência indisponível";
    if (d.variacao_24h_m3s != null) return rotulo + ": " + comSinal(d.variacao_24h_m3s) + " m³/s em 24 h";
    if (d.taxa_m3s_por_hora != null) return rotulo + ": " + comSinal(d.taxa_m3s_por_hora) + " m³/s por hora";
    return rotulo;
  }

  const atrasoMin = (medicaoIso, agoraMs) => Math.floor((agoraMs - Date.parse(medicaoIso)) / 60000);
  const dadoAtrasado = (min) => min > ATRASO_MAX_MIN;

  function alertaPassarela(v, tendencia) {
    if (v < VAZAO_PASSARELA) return null;
    const estado = tendencia === "subindo" ? "Acima de 8.000 m³/s e subindo" : "Acima de 8.000 m³/s";
    return estado + ": nível em que a interdição da passarela das Cataratas costuma ser avaliada. Confirme com o Parque antes de ir.";
  }

  function eixoMax(valores) {
    const pico = Math.max(VAZAO_PASSARELA, ...valores);
    return Math.ceil((pico * 1.1) / 1000) * 1000;
  }

  function formatarHora(iso) {
    const d = new Date(iso);
    const dia = new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, day: "2-digit", month: "2-digit" }).format(d);
    const hora = new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);
    return dia + ", " + hora;
  }

  function horaLocal(iso) {
    return Number(new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, hour: "2-digit", hourCycle: "h23" }).format(new Date(iso)));
  }

  function textoAtraso(min) {
    if (min < 60) return "há " + Math.max(min, 0) + " min";
    if (min < 2880) {
      const h = Math.floor(min / 60);
      return "há " + h + (h === 1 ? " hora" : " horas");
    }
    return "há " + Math.floor(min / 1440) + " dias";
  }

  const qualidade = (q) => ({ ok: "Boa", suspeita: "Suspeita", ruim: "Ruim" }[q] || "Desconhecida");

  const piscinas = (v) => v / M3_POR_PISCINA;

  const formatarVazao = (v, unidade) =>
    unidade === "ml" ? num(v / 1000, 1) + " milhões de L/s" : num(v) + " m³/s";

  function ritmo24h(d) {
    if (d.variacao_24h_m3s != null) return d.variacao_24h_m3s;
    if (d.taxa_m3s_por_hora != null) return d.taxa_m3s_por_hora * 24;
    return null;
  }

  function ultimoRelato(id, relatos) {
    return relatos
      .filter((r) => r.local === id)
      .reduce((m, r) => (!m || Date.parse(r.quando) > Date.parse(m.quando) ? r : m), null);
  }

  function estadoPelaVazao(a, v, ritmo) {
    if (v >= a.limite) return { chave: "acima", rotulo: "Acima do limite" };
    if (v >= a.limite * 0.85 || (ritmo > 150 && v >= a.limite * 0.7)) return { chave: "atencao", rotulo: "Atenção" };
    return { chave: "dentro", rotulo: "Dentro do limite" };
  }

  // A pagina calcula pela vazao e nao sabe o que o parque decidiu: "Fechado" so aparece com relato.
  function estadoAtracao(a, v, ritmo, relatos, agoraMs) {
    const ultimo = ultimoRelato(a.id, relatos);
    const base = { relatado: false, ultimo };
    if (ultimo) {
      const horas = (agoraMs - Date.parse(ultimo.quando)) / 36e5;
      if (ultimo.situacao === "fechado" && (ultimo.indefinido || horas < VALIDADE_RELATO_H))
        return { ...base, chave: "fechado", rotulo: "Fechado, relatado", relatado: true };
      if (ultimo.situacao === "restrito" && horas < VALIDADE_RELATO_H)
        return { ...base, chave: "atencao", rotulo: "Restrito, relatado", relatado: true };
    }
    if (a.foraDeServico && !(ultimo && ultimo.situacao === "aberto"))
      return { ...base, chave: "fechado", rotulo: "Fora de serviço" };
    return { ...base, ...estadoPelaVazao(a, v, ritmo) };
  }

  function tempoAte(horas) {
    return horas < 48 ? "~" + Math.max(1, Math.round(horas)) + " h" : "~" + num(horas / 24, 1) + " dias";
  }

  function projecao(a, v, ritmo) {
    const falta = a.limite - v;
    if (ritmo == null) return "Sem ritmo de subida para projetar.";
    if (falta <= 0) {
      if (ritmo >= 0) return "Acima do limite e sem queda no ritmo atual.";
      return a.reabertura
        ? "Acima do limite e descendo. A passarela reabriu com " + num(a.reabertura) + " m³/s em 31/out."
        : "Acima do limite e descendo. A reabertura depende do parque.";
    }
    if (ritmo > 0) return "No ritmo atual, chega ao limite em " + tempoAte((falta / ritmo) * 24) + ".";
    return "Estável ou descendo, sem aproximação do limite.";
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
    const t = (s || "").trim().replace(/\./g, "").replace(",", ".");
    if (!t) return null;
    const n = Number(t);
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
    VAZAO_MEDIA, VAZAO_PASSARELA, ATRACOES, REFERENCIAS, LOCAIS, ROTULO_SITUACAO,
    num, comSinal, nivel, manchete, fraseTendencia, atrasoMin, dadoAtrasado, alertaPassarela, eixoMax,
    formatarHora, horaLocal, textoAtraso, qualidade, piscinas, formatarVazao, ritmo24h, estadoAtracao,
    projecao, lerCSV, lerRelatos,
  };
});
