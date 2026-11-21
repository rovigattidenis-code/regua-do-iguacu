"""Testes do script da ANA. Rode com: python -m unittest test_ana_vazao"""
import unittest
from datetime import datetime, timedelta

import ana_vazao as a


def ponto(hora, v):
    t = datetime(2026, 11, 13, 0, tzinfo=a.BRT) + timedelta(hours=hora)
    return {"t": t.isoformat(), "v": v}


class MesclarSerie(unittest.TestCase):
    def test_mantem_o_historico_quando_a_ana_manda_menos_dias(self):
        antiga = [ponto(h, 100) for h in range(0, 48)]
        nova = [ponto(h, 200) for h in range(46, 50)]
        r = a.mesclar_serie(antiga, nova, horas=720)
        self.assertEqual(len(r), 50)
        self.assertEqual(r[0]["v"], 100)

    def test_leitura_nova_substitui_a_antiga_do_mesmo_horario(self):
        r = a.mesclar_serie([ponto(5, 100)], [ponto(5, 150)], horas=720)
        self.assertEqual(r, [ponto(5, 150)])

    def test_guarda_so_a_janela_pedida(self):
        antiga = [ponto(h, 1) for h in range(0, 800)]
        r = a.mesclar_serie(antiga, [ponto(800, 2)], horas=720)
        self.assertEqual(r[-1]["v"], 2)
        self.assertEqual(r[0]["t"], ponto(80, 1)["t"])

    def test_ordena_por_horario(self):
        r = a.mesclar_serie([ponto(3, 1), ponto(1, 1)], [ponto(2, 1)], horas=720)
        self.assertEqual([p["t"] for p in r], [ponto(1, 1)["t"], ponto(2, 1)["t"], ponto(3, 1)["t"]])

    def test_sem_arquivo_antigo_usa_so_a_nova(self):
        self.assertEqual(a.mesclar_serie([], [ponto(1, 5)], horas=720), [ponto(1, 5)])


def item(hora, chuva, vazao=5000.0):
    t = datetime(2026, 11, 20, 0) + timedelta(hours=hora)
    return {"Data_Hora_Medicao": t.strftime("%Y-%m-%d %H:%M:%S.0"), "Chuva_Adotada": str(chuva),
            "Vazao_Adotada": str(vazao), "Vazao_Adotada_Status": "0"}


class ResumoMontante(unittest.TestCase):
    def test_soma_a_chuva_das_ultimas_24_horas(self):
        itens = [item(h, 2.0) for h in range(0, 30)]
        r = a.resumir_montante(itens)
        self.assertEqual(r["chuva_24h_mm"], 48.0)
        self.assertEqual(r["medicao"], "2026-11-21T05:00:00-03:00")

    def test_traz_a_ultima_vazao(self):
        itens = [item(1, 0, 4000.0), item(2, 0, 4100.0)]
        self.assertEqual(a.resumir_montante(itens)["vazao_m3s"], 4100.0)

    def test_sem_itens_devolve_nada(self):
        self.assertIsNone(a.resumir_montante([]))


if __name__ == "__main__":
    unittest.main()
