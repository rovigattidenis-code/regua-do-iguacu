#!/usr/bin/env python3
"""Busca a vazao da estacao Hotel Cataratas (ANA 65992502) e grava vazao.json.

Uso:
    1. Copie .env.example para .env e preencha ANA_IDENTIFICADOR e ANA_SENHA.
    2. python3 ana_vazao.py

Rode a cada 30 minutos (cron ou Agendador de Tarefas). So usa a biblioteca padrao.
O token da ANA vale cerca de 60 minutos. O script guarda o token num arquivo e
so pede outro perto de vencer, porque a ANA pode bloquear o IP de quem
autentica com muita frequencia.

Suposicoes que ainda nao foram confirmadas com a ANA:
  - Data_Hora_Medicao vem no horario de Brasilia.
  - Os valores de RANGES alem de HORA_2 (que funcionou) existem na API.
"""
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
BRT = timezone(timedelta(hours=-3))  # o Brasil nao tem horario de verao desde 2019
UA = "regua-do-iguacu/1.0"


def carregar_env():
    arq = HERE / ".env"
    if not arq.exists():
        return
    for linha in arq.read_text(encoding="utf-8").splitlines():
        linha = linha.strip()
        if not linha or linha.startswith("#") or "=" not in linha:
            continue
        k, v = linha.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


carregar_env()

BASE = os.environ.get("ANA_BASE", "https://www.ana.gov.br/hidrowebservice").rstrip("/")
ESTACAO = os.environ.get("ESTACAO", "65992502")
NOME = os.environ.get("NOME_ESTACAO", "Hotel Cataratas")
SAIDA = Path(os.environ.get("SAIDA", str(HERE / "vazao.json")))
# Janelas tentadas em ordem. A primeira que devolver dados e usada.
RANGES = [r.strip() for r in os.environ.get("RANGES", "DIAS_2,HORA_24,HORA_2").split(",") if r.strip()]
TOKEN_TTL_MIN = int(os.environ.get("TOKEN_TTL_MIN", "50"))
CACHE = HERE / ".token_cache.json"
LOG = HERE / "erro.log"


def http_get(url, headers):
    h = {"accept": "*/*", "User-Agent": UA}
    h.update(headers)
    req = urllib.request.Request(url, headers=h, method="GET")
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode("utf-8"))


def obter_token(forcar=False):
    agora = datetime.now().timestamp()
    if not forcar and CACHE.exists():
        try:
            c = json.loads(CACHE.read_text())
            if agora - c["obtido_em"] < TOKEN_TTL_MIN * 60 and c.get("token"):
                return c["token"]
        except (ValueError, KeyError, OSError):
            pass
    ident = os.environ.get("ANA_IDENTIFICADOR")
    senha = os.environ.get("ANA_SENHA")
    if not ident or not senha:
        raise SystemExit("Defina ANA_IDENTIFICADOR e ANA_SENHA no arquivo .env")
    dados = http_get(BASE + "/EstacoesTelemetricas/OAUth/v1", {"Identificador": ident, "Senha": senha})
    token = (dados.get("items") or {}).get("tokenautenticacao")
    if not token:
        raise RuntimeError("A ANA nao devolveu tokenautenticacao: %s" % dados.get("message"))
    CACHE.write_text(json.dumps({"token": token, "obtido_em": agora}))
    try:
        os.chmod(CACHE, 0o600)
    except OSError:
        pass
    return token


def buscar_itens(token, rng, data_busca):
    params = {
        "Código da Estação": ESTACAO,
        "Tipo Filtro Data": "DATA_LEITURA",
        "Data de Busca (yyyy-MM-dd)": data_busca,
        "Range Intervalo de busca": rng,
    }
    url = BASE + "/EstacoesTelemetricas/HidroinfoanaSerieTelemetricaAdotada/v1?" + urllib.parse.urlencode(
        params, quote_via=urllib.parse.quote
    )
    dados = http_get(url, {"Authorization": "Bearer " + token})
    return dados.get("items") or []


def buscar_com_fallback(data_busca):
    token = obter_token()
    renovou = False
    ultimo_erro = None
    for rng in RANGES:
        while True:
            try:
                itens = buscar_itens(token, rng, data_busca)
                break
            except urllib.error.HTTPError as e:
                if e.code in (401, 403) and not renovou:
                    token = obter_token(forcar=True)
                    renovou = True
                    continue
                ultimo_erro = "HTTP %s com range %s" % (e.code, rng)
                itens = []
                break
        if itens:
            return itens, rng
    raise RuntimeError("Sem dados da estacao %s (%s)" % (ESTACAO, ultimo_erro or "resposta vazia"))


def numero(x):
    try:
        return None if x is None else float(x)
    except (TypeError, ValueError):
        return None


def ler_serie(itens):
    pontos = {}
    for it in itens:
        v = numero(it.get("Vazao_Adotada"))
        bruto = it.get("Data_Hora_Medicao")
        if v is None or not bruto:
            continue
        t = datetime.strptime(bruto[:19], "%Y-%m-%d %H:%M:%S").replace(tzinfo=BRT)
        pontos[t] = {
            "t": t, "v": v, "status": str(it.get("Vazao_Adotada_Status", "")),
            "cota": numero(it.get("Cota_Adotada")), "atualizado": it.get("Data_Atualizacao"),
        }
    return [pontos[k] for k in sorted(pontos)]


def calcular(serie):
    ult = serie[-1]
    boas = [p for p in serie if p["status"] == "0"] or serie

    var24 = None
    alvo = ult["t"] - timedelta(hours=24)
    cand = min(boas, key=lambda p: abs((p["t"] - alvo).total_seconds()))
    if abs((cand["t"] - alvo).total_seconds()) <= 90 * 60:
        var24 = ult["v"] - cand["v"]

    taxa, janela_h = None, None
    recentes = [p for p in boas if (ult["t"] - p["t"]) <= timedelta(hours=6) and p["t"] < ult["t"]]
    if recentes:
        ref = recentes[0]
        janela_h = (ult["t"] - ref["t"]).total_seconds() / 3600
        if janela_h >= 1:
            taxa = (ult["v"] - ref["v"]) / janela_h

    equiv24 = var24 if var24 is not None else (taxa * 24 if taxa is not None else None)
    if equiv24 is None:
        tend = None
    elif equiv24 > 150:
        tend = "subindo"
    elif equiv24 < -150:
        tend = "descendo"
    else:
        tend = "estavel"

    qual = {"0": "ok", "1": "suspeita", "2": "ruim"}.get(ult["status"], "desconhecida")
    return ult, var24, taxa, janela_h, tend, qual


def main():
    agora = datetime.now(BRT)
    itens, rng = buscar_com_fallback(agora.strftime("%Y-%m-%d"))
    serie = ler_serie(itens)
    if not serie:
        raise RuntimeError("A resposta nao trouxe nenhuma vazao valida")
    ult, var24, taxa, janela_h, tend, qual = calcular(serie)
    saida = {
        "estacao": ESTACAO,
        "nome": NOME,
        "fonte": "ANA / Copel",
        "vazao_m3s": ult["v"],
        "cota": ult["cota"],
        "medicao": ult["t"].isoformat(),
        "atualizado_ana": ult["atualizado"],
        "qualidade": qual,
        "variacao_24h_m3s": None if var24 is None else round(var24, 1),
        "taxa_m3s_por_hora": None if taxa is None else round(taxa, 1),
        "janela_taxa_horas": None if janela_h is None else round(janela_h, 2),
        "tendencia": tend,
        "range_usado": rng,
        "gerado_em": agora.isoformat(timespec="seconds"),
        "atraso_min": int((agora - ult["t"]).total_seconds() // 60),
        "serie": [{"t": p["t"].isoformat(), "v": p["v"]} for p in serie[-300:]],
    }
    tmp = SAIDA.with_suffix(SAIDA.suffix + ".tmp")
    tmp.write_text(json.dumps(saida, ensure_ascii=False, indent=1), encoding="utf-8")
    os.replace(tmp, SAIDA)
    print("%s m3/s as %s | tendencia: %s | var24h: %s | qualidade: %s | janela: %s | atraso: %s min" % (
        round(ult["v"]), ult["t"].strftime("%d/%m %H:%M"), tend, saida["variacao_24h_m3s"], qual, rng, saida["atraso_min"]))
    if saida["atraso_min"] > 180:
        print("AVISO: a ultima leitura tem mais de 3 horas.", file=sys.stderr)


if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except Exception as e:  # mantem o vazao.json anterior e registra o erro
        msg = "%s %s: %s" % (datetime.now(BRT).isoformat(timespec="seconds"), type(e).__name__, e)
        print(msg, file=sys.stderr)
        try:
            with open(LOG, "a", encoding="utf-8") as f:
                f.write(msg + "\n")
        except OSError:
            pass
        sys.exit(1)
