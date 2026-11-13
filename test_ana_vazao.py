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


if __name__ == "__main__":
    unittest.main()
