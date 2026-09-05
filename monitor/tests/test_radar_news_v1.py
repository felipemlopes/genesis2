"""
Radar News V1.0 — Testes de comportamento (substituem os testes obsoletos que
travavam o comportamento ANTERIOR à especificação: janela de 3h, dedup por
título+fonte, fail-open, discovery_radar acoplado). Cobrem C1-C9 e a seção 2
(carteira Cripto.ico).
"""

import time as _time
from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch

import pymysql
import pytest
from hypothesis import given, settings, HealthCheck, assume
from hypothesis import strategies as st

from rss_collector import RSSCollector
from ai_classifier import (
    AIClassifier,
    calcular_nivel,
    calcular_impact_score,
    load_carteira_tokens,
    CATEGORIAS_NOMES,
)
from telegram_dispatcher import TelegramDispatcher, SEVERITY_EMOJI, SEVERITY_LABELS, SIGNATURE
from worker_radar_news import RadarNewsWorker


class FakeEntry:
    """Simula uma entrada feedparser com published_parsed."""

    def __init__(self, age_minutes: int):
        past = _time.time() - (age_minutes * 60)
        self.published_parsed = _time.gmtime(past)
        self.updated_parsed = None
        self.title = f"Entry age={age_minutes}min"


class FakeEntryNoTimestamp:
    def __init__(self):
        self.published_parsed = None
        self.updated_parsed = None
        self.title = "Sem timestamp"


CARTEIRA_SET = {'BTC', 'ETH', 'SOL', 'ETHFI', 'ENA'}


# ═══════════════════════════════════════════════════════════════════════════
# C1 — Frescor: janela de 30 minutos, fail-closed
# ═══════════════════════════════════════════════════════════════════════════

@given(age_minutes=st.integers(min_value=0, max_value=29))
@settings(max_examples=50, suppress_health_check=[HealthCheck.too_slow])
def test_c1_accepts_entries_within_30_minutes(age_minutes):
    entry = FakeEntry(age_minutes)
    assert RSSCollector._is_recent(entry) is True


@given(age_minutes=st.integers(min_value=31, max_value=2880))
@settings(max_examples=50, suppress_health_check=[HealthCheck.too_slow])
def test_c1_rejects_entries_older_than_30_minutes(age_minutes):
    entry = FakeEntry(age_minutes)
    assert RSSCollector._is_recent(entry) is False


def test_c1_concrete_45min_rejected_10min_accepted():
    assert RSSCollector._is_recent(FakeEntry(45)) is False
    assert RSSCollector._is_recent(FakeEntry(10)) is True


def test_c1_no_timestamp_is_fail_closed():
    """Sem timestamp não é mais fail-open: a entrada é descartada."""
    entry = FakeEntryNoTimestamp()
    assert RSSCollector._is_recent(entry) is False


def test_c1_no_hours_3_default_window():
    """Prova de aceite: zero de hours=3 no default de _is_recent."""
    import inspect
    src = inspect.getsource(RSSCollector._fetch_single_feed)
    assert 'hours=3' not in src


# ═══════════════════════════════════════════════════════════════════════════
# A5 — Coleta RSS robusta: User-Agent/timeout/ETag + saúde de feed (P12)
# ═══════════════════════════════════════════════════════════════════════════

def test_a5_feed_user_agent_and_cache_present():
    import inspect
    src = inspect.getsource(RSSCollector._fetch_single_feed)
    assert 'agent=FEED_USER_AGENT' in src
    assert 'etag=' in src and 'modified=' in src


def test_p12_feed_mudo_20_ciclos_loga_fonte_muda(caplog):
    import logging
    collector = RSSCollector()

    with caplog.at_level(logging.ERROR, logger='radar-news'):
        for _ in range(19):
            collector._registrar_saude('Bloomberg', 0)
        assert not any('FONTE MUDA' in rec.message for rec in caplog.records), \
            "nao deveria alertar antes do 20o ciclo sem entrada"

        collector._registrar_saude('Bloomberg', 0)  # 20o ciclo
        assert any('FONTE MUDA' in rec.message and 'Bloomberg' in rec.message for rec in caplog.records)


def test_a5_registrar_saude_reseta_contador_em_entrada_nova():
    collector = RSSCollector()
    for _ in range(19):
        collector._registrar_saude('CoinDesk', 0)
    collector._registrar_saude('CoinDesk', 3)  # feed voltou a responder
    assert collector._vazios['CoinDesk'] == 0


# ═══════════════════════════════════════════════════════════════════════════
# A3 — Dedup migra pro coletor: hash global (sem filtro de fonte) + similaridade
# sobre o título original, ANTES de gastar classificação
# ═══════════════════════════════════════════════════════════════════════════

def _mock_conn(fetchone_sequence=None, fetchall_result=None):
    cursor = MagicMock()
    if fetchone_sequence is not None:
        cursor.fetchone.side_effect = fetchone_sequence
    cursor.fetchall.return_value = fetchall_result or []
    cursor.__enter__ = MagicMock(return_value=cursor)
    cursor.__exit__ = MagicMock(return_value=False)

    conn = MagicMock()
    conn.cursor.return_value = cursor
    return conn


def test_a3_no_source_filter_in_dedup_query():
    """Prova de aceite P05: zero de 'source = %s' na query de dedup do coletor."""
    import inspect
    src = inspect.getsource(RSSCollector.deduplicate)
    assert 'source = %s' not in src


def test_a3_same_title_different_sources_same_cycle_blocked_by_hash():
    """Mesma notícia por fontes diferentes: hash agora é GLOBAL, sem filtrar por
    fonte — bloqueia mesmo com 'source' diferente (P06, parcial: hash exato)."""
    collector = RSSCollector()
    entries = [{'title': 'Binance suspende saques', 'source': 'Fonte Nova'}]
    conn = _mock_conn(fetchone_sequence=[{'id': 1}], fetchall_result=[])

    result = collector.deduplicate(entries, conn)
    assert result == []


def test_a3_similar_title_72h_blocked_at_collector():
    """Manchete parafraseada dentro de 72h é bloqueada no coletor, antes de
    gastar classificação (P07) — compara contra title_original, não o traduzido."""
    collector = RSSCollector()
    entries = [{'title': 'Exchange XYZ suspende saques apos exploit de US$ 340 milhoes hoje'}]
    conn = _mock_conn(
        fetchone_sequence=[None],  # hash exato não bate
        fetchall_result=[{'title_original': 'Exchange XYZ suspende saques apos exploit de US$ 340 milhoes'}],
    )

    result = collector.deduplicate(entries, conn)
    assert result == []


def test_a3_new_entry_passes_dedup():
    collector = RSSCollector()
    entries = [{'title': 'Fato totalmente novo e inedito sobre o mercado cripto'}]
    conn = _mock_conn(fetchone_sequence=[None], fetchall_result=[])

    result = collector.deduplicate(entries, conn)
    assert len(result) == 1
    assert result[0]['title'] == entries[0]['title']
    assert result[0]['title_hash']  # coletor grava o hash pra downstream (persist)


# ═══════════════════════════════════════════════════════════════════════════
# C3 — Classificação por id, nunca por posição
# ═══════════════════════════════════════════════════════════════════════════

def test_c3_merge_by_id_mismatched_count_no_neighbor_inheritance():
    """Se o Gemini devolve 4 classificações para 5 entradas, a sem par é
    descartada — nenhuma herda severidade da vizinha."""
    classifier = AIClassifier(api_key='fake')
    classifier._alias_map = {}

    entries = [{'id': i, 'title': f'Noticia {i}', 'title_hash': f'h{i}'} for i in range(1, 6)]
    # O Gemini "esquece" de classificar a entrada id=3 (opinião genérica)
    classifications = [
        {'id': 1, 'severity': 'LOW', 'categoria': 3, 'affected_assets': []},
        {'id': 2, 'severity': 'CRITICAL', 'categoria': 2, 'affected_assets': ['BTC'], 'acionavel': True, 'mecanismo': 'x'},
        {'id': 4, 'severity': 'HIGH', 'categoria': 1, 'affected_assets': ['ETH'], 'acionavel': True, 'mecanismo': 'x'},
        {'id': 5, 'severity': 'LOW', 'categoria': 3, 'affected_assets': []},
    ]

    result = classifier._merge_classifications(entries, classifications, CARTEIRA_SET)

    result_ids = {e['id'] for e in result}
    assert result_ids == {1, 2, 4, 5}
    assert 3 not in result_ids, "Entrada sem par (id=3) deveria ser descartada, nunca herdar classificacao"

    entry_2 = next(e for e in result if e['id'] == 2)
    assert entry_2['severity'] == 'CRITICAL', "id=2 nao deveria herdar severidade de nenhuma vizinha"


# ═══════════════════════════════════════════════════════════════════════════
# C4 — Nível calculado por regra
# ═══════════════════════════════════════════════════════════════════════════

def test_c4_critical_always_nivel_1():
    e = {'severity': 'CRITICAL', 'affected_assets': [], 'categoria': 3, 'acionavel': False, 'mecanismo': ''}
    assert calcular_nivel(e, CARTEIRA_SET) == 1


def test_c4_high_acionavel_carteira_nivel_1():
    """Parceria da Ether.fi com mecanismo concreto (carteira): Nivel 1, dispara."""
    e = {
        'severity': 'HIGH', 'affected_assets': ['ETHFI'], 'categoria': 1,
        'acionavel': True, 'mecanismo': 'Uso do eETH como colateral na Aave.',
    }
    assert calcular_nivel(e, CARTEIRA_SET) == 1


def test_c4_high_generic_no_mechanism_nivel_2():
    """Analise generica HIGH (sem mecanismo/acionavel): Nivel 2, sem disparo."""
    e = {'severity': 'HIGH', 'affected_assets': [], 'categoria': 4, 'acionavel': False, 'mecanismo': ''}
    assert calcular_nivel(e, CARTEIRA_SET) == 2


def test_c4_high_medium_touching_carteira_nivel_2():
    e = {'severity': 'MEDIUM', 'affected_assets': ['SOL'], 'categoria': 8, 'acionavel': False, 'mecanismo': ''}
    assert calcular_nivel(e, CARTEIRA_SET) == 2


def test_c4_low_opiniao_nivel_3():
    """Opiniao: Nivel 3, so historico."""
    e = {'severity': 'LOW', 'affected_assets': [], 'categoria': 3, 'acionavel': False, 'mecanismo': ''}
    assert calcular_nivel(e, CARTEIRA_SET) == 3


def test_c4_macro_categoria_5_dispara_sem_tocar_carteira():
    """Macro (5) dispara Nivel 1 mesmo sem tocar a carteira, se HIGH+acionavel."""
    e = {
        'severity': 'HIGH', 'affected_assets': [], 'categoria': 5,
        'acionavel': True, 'mecanismo': 'Fed sinaliza corte de juros acima do esperado.',
    }
    assert calcular_nivel(e, CARTEIRA_SET) == 1


# ═══════════════════════════════════════════════════════════════════════════
# E1 — Categorias/ativos sistêmicos alcançam Nível 1 sem tocar a carteira
# ═══════════════════════════════════════════════════════════════════════════

def test_e1_stablecoin_categoria_10_dispara_sem_tocar_carteira():
    """Antes de E1: USDT fora da carteira + categoria 10 nunca alcançava Nível 1
    (não é BTC, categoria 10 não estava em CATEGORIAS_MERCADO_INTEIRO). Depois:
    categoria 10 é sistêmica, dispara com HIGH+acionavel mesmo sem BTC/carteira."""
    e = {
        'severity': 'HIGH', 'affected_assets': ['USDT'], 'categoria': 10,
        'acionavel': True, 'mecanismo': 'Resgates em massa pressionam a paridade do USDT.',
    }
    assert calcular_nivel(e, CARTEIRA_SET) == 1


def test_e1_regulacao_categoria_3_sistemica():
    e = {
        'severity': 'HIGH', 'affected_assets': [], 'categoria': 3,
        'acionavel': True, 'mecanismo': 'SEC aprova ETF a vista.',
    }
    assert calcular_nivel(e, CARTEIRA_SET) == 1


def test_e1_categoria_nao_sistemica_sem_carteira_nao_dispara_nivel_1():
    """O funil continua fechado: categoria 1 (Ativos Cripto.ico) não é sistêmica
    (Bloco E1) — sem tocar a carteira, HIGH+acionável cai pra Nível 2, não 1."""
    e = {
        'severity': 'HIGH', 'affected_assets': ['DOGE'], 'categoria': 1,
        'acionavel': True, 'mecanismo': 'Upgrade de rede com impacto econômico.',
    }
    assert calcular_nivel(e, CARTEIRA_SET) == 2


def test_e1_eth_e_sistemico_mesmo_sem_categoria_sistemica():
    """Ativo sistêmico (ETH) basta, mesmo em categoria não listada como sistêmica."""
    e = {
        'severity': 'HIGH', 'affected_assets': ['ETH'], 'categoria': 7,
        'acionavel': True, 'mecanismo': 'Abertura de futuros de ETH na CME.',
    }
    assert calcular_nivel(e, CARTEIRA_SET) == 1


# ═══════════════════════════════════════════════════════════════════════════
# C5 — Impact score calculado pelo sistema
# ═══════════════════════════════════════════════════════════════════════════

def test_c5_critical_nivel1_carteira_score_100():
    e = {'severity': 'CRITICAL', 'nivel': 1, 'affected_assets': ['BTC']}
    assert calcular_impact_score(e, CARTEIRA_SET) == 100


def test_c5_media_nivel2_fora_carteira_score_35():
    e = {'severity': 'MEDIUM', 'nivel': 2, 'affected_assets': ['DOGE']}
    assert calcular_impact_score(e, CARTEIRA_SET) == 35


def test_c5_score_never_exceeds_100():
    e = {'severity': 'CRITICAL', 'nivel': 1, 'affected_assets': ['ETH']}
    assert calcular_impact_score(e, CARTEIRA_SET) <= 100


# ═══════════════════════════════════════════════════════════════════════════
# C2 — Identidade por fato (event_key). Hash exato e similaridade migraram pro
# coletor com a A3 — ver seção "A3" acima (rss_collector.deduplicate).
# ═══════════════════════════════════════════════════════════════════════════

def test_c2_event_key_duplicate_blocked():
    classifier = AIClassifier(api_key='fake')
    entry = {
        'title': 'Ether.fi integra eETH como colateral',
        'titulo_pt': 'Ether.fi integra eETH como colateral',
        'title_hash': 'abc123',
        'event_key': 'ETHFI|INTEGRACAO_COLATERAL|2026-07-18',
        'source': 'The Block',
        'severity': 'HIGH',
        'nivel': 1,
        'impact_score': 70,
        'affected_assets': ['ETHFI'],
    }
    conn = _mock_conn(fetchone_sequence=[{'id': 99}])  # event_key ja existe

    result = classifier.persist_classified(entry, conn)

    assert result is False
    conn.cursor().execute.assert_called_once()  # nao chega a inserir


def test_c2_new_fact_is_inserted():
    classifier = AIClassifier(api_key='fake')
    entry = {
        'title': 'Fato totalmente novo e unico', 'titulo_pt': 'Fato totalmente novo e unico',
        'title_hash': 'uniquehash', 'event_key': 'X|Y|2026-07-18', 'source': 'Decrypt',
        'severity': 'LOW', 'nivel': 3, 'impact_score': 5, 'affected_assets': [],
        'categoria': 3, 'market_bias': 'NEUTRAL',
    }
    conn = _mock_conn(fetchone_sequence=[None], fetchall_result=[])

    result = classifier.persist_classified(entry, conn)
    assert result is True
    conn.commit.assert_called_once()


# ═══════════════════════════════════════════════════════════════════════════
# A4 — event_key normalizado, sem janela em Python na checagem contra o banco
# ═══════════════════════════════════════════════════════════════════════════

def test_a4_normalizar_event_key_accents_and_spaces():
    from ai_classifier import normalizar_event_key
    assert normalizar_event_key('ETHFI|Integração Colateral|2026-07-18') == 'ETHFI|INTEGRACAO_COLATERAL|2026-07-18'


def test_a4_normalizar_event_key_malformed_returns_none():
    from ai_classifier import normalizar_event_key
    assert normalizar_event_key('BTC-REGULACAO-2026-08-02') is None  # sem os dois separadores '|'
    assert normalizar_event_key('') is None
    assert normalizar_event_key(None) is None


def test_a4_normalizar_event_key_non_iso_date_returns_none():
    from ai_classifier import normalizar_event_key
    assert normalizar_event_key('ETHFI|INTEGRACAO_COLATERAL|18/07/2026') is None


def test_a4_event_key_check_has_no_time_window():
    """Prova de aceite: a checagem de event_key não usa mais janela em Python —
    o índice do banco é UNIQUE global (F04)."""
    import inspect
    src = inspect.getsource(AIClassifier.persist_classified)
    assert 'EXACT_HASH_WINDOW_HOURS' not in src
    assert 'WHERE event_key = %s LIMIT 1' in src


def test_a4_integrity_error_logs_at_error_level(caplog):
    """Colisão do índice único de event_key vira ERROR, nunca DEBUG (A4)."""
    import logging
    classifier = AIClassifier(api_key='fake')
    entry = {
        'title': 'Fato colidindo no indice', 'titulo_pt': 'Fato colidindo no indice',
        'title_hash': 'h1', 'event_key': 'X|Y|2026-07-18', 'source': 'Decrypt',
        'severity': 'LOW', 'nivel': 3, 'impact_score': 5, 'affected_assets': [],
    }
    cursor = MagicMock()
    cursor.fetchone.return_value = None  # event_key ainda nao existe na leitura...
    cursor.execute.side_effect = [None, pymysql.err.IntegrityError(1062, 'Duplicate entry')]
    cursor.__enter__ = MagicMock(return_value=cursor)
    cursor.__exit__ = MagicMock(return_value=False)
    conn = MagicMock()
    conn.cursor.return_value = cursor

    with caplog.at_level(logging.DEBUG, logger='radar-news'):
        result = classifier.persist_classified(entry, conn)

    assert result is False
    assert any(rec.levelno == logging.ERROR and 'REJEITADA' in rec.message for rec in caplog.records)
    assert not any(rec.levelno == logging.DEBUG and 'Duplicata' in rec.message for rec in caplog.records)


# ═══════════════════════════════════════════════════════════════════════════
# Bloco C — piso determinístico de severidade (só promove, nunca rebaixa)
# ═══════════════════════════════════════════════════════════════════════════

def _merge_one(title, summary, severity_from_model, categoria=2, affected_assets=None):
    classifier = AIClassifier(api_key='fake')
    entries = [{'id': 1, 'title': title, 'summary': summary, 'source': 'Reuters'}]
    classifications = [{
        'id': 1, 'severity': severity_from_model, 'categoria': categoria,
        'affected_assets': affected_assets or [], 'acionavel': False, 'mecanismo': '',
        'event_key': None, 'titulo_pt': title, 'impacto_pt': '', 'market_bias': 'NEUTRAL',
    }]
    return classifier._merge_classifications(entries, classifications, CARTEIRA_SET)[0]


def test_p14_binance_suspende_saques_promove_critical():
    r = _merge_one('Binance suspends withdrawals amid technical issues', '', 'MEDIUM')
    assert r['severity'] == 'CRITICAL'
    assert r['piso_aplicado'] == 'CRITICAL'
    assert r['acionavel'] is True


def test_p15_microstrategy_vende_btc_promove_critical():
    r = _merge_one('MicroStrategy sells 12,000 BTC', '', 'MEDIUM')
    assert r['severity'] == 'CRITICAL'


def test_p16_microstrategy_compra_btc_nao_promove():
    """Assimetria G03 (RT-03, pendente ratificação): venda é CRÍTICA, compra não escala pelo piso."""
    r = _merge_one('MicroStrategy buys 4,000 BTC', '', 'HIGH')
    assert r['severity'] == 'HIGH'
    assert r['piso_aplicado'] is None


def test_p17_usdt_depeg_promove_critical_mesmo_fora_da_carteira():
    r = _merge_one('Tether USDT depegs to $0.94', '', 'LOW')
    assert r['severity'] == 'CRITICAL'


def test_p18_exploit_340_milhoes_promove_critical():
    r = _merge_one('Protocol X exploited for $340 million', '', 'MEDIUM')
    assert r['severity'] == 'CRITICAL'


def test_bloco_c_piso_nunca_rebaixa():
    """Se o piso não bater em nada, a severidade do modelo passa intacta."""
    r = _merge_one('Analyst says Bitcoin could reach $200k', '', 'LOW')
    assert r['severity'] == 'LOW'
    assert r['piso_aplicado'] is None


def test_bloco_c_maior_valor_usd_million_not_confused_with_mil():
    """Regressão do bug de regex encontrado na Fase 3: 'million' não pode casar
    como 'mil' (prefixo) e subestimar o valor em 1000x."""
    from eventos_graves import _maior_valor_usd
    assert _maior_valor_usd('exploit of $340 million') == 340_000_000
    assert _maior_valor_usd('hack de us$ 1.2 bilhao') == 1.2e9
    assert _maior_valor_usd('perda de $500k') == 500_000


# ═══════════════════════════════════════════════════════════════════════════
# Bloco D — Garantia de não reenvio (D1 trava de despacho, D2 idempotência de
# envio, D3 resumo sem fato repetido, D4 resumo idempotente)
# ═══════════════════════════════════════════════════════════════════════════

def test_d1_event_key_ja_enviado_e_suprimido():
    worker = RadarNewsWorker()
    row = {'id': 10, 'event_key': 'ETHFI|X|2026-07-18', 'title': 'Nova redação do mesmo fato'}
    conn = _mock_conn(fetchone_sequence=[{'id': 3}])  # event_key ja enviado no id=3

    motivo = worker._ja_foi_ao_telegram(row, conn)
    assert motivo == 'event_key ja enviado no id=3'


def test_d1_titulo_similar_ja_enviado_e_suprimido():
    worker = RadarNewsWorker()
    row = {'id': 11, 'event_key': None, 'title': 'Binance suspende saques apos falha tecnica'}
    conn = _mock_conn(
        fetchone_sequence=[],  # sem event_key, nao chega a checar
        fetchall_result=[{'id': 7, 'title': 'Binance suspende saques apos falha tecnica grave'}],
    )

    motivo = worker._ja_foi_ao_telegram(row, conn)
    assert motivo == 'titulo similar ao id=7 ja enviado'


def test_d1_fato_novo_nao_e_suprimido():
    worker = RadarNewsWorker()
    row = {'id': 12, 'event_key': 'NOVO|FATO|2026-08-05', 'title': 'Fato totalmente inedito'}
    conn = _mock_conn(fetchone_sequence=[None], fetchall_result=[])

    assert worker._ja_foi_ao_telegram(row, conn) is None


def test_d1_fail_closed_em_erro_de_verificacao():
    """Ao contrário do orçamento (_pode_disparar, fail-open), aqui o erro seguro é
    NÃO enviar — é o oposto deliberado, documentado no próprio método."""
    worker = RadarNewsWorker()
    row = {'id': 13, 'event_key': None, 'title': 'x'}
    conn = MagicMock()
    conn.cursor.side_effect = Exception('conexao caiu')

    motivo = worker._ja_foi_ao_telegram(row, conn)
    assert motivo is not None


def test_d2_reservar_despacho_sucesso_reserva_nova():
    """P0.5: sem reserva prévia (SELECT ... FOR UPDATE devolve None) -> INSERT e True."""
    worker = RadarNewsWorker()
    row = {'id': 20, 'event_key': 'X|Y|2026-08-05'}
    conn = _mock_conn(fetchone_sequence=[None])

    assert worker._reservar_despacho(row, conn) is True
    assert row['_dispatch_key']
    conn.commit.assert_called()


def test_d2_reservar_despacho_news_id_evita_colisao_por_title_hash_igual():
    """Revisão de 03/09/2026: title_hash só tem índice normal (não é UNIQUE) em
    genesis_radar_news — duas notícias DIFERENTES sem event_key podiam ter o
    mesmo title_hash (manchete idêntica reaparecendo fora da janela de dedup de
    24h do coletor) e colidir no mesmo dispatch_key, travando a segunda pra
    sempre. news_id entrando na base do hash garante chaves diferentes mesmo
    nesse cenário."""
    worker = RadarNewsWorker()
    row_a = {'id': 30, 'event_key': None, 'title_hash': 'mesmo-hash-abc'}
    row_b = {'id': 31, 'event_key': None, 'title_hash': 'mesmo-hash-abc'}

    conn_a = _mock_conn(fetchone_sequence=[None])
    assert worker._reservar_despacho(row_a, conn_a) is True

    conn_b = _mock_conn(fetchone_sequence=[None])
    assert worker._reservar_despacho(row_b, conn_b) is True

    assert row_a['_dispatch_key'] != row_b['_dispatch_key']


def test_d2_reservar_despacho_sent_bloqueia_para_sempre():
    """Estado terminal SENT nunca libera reenvio, mesmo com attempts baixo."""
    worker = RadarNewsWorker()
    row = {'id': 21, 'event_key': 'X|Y|2026-08-05'}
    conn = _mock_conn(fetchone_sequence=[
        {'id': 1, 'status': 'SENT', 'attempts': 1, 'retry_ready': 1},
    ])

    assert worker._reservar_despacho(row, conn) is False
    conn.rollback.assert_called()


def test_d2_reservar_despacho_uncertain_bloqueia_para_sempre():
    """UNCERTAIN é terminal (RT-04): pode já ter sido entregue, nunca reenvia."""
    worker = RadarNewsWorker()
    row = {'id': 22, 'event_key': 'X|Y|2026-08-05'}
    conn = _mock_conn(fetchone_sequence=[
        {'id': 2, 'status': 'UNCERTAIN', 'attempts': 1, 'retry_ready': 1},
    ])

    assert worker._reservar_despacho(row, conn) is False


def test_d2_reservar_despacho_failed_com_uma_tentativa_libera_retry():
    """FAILED com attempts < 2 e retry_ready=True: UPDATE de volta pra PENDING, True.
    Resolve a tensão que a versão anterior do método deixava documentada e sem
    resolver (INSERT único bloqueava reenvio de FAILED pra sempre)."""
    worker = RadarNewsWorker()
    row = {'id': 23, 'event_key': 'X|Y|2026-08-05'}
    conn = _mock_conn(fetchone_sequence=[
        {'id': 3, 'status': 'FAILED', 'attempts': 1, 'retry_ready': 1},
    ])

    assert worker._reservar_despacho(row, conn) is True
    assert row['_dispatch_key']


def test_d2_reservar_despacho_failed_com_duas_tentativas_nao_libera():
    """FAILED com attempts >= 2 (já usou a única retentativa permitida): bloqueia."""
    worker = RadarNewsWorker()
    row = {'id': 24, 'event_key': 'X|Y|2026-08-05'}
    conn = _mock_conn(fetchone_sequence=[
        {'id': 4, 'status': 'FAILED', 'attempts': 2, 'retry_ready': 1},
    ])

    assert worker._reservar_despacho(row, conn) is False


def test_d2_reservar_despacho_failed_fora_da_janela_de_retry_nao_libera():
    """FAILED com attempts < 2 mas retry_ready=False (next_attempt_at no futuro):
    ainda não pode tentar de novo."""
    worker = RadarNewsWorker()
    row = {'id': 25, 'event_key': 'X|Y|2026-08-05'}
    conn = _mock_conn(fetchone_sequence=[
        {'id': 5, 'status': 'FAILED', 'attempts': 1, 'retry_ready': 0},
    ])

    assert worker._reservar_despacho(row, conn) is False


def test_d2_send_message_detailed_sempre_tem_error():
    """Seção 11: os 3 desfechos de _send_message_detailed carregam 'error' (None em
    SENT, motivo em FAILED/UNCERTAIN) — sem isso o worker não tem o que gravar em
    genesis_radar_dispatch.last_error."""
    import inspect
    src = inspect.getsource(TelegramDispatcher._send_message_detailed)
    assert "'error': None" in src
    assert "'error':" in src


def test_d3_query_usa_row_number_partition_e_severity_ord():
    import inspect
    src = inspect.getsource(RadarNewsWorker._run_resumo_diario)
    assert 'ROW_NUMBER()' in src
    assert 'PARTITION BY COALESCE(n.event_key, n.title_hash)' in src
    assert 'severity_ord' in src
    assert 'CURDATE()' not in src  # nunca usa o relogio do servidor MySQL (D3)


def test_d3_limites_dia_brt_converte_para_utc():
    inicio_utc, fim_utc = RadarNewsWorker._limites_dia_brt()
    assert fim_utc - inicio_utc == timedelta(days=1)
    # meia-noite em Brasilia (UTC-3) e 03:00 UTC
    assert inicio_utc.hour == 3
    assert inicio_utc.tzinfo is None  # comparavel direto com created_at (naive, UTC)


def test_d4_reservar_resumo_do_dia_sucesso_reserva_nova():
    """P0.6: sem linha do dia ainda (SELECT ... FOR UPDATE devolve None) -> INSERT e True."""
    worker = RadarNewsWorker()
    conn = _mock_conn(fetchone_sequence=[None])
    assert worker._reservar_resumo_do_dia(datetime(2026, 8, 5).date(), conn) is True


def test_d4_reservar_resumo_sent_bloqueia_para_sempre():
    worker = RadarNewsWorker()
    conn = _mock_conn(fetchone_sequence=[
        {'id': 1, 'status': 'SENT', 'attempts': 1, 'retry_ready': 1},
    ])
    assert worker._reservar_resumo_do_dia(datetime(2026, 8, 5).date(), conn) is False


def test_d4_reservar_resumo_failed_com_uma_tentativa_libera_retry():
    """Resolve a tensão que a versão anterior deixava documentada: D4 agora tem
    coluna de status (como D2), não só a existência da linha — FAILED com
    attempts < 2 permite 1 nova tentativa."""
    worker = RadarNewsWorker()
    conn = _mock_conn(fetchone_sequence=[
        {'id': 2, 'status': 'FAILED', 'attempts': 1, 'retry_ready': 1},
    ])
    assert worker._reservar_resumo_do_dia(datetime(2026, 8, 5).date(), conn) is True


def test_d4_reservar_resumo_failed_com_duas_tentativas_nao_libera():
    worker = RadarNewsWorker()
    conn = _mock_conn(fetchone_sequence=[
        {'id': 3, 'status': 'FAILED', 'attempts': 2, 'retry_ready': 1},
    ])
    assert worker._reservar_resumo_do_dia(datetime(2026, 8, 5).date(), conn) is False


def test_d4_sem_janela_em_memoria_como_unica_garantia():
    """F09: self._last_resumo_date não pode mais ser a única trava — a tabela
    genesis_radar_resumo precisa aparecer no caminho de envio."""
    import inspect
    src = inspect.getsource(RadarNewsWorker._run_resumo_diario)
    assert '_reservar_resumo_do_dia' in src


def test_d4_run_resumo_diario_dia_vazio_marca_sent_sem_enviar(monkeypatch):
    """Dia sem notícia relevante: reserva marcada SENT com itens=0, Telegram nunca
    chamado (seção 12.3 do documento)."""
    worker = RadarNewsWorker()
    monkeypatch.setattr(worker, 'conectar_bd', lambda: _mock_conn(
        fetchone_sequence=[None], fetchall_result=[],
    ))
    monkeypatch.setattr(worker, '_reservar_resumo_do_dia', lambda hoje, conn: True)
    chamado = {'send': False}
    monkeypatch.setattr(
        worker.telegram_dispatcher, 'send_resumo_diario',
        lambda t: chamado.__setitem__('send', True) or {'status': 'SENT', 'message_id': 1, 'error': None},
    )
    atualizado = {}
    monkeypatch.setattr(
        worker, '_atualizar_estado_resumo',
        lambda hoje, resultado, itens: atualizado.update(resultado=resultado, itens=itens),
    )

    assert worker._run_resumo_diario() is True
    assert chamado['send'] is False
    assert atualizado['resultado']['status'] == 'SENT'
    assert atualizado['itens'] == 0


def test_d4_run_resumo_diario_uncertain_nao_reenvia_no_mesmo_dia(monkeypatch):
    """UNCERTAIN também conta como 'tratado' pra _maybe_send_resumo_diario não
    reprocessar no mesmo dia (RT-04: pode já ter sido entregue)."""
    worker = RadarNewsWorker()
    top10 = [{'title': 'X', 'categoria': 1, 'impact_summary': 'y'}]

    class _FakeCursor:
        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

        def execute(self, *a, **kw):
            pass

        def fetchall(self):
            return top10

    class _FakeConn:
        def cursor(self):
            return _FakeCursor()

        def close(self):
            pass

    monkeypatch.setattr(worker, 'conectar_bd', lambda: _FakeConn())
    monkeypatch.setattr(worker, '_reservar_resumo_do_dia', lambda hoje, conn: True)
    monkeypatch.setattr(worker, '_gerar_conclusao_do_dia', lambda t: 'tom neutro')
    monkeypatch.setattr(
        worker.telegram_dispatcher, 'send_resumo_diario',
        lambda t: {'status': 'UNCERTAIN', 'message_id': None, 'error': 'timeout'},
    )
    monkeypatch.setattr(worker, '_atualizar_estado_resumo', lambda hoje, resultado, itens: None)

    assert worker._run_resumo_diario() is True


def test_d4_run_resumo_diario_failed_permite_reprocessar_no_mesmo_dia(monkeypatch):
    """FAILED devolve False -> _maybe_send_resumo_diario NÃO atualiza o cache local,
    então tenta de novo no próximo tick (dentro da janela de retry do banco)."""
    worker = RadarNewsWorker()
    top10 = [{'title': 'X', 'categoria': 1, 'impact_summary': 'y'}]

    class _FakeCursor:
        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

        def execute(self, *a, **kw):
            pass

        def fetchall(self):
            return top10

    class _FakeConn:
        def cursor(self):
            return _FakeCursor()

        def close(self):
            pass

    monkeypatch.setattr(worker, 'conectar_bd', lambda: _FakeConn())
    monkeypatch.setattr(worker, '_reservar_resumo_do_dia', lambda hoje, conn: True)
    monkeypatch.setattr(worker, '_gerar_conclusao_do_dia', lambda t: 'tom neutro')
    monkeypatch.setattr(
        worker.telegram_dispatcher, 'send_resumo_diario',
        lambda t: {'status': 'FAILED', 'message_id': None, 'error': 'HTTP 403'},
    )
    monkeypatch.setattr(worker, '_atualizar_estado_resumo', lambda hoje, resultado, itens: None)

    assert worker._run_resumo_diario() is False


# ═══════════════════════════════════════════════════════════════════════════
# E2 — Fila por relevância, rebaixamento deixa de ser sentença
# ═══════════════════════════════════════════════════════════════════════════

def test_e2_fila_ordena_por_impact_score_e_respeita_janela_util():
    import inspect
    src = inspect.getsource(RadarNewsWorker._drain_telegram_queue)
    assert 'impact_score DESC' in src
    assert 'JANELA_UTIL_HORAS' in src
    assert 'adiado_ate' in src
    assert 'created_at ASC LIMIT 1' not in src  # a fila antiga (só por idade) saiu


def test_e2_pode_disparar_conta_por_telegram_sent_at():
    import inspect
    src = inspect.getsource(RadarNewsWorker._pode_disparar)
    assert 'telegram_sent_at >= NOW()' in src
    assert 'DATE(telegram_sent_at) = CURDATE()' in src
    assert 'liberando por segurança' in src or 'liberando por seguranca' in src
    # Cooldown por tema: mesma correção das duas contagens acima — não pode sobrar
    # nenhuma checagem de orçamento contando por created_at neste método.
    assert 'created_at >=' not in src


def test_e2_pode_disparar_tema_cooldown_conta_por_telegram_sent_at():
    """Revisão de 03/09/2026: o cooldown por tema (categoria + ativo principal) tinha
    ficado pra trás quando as contagens de hora/dia foram corrigidas para contar
    pelo horário do ENVIO — a query de tema continuou em created_at. Com a fila por
    relevância podendo adiar o envio em até JANELA_UTIL_HORAS, uma notícia criada
    há mais de TEMA_COOLDOWN_HOURS mas enviada há poucos minutos não seria mais
    enxergada pelo cooldown se ele contasse por created_at."""
    worker = RadarNewsWorker()
    row = {'severity': 'HIGH', 'categoria': 3, 'affected_assets': '["USDT"]'}
    conn = _mock_conn(fetchone_sequence=[{'n': 0}, {'n': 0}, {'n': 0}])

    assert worker._pode_disparar(row, conn) is True

    cursor = conn.cursor.return_value
    tema_sql = cursor.execute.call_args_list[2][0][0]
    assert 'telegram_sent_at >= NOW() - INTERVAL %s HOUR' in tema_sql
    assert 'created_at' not in tema_sql


def test_e2_pode_disparar_tema_cooldown_bloqueia_mesmo_tema_recente():
    """Mesmo cenário acima, mas com uma notícia do mesmo tema já enviada dentro da
    janela de cooldown — _pode_disparar tem que recusar (tema == 0 é falso)."""
    worker = RadarNewsWorker()
    row = {'severity': 'HIGH', 'categoria': 3, 'affected_assets': '["USDT"]'}
    conn = _mock_conn(fetchone_sequence=[{'n': 0}, {'n': 0}, {'n': 1}])

    assert worker._pode_disparar(row, conn) is False


def _drain_mock(row, monkeypatch, worker):
    """Monta um _drain_telegram_queue isolado: _ja_foi_ao_telegram libera,
    _pode_disparar recusa (orçamento), e captura os UPDATEs executados."""
    cursor = MagicMock()
    cursor.fetchone.return_value = row
    cursor.__enter__ = MagicMock(return_value=cursor)
    cursor.__exit__ = MagicMock(return_value=False)
    conn = MagicMock()
    conn.cursor.return_value = cursor
    conn.close = MagicMock()

    monkeypatch.setattr(worker, 'conectar_bd', lambda: conn)
    monkeypatch.setattr(worker, '_ja_foi_ao_telegram', lambda r, c: None)
    monkeypatch.setattr(worker, '_pode_disparar', lambda r, c: False)

    worker._drain_telegram_queue()
    return [c.args[0] for c in cursor.execute.call_args_list]


def test_e2_orcamento_estourado_dentro_da_janela_adia_em_vez_de_rebaixar(monkeypatch):
    worker = RadarNewsWorker()
    row = {
        'id': 100, 'created_at': datetime.utcnow() - timedelta(minutes=10),
        'severity': 'HIGH', 'title': 'Notícia recente', 'event_key': None,
    }
    sqls = _drain_mock(row, monkeypatch, worker)
    assert any('adiado_ate' in s and 'UPDATE' in s for s in sqls)
    assert not any('ORCAMENTO_EXPIRADO' in s for s in sqls)


def test_e2_orcamento_estourado_fora_da_janela_rebaixa_definitivo(monkeypatch):
    worker = RadarNewsWorker()
    row = {
        'id': 101, 'created_at': datetime.utcnow() - timedelta(hours=7),
        'severity': 'HIGH', 'title': 'Notícia velha', 'event_key': None,
    }
    sqls = _drain_mock(row, monkeypatch, worker)
    assert any('ORCAMENTO_EXPIRADO' in s for s in sqls)
    assert not any('adiado_ate = NOW()' in s for s in sqls)


# ═══════════════════════════════════════════════════════════════════════════
# Bloco F — Deleções obrigatórias (F06 impact_summary compat, F07 coluna category)
# ═══════════════════════════════════════════════════════════════════════════

def test_f06_merge_classifications_nao_grava_campo_compat():
    """e['impact_summary'] (espelho de impacto_pt em memória) saiu — só impacto_pt."""
    classifier = AIClassifier(api_key='fake')
    entries = [{'id': 1, 'title': 'x', 'summary': ''}]
    classifications = [{
        'id': 1, 'severity': 'LOW', 'categoria': 1, 'affected_assets': [],
        'acionavel': False, 'mecanismo': '', 'event_key': None,
        'titulo_pt': 'x', 'impacto_pt': 'texto de impacto', 'market_bias': 'NEUTRAL',
    }]
    result = classifier._merge_classifications(entries, classifications, set())[0]
    assert result['impacto_pt'] == 'texto de impacto'
    assert 'impact_summary' not in result


def test_f07_persist_nao_grava_mais_coluna_category():
    import inspect
    src = inspect.getsource(AIClassifier.persist_classified)
    # a coluna 'category' não pode mais aparecer na lista de colunas do INSERT
    assert 'category,' not in src
    assert 'category_label' not in src


def test_f07_resumo_deriva_categoria_de_categorias_nomes():
    """Sem 'category' persistido, o resumo não pode virar 'Radar News' genérico pra
    tudo — precisa derivar de CATEGORIAS_NOMES a partir de 'categoria' (número)."""
    worker = RadarNewsWorker()
    item_novo = {'categoria': 1, 'category': None, 'title': 'x'}  # linha pós-F07
    item_antigo = {'categoria': None, 'category': 'Institucional', 'title': 'y'}  # linha legada

    assert worker._categoria_nome(item_novo) == CATEGORIAS_NOMES[1]
    assert worker._categoria_nome(item_antigo) == 'Institucional'


# ═══════════════════════════════════════════════════════════════════════════
# Bloco G — Telemetria (contadores em memória, INSERT best-effort)
# ═══════════════════════════════════════════════════════════════════════════

def test_g_registrar_telemetria_nao_quebra_sem_a_tabela(monkeypatch, caplog):
    """Sem genesis_radar_telemetria (dependência externa), o ciclo não pode falhar
    — só fica sem persistir a linha, com log de resumo mesmo assim."""
    import logging
    worker = RadarNewsWorker()
    worker.rss_collector.telemetria = {'coletadas': 5, 'cortadas_hash': 1}
    worker.ai_classifier._telemetria['enviadas_ao_modelo'] = 5
    worker._telemetria_dispatch = {'disparadas': 2, 'suprimidas_orcamento': 1, 'suprimidas_duplicidade': 0}

    conn = MagicMock()
    conn.cursor.side_effect = Exception("Table 'genesis_radar_telemetria' doesn't exist")
    monkeypatch.setattr(worker, 'conectar_bd', lambda: conn)

    with caplog.at_level(logging.INFO, logger='radar-news'):
        worker._registrar_telemetria_do_ciclo()  # não deve levantar

    assert any('[Telemetria]' in rec.message for rec in caplog.records)
    # janela de despacho reseta pro próximo ciclo
    assert worker._telemetria_dispatch == {
        'disparadas': 0, 'suprimidas_orcamento': 0, 'suprimidas_duplicidade': 0,
    }


def test_g_ciclo_rss_registra_telemetria_mesmo_com_zero_entradas(monkeypatch):
    """finally garante que a telemetria fecha o ciclo mesmo no caminho de saída
    antecipada (0 entradas após dedup) — é exatamente o cenário que o Bloco G
    existe pra diagnosticar ('por que o Radar não trouxe nada hoje')."""
    worker = RadarNewsWorker()
    monkeypatch.setattr(worker.rss_collector, 'fetch_all_feeds', lambda: [])
    monkeypatch.setattr(worker, 'conectar_bd', lambda: None)

    chamadas = []
    monkeypatch.setattr(worker, '_registrar_telemetria_do_ciclo', lambda: chamadas.append(1))

    worker._run_rss_cycle()
    assert chamadas == [1]


def test_g_telemetria_conta_niveis_e_acionaveis():
    classifier = AIClassifier(api_key='fake')
    entries = [
        {'id': 1, 'title': 'Fato critico', 'summary': ''},
        {'id': 2, 'title': 'Opiniao qualquer', 'summary': ''},
    ]
    classifications = [
        {'id': 1, 'severity': 'CRITICAL', 'categoria': 2, 'affected_assets': [],
         'acionavel': True, 'mecanismo': 'x', 'event_key': None,
         'titulo_pt': 'a', 'impacto_pt': 'b', 'market_bias': 'NEUTRAL'},
        {'id': 2, 'severity': 'LOW', 'categoria': 3, 'affected_assets': [],
         'acionavel': False, 'mecanismo': '', 'event_key': None,
         'titulo_pt': 'c', 'impacto_pt': 'd', 'market_bias': 'NEUTRAL'},
    ]
    classifier._merge_classifications(entries, classifications, set())

    assert classifier._telemetria['nivel_1'] == 1
    assert classifier._telemetria['nivel_3'] == 1
    assert classifier._telemetria['acionaveis'] == 1


# ═══════════════════════════════════════════════════════════════════════════
# C7 — Escape de HTML na mensagem
# ═══════════════════════════════════════════════════════════════════════════

def test_c7_html_special_chars_escaped():
    dispatcher = TelegramDispatcher(bot_token='x', chat_id='y')
    entry = {
        'titulo_pt': 'BTC <$100k? & mais',
        'impacto_pt': 'Impacto com <tag> e & comercial',
        'severity': 'CRITICAL',
        'categoria': 2,
        'ativo_tema': 'Mercado / BTC',
        'market_bias': 'BEARISH',
        'source': 'Cointelegraph',
        'affected_assets': ['BTC'],
    }
    message = dispatcher._format_news_message(entry)

    assert '<$100k' not in message
    assert '&lt;$100k' in message
    assert '<tag>' not in message
    assert SIGNATURE in message


def test_c7_message_contains_official_fields():
    dispatcher = TelegramDispatcher(bot_token='x', chat_id='y')
    entry = {
        'titulo_pt': 'Ether.fi integra eETH como colateral na Aave',
        'impacto_pt': 'Uso do eETH como colateral tende a elevar demanda.',
        'severity': 'HIGH', 'categoria': 1, 'ativo_tema': 'ETHFI',
        'market_bias': 'BULLISH', 'source': 'The Block', 'affected_assets': ['ETHFI'],
    }
    message = dispatcher._format_news_message(entry)

    assert 'Ativo ou tema: ETHFI' in message
    assert 'Viés: BULLISH' in message
    assert f'Severidade: {SEVERITY_LABELS["HIGH"]}' in message
    assert 'Fonte: The Block' in message
    assert SEVERITY_EMOJI['HIGH'] in message
    assert 'Observação' not in message  # categoria 1 nao usa observacao


def test_c7_observacao_only_for_risk_macro_geo_categories():
    dispatcher = TelegramDispatcher(bot_token='x', chat_id='y')
    entry = {
        'titulo_pt': 'Exchange suspende saques', 'impacto_pt': 'Risco de contagio.',
        'severity': 'CRITICAL', 'categoria': 2, 'ativo_tema': 'Mercado / BTC, ETH',
        'market_bias': 'BEARISH', 'source': 'Cointelegraph', 'affected_assets': ['BTC', 'ETH'],
        'observacao': 'Fonte única. Confirmação pendente.',
    }
    message = dispatcher._format_news_message(entry)
    assert 'Observação: Fonte única. Confirmação pendente.' in message


# ═══════════════════════════════════════════════════════════════════════════
# C11 — Sem código de descoberta/scoring de tokens no worker
# ═══════════════════════════════════════════════════════════════════════════

def test_c11_no_discovery_code_in_worker():
    import os
    import worker_radar_news
    import ai_classifier
    import telegram_dispatcher

    for module in (worker_radar_news, ai_classifier, telegram_dispatcher):
        src = open(module.__file__, encoding='utf-8').read()
        assert 'discovery_score' not in src, f"{module.__name__} ainda referencia discovery_score"
        assert 'send_discovery_alert' not in src, f"{module.__name__} ainda referencia send_discovery_alert"
        assert 'DiscoveryRadar' not in src, f"{module.__name__} ainda referencia DiscoveryRadar"

    assert not os.path.exists(
        os.path.join(os.path.dirname(worker_radar_news.__file__), 'discovery_radar.py')
    )


def test_c11_no_google_translate_calls():
    import telegram_dispatcher
    src = open(telegram_dispatcher.__file__, encoding='utf-8').read()
    assert 'translate.googleapis.com' not in src


# ═══════════════════════════════════════════════════════════════════════════
# Seção 2 — Carteira Cripto.ico (fonte única de tokens)
# ═══════════════════════════════════════════════════════════════════════════

def test_load_carteira_tokens_reads_active_only():
    cursor = MagicMock()
    cursor.fetchall.return_value = [
        {'ticker': 'BTC', 'nome': 'Bitcoin', 'aliases': '["bitcoin", "btc", "xbt"]'},
        {'ticker': 'ETHFI', 'nome': 'Ether.fi', 'aliases': '["ether.fi", "etherfi", "ethfi", "eeth"]'},
    ]
    cursor.__enter__ = MagicMock(return_value=cursor)
    cursor.__exit__ = MagicMock(return_value=False)
    conn = MagicMock()
    conn.cursor.return_value = cursor

    carteira = load_carteira_tokens(conn)

    assert len(carteira) == 2
    assert carteira[0]['ticker'] == 'BTC'
    assert 'xbt' in carteira[0]['aliases']
    executed_sql = cursor.execute.call_args[0][0]
    assert 'WHERE ativo = 1' in executed_sql


def test_ticker_normalization_via_alias_map():
    classifier = AIClassifier(api_key='fake')
    carteira = [{'ticker': 'ETHFI', 'nome': 'Ether.fi', 'aliases': ['ether.fi', 'etherfi', 'ethfi', 'eeth']}]
    classifier._alias_map = {}
    for c in carteira:
        classifier._alias_map[c['ticker'].lower()] = c['ticker']
        for alias in c['aliases']:
            classifier._alias_map[alias.lower()] = c['ticker']

    for raw in ('ether.fi', 'ETHERFI', 'Ethfi', 'eeth'):
        assert classifier._normalizar_ticker(raw) == 'ETHFI'


# ═══════════════════════════════════════════════════════════════════════════
# Correção P0 (CORRECAO_RADAR_NEWS_TELEGRAM.md, 20/08/2026) — spec
# radar-news-correcao-telegram. P0.4 validação de schema/env/Telegram no
# startup, P0.5/P0.6 já cobertos acima (D2/D4), P1.1 persistência de
# title_original/piso_aplicado, P1.2 ordem do loop, seção 17.1 congelamento.
# ═══════════════════════════════════════════════════════════════════════════

def test_p04_genesis_ai_token_entra_no_required_vars():
    import inspect
    src = inspect.getsource(RadarNewsWorker._validate_env)
    assert 'GENESIS_AI_TOKEN' in src


def test_p04_validate_env_aborta_sem_genesis_ai_token(monkeypatch):
    import worker_radar_news as wrn
    monkeypatch.setattr(wrn, 'GENESIS_AI_TOKEN', '')
    monkeypatch.setattr(wrn, 'TELEGRAM_BOT_TOKEN', 'x')
    monkeypatch.setattr(wrn, 'TELEGRAM_CHAT_ID', 'y')
    monkeypatch.setattr(wrn, 'GENESIS_AI_URL', 'https://x')
    monkeypatch.setattr(wrn, 'MYSQL_HOST', 'h')
    monkeypatch.setattr(wrn, 'MYSQL_USER', 'u')
    monkeypatch.setattr(wrn, 'MYSQL_DATABASE', 'd')

    worker = wrn.RadarNewsWorker()
    with pytest.raises(SystemExit):
        worker._validate_env()


def test_p04_validate_schema_raises_on_missing_table():
    worker = RadarNewsWorker()
    cursor = MagicMock()
    cursor.fetchall.side_effect = [
        [{'Tables_in_db': 'genesis_radar_news'}],  # faltam as 3 tabelas novas
    ]
    cursor.__enter__ = MagicMock(return_value=cursor)
    cursor.__exit__ = MagicMock(return_value=False)
    conn = MagicMock()
    conn.cursor.return_value = cursor

    with pytest.raises(RuntimeError, match='Tabelas ausentes'):
        worker._validate_schema(conn)


def test_p04_validate_schema_raises_on_missing_column():
    worker = RadarNewsWorker()
    cursor = MagicMock()
    cursor.fetchall.side_effect = [
        [{'x': t} for t in (
            'genesis_radar_news', 'genesis_radar_dispatch', 'genesis_radar_resumo',
            'genesis_radar_telemetria', 'genesis_carteira_tokens',
        )],
        [{'Field': 'title'}, {'Field': 'nivel'}],  # faltam adiado_ate/piso_aplicado/etc.
    ]
    cursor.__enter__ = MagicMock(return_value=cursor)
    cursor.__exit__ = MagicMock(return_value=False)
    conn = MagicMock()
    conn.cursor.return_value = cursor

    with pytest.raises(RuntimeError, match='Colunas ausentes'):
        worker._validate_schema(conn)


def test_p04_validate_schema_passes_when_complete():
    worker = RadarNewsWorker()
    cursor = MagicMock()
    cursor.fetchall.side_effect = [
        [{'x': t} for t in (
            'genesis_radar_news', 'genesis_radar_dispatch', 'genesis_radar_resumo',
            'genesis_radar_telemetria', 'genesis_carteira_tokens',
        )],
        [{'Field': c} for c in (
            'title_original', 'supressao', 'adiado_ate', 'piso_aplicado',
            'telegram_sent', 'telegram_sent_at', 'nivel', 'impact_score',
        )],
    ]
    cursor.__enter__ = MagicMock(return_value=cursor)
    cursor.__exit__ = MagicMock(return_value=False)
    conn = MagicMock()
    conn.cursor.return_value = cursor

    worker._validate_schema(conn)  # não deve levantar


def test_p04_telegram_validate_connection_getme_getchat_sem_enviar(monkeypatch):
    dispatcher = TelegramDispatcher(bot_token='tok', chat_id='123')
    calls = []

    class _Resp:
        def __init__(self, status_code, payload):
            self.status_code = status_code
            self._payload = payload

        def json(self):
            return self._payload

    def fake_get(url, timeout=None):
        calls.append(('GET', url))
        return _Resp(200, {'ok': True})

    def fake_post(url, json=None, timeout=None):
        calls.append(('POST', url))
        return _Resp(200, {'ok': True})

    import telegram_dispatcher as td
    monkeypatch.setattr(td.requests, 'get', fake_get)
    monkeypatch.setattr(td.requests, 'post', fake_post)

    ok, err = dispatcher.validate_connection()

    assert ok is True
    assert err is None
    assert any('getMe' in u for _, u in calls)
    assert any('getChat' in u for _, u in calls)
    assert not any('sendMessage' in u for _, u in calls)  # nunca dispara notícia


def test_p04_telegram_validate_connection_falha_sem_bot_token():
    """bot_token vazio no construtor cai no fallback os.getenv('TELEGRAM_BOT_TOKEN')
    (mesmo padrão do documento) — setar o atributo direto depois evita depender do
    .env real da máquina e evita qualquer chamada de rede de verdade."""
    dispatcher = TelegramDispatcher(bot_token='placeholder', chat_id='123')
    dispatcher.bot_token = ''
    ok, err = dispatcher.validate_connection()
    assert ok is False
    assert 'TELEGRAM_BOT_TOKEN' in err


def test_p04_telegram_validate_connection_falha_sem_chat_id():
    dispatcher = TelegramDispatcher(bot_token='placeholder', chat_id='placeholder')
    dispatcher.chat_id = ''
    ok, err = dispatcher.validate_connection()
    assert ok is False
    assert 'TELEGRAM_CHAT_ID' in err


def test_p05_fila_usa_left_join_com_dispatch_para_nao_travar():
    import inspect
    src = inspect.getsource(RadarNewsWorker._drain_telegram_queue)
    assert 'LEFT JOIN genesis_radar_dispatch' in src
    assert "d.status = 'FAILED'" in src
    assert 'd.attempts < 2' in src


def test_p05_reconcile_stale_dispatches_marca_uncertain():
    worker = RadarNewsWorker()
    cursor = MagicMock()
    cursor.__enter__ = MagicMock(return_value=cursor)
    cursor.__exit__ = MagicMock(return_value=False)
    conn = MagicMock()
    conn.cursor.return_value = cursor

    worker._reconcile_stale_dispatches(conn)

    sql = cursor.execute.call_args[0][0]
    assert "SET status = 'UNCERTAIN'" in sql
    assert "WHERE status = 'PENDING'" in sql
    conn.commit.assert_called()


def test_p06_atualizar_estado_resumo_sent_grava_itens_e_message_id(monkeypatch):
    worker = RadarNewsWorker()
    cursor = MagicMock()
    cursor.__enter__ = MagicMock(return_value=cursor)
    cursor.__exit__ = MagicMock(return_value=False)
    conn = MagicMock()
    conn.cursor.return_value = cursor
    monkeypatch.setattr(worker, 'conectar_bd', lambda: conn)

    worker._atualizar_estado_resumo(
        datetime(2026, 8, 5).date(),
        {'status': 'SENT', 'message_id': 42, 'error': None},
        7,
    )

    sql, params = cursor.execute.call_args[0]
    assert "SET status = 'SENT'" in sql
    assert 7 in params
    assert 42 in params
    conn.commit.assert_called()
    conn.close.assert_called()


def _insert_params_by_column(sql: str, params: tuple) -> dict:
    """Mapeia os valores posicionais de um INSERT para o nome de cada coluna, lendo
    a lista de colunas direto do próprio SQL capturado.

    Evita reacoplar os testes a um índice fixo (params[-2], params[-1], ...) que
    quebra toda vez que uma coluna nova entra no INSERT — foi exatamente isso que
    quebrou estes dois testes quando persist_classified passou a gravar
    created_at/updated_at explicitamente (correção real de um bug: essas colunas
    não têm DEFAULT no schema e ficavam sempre NULL sem esse preenchimento)."""
    columns_part = sql.split('(', 1)[1].split(')', 1)[0]
    columns = [c.strip() for c in columns_part.replace('\n', ' ').split(',')]
    assert len(columns) == len(params), f"{len(columns)} colunas vs {len(params)} params"
    return dict(zip(columns, params))


def test_p11_persist_classified_grava_title_original_e_piso_aplicado():
    """P1.1: title_original (texto cru do RSS) e piso_aplicado entram no INSERT —
    antes desta correção, as duas colunas existiam no schema mas nunca eram
    preenchidas por persist_classified."""
    classifier = AIClassifier(api_key='fake')
    entry = {
        'title': 'Original RSS headline',
        'titulo_pt': 'Manchete traduzida',
        'title_hash': 'abc123',
        'event_key': None,
        'source': 'RSS Feed',
        'severity': 'HIGH',
        'categoria': 3,
        'affected_assets': ['BTC'],
        'market_bias': 'BEARISH',
        'impacto_pt': 'Impacto relevante',
        'nivel': 1,
        'impact_score': 80,
        'piso_aplicado': 'HIGH',
    }
    cursor = MagicMock()
    cursor.__enter__ = MagicMock(return_value=cursor)
    cursor.__exit__ = MagicMock(return_value=False)
    conn = MagicMock()
    conn.cursor.return_value = cursor

    assert classifier.persist_classified(entry, conn) is True

    sql, params = cursor.execute.call_args[0]
    assert 'title_original' in sql
    assert 'piso_aplicado' in sql
    cols = _insert_params_by_column(sql, params)
    assert cols['title_original'] == 'Original RSS headline'  # texto cru, não titulo_pt
    assert cols['piso_aplicado'] == 'HIGH'
    assert cols['telegram_sent'] == 0
    # created_at/updated_at (P1.1): gravados explicitamente porque a coluna não
    # tem DEFAULT no schema — sem isso a linha nasce com created_at NULL e some
    # de qualquer filtro por data (fila do Telegram, similaridade, resumo diário).
    assert isinstance(cols['created_at'], datetime)
    assert isinstance(cols['updated_at'], datetime)


def test_p11_persist_classified_title_original_none_quando_sem_titulo_rss():
    classifier = AIClassifier(api_key='fake')
    entry = {
        'titulo_pt': 'Só título traduzido, sem o bruto do RSS',
        'title_hash': 'def456',
        'event_key': None,
        'severity': 'LOW',
        'categoria': 1,
        'nivel': 3,
        'impact_score': 10,
    }
    cursor = MagicMock()
    cursor.__enter__ = MagicMock(return_value=cursor)
    cursor.__exit__ = MagicMock(return_value=False)
    conn = MagicMock()
    conn.cursor.return_value = cursor

    classifier.persist_classified(entry, conn)

    sql, params = cursor.execute.call_args[0]
    cols = _insert_params_by_column(sql, params)
    assert cols['title_original'] is None  # sem entry['title'], title_original fica None
    assert cols['piso_aplicado'] is None  # sem piso aplicado, fica None


# ═══════════════════════════════════════════════════════════════════════════
# Revisão 03/09/2026 — _call_gemini não pode forçar JSON para chamadas de texto
# livre (_gerar_conclusao_do_dia pedia uma frase solta, mas herdava
# responseMimeType='application/json' de _call_gemini sem precisar)
# ═══════════════════════════════════════════════════════════════════════════

class _FakeGeminiResponse:
    def __init__(self, text: str, status_code: int = 200):
        self.status_code = status_code
        self._text = text
        self.text = text

    def json(self):
        return {'candidates': [{'content': {'parts': [{'text': self._text}]}}]}


def test_call_gemini_response_json_true_inclui_response_mime_type():
    """Default (usado por classify()): generationConfig força responseMimeType, já
    que a classificação sempre espera um array JSON estrito de volta."""
    classifier = AIClassifier(api_key='fake')
    captured = {}

    def fake_post(url, json=None, headers=None, timeout=None):
        captured['payload'] = json
        return _FakeGeminiResponse('[]')

    with patch('ai_classifier.requests.post', side_effect=fake_post):
        texto = classifier._call_gemini('prompt qualquer')

    assert texto == '[]'
    assert captured['payload']['generationConfig']['responseMimeType'] == 'application/json'


def test_call_gemini_response_json_false_omite_response_mime_type():
    """response_json=False (usado por _gerar_conclusao_do_dia): sem
    responseMimeType — sem isso o modelo tende a devolver texto livre embrulhado
    numa string/objeto JSON em vez da frase plana pedida no prompt."""
    classifier = AIClassifier(api_key='fake')
    captured = {}

    def fake_post(url, json=None, headers=None, timeout=None):
        captured['payload'] = json
        return _FakeGeminiResponse('Tom neutro hoje.')

    with patch('ai_classifier.requests.post', side_effect=fake_post):
        texto = classifier._call_gemini('prompt qualquer', response_json=False)

    assert texto == 'Tom neutro hoje.'
    assert 'responseMimeType' not in captured['payload']['generationConfig']


def test_gerar_conclusao_do_dia_chama_call_gemini_com_response_json_false():
    import inspect
    src = inspect.getsource(RadarNewsWorker._gerar_conclusao_do_dia)
    assert 'response_json=False' in src


def test_gerar_conclusao_do_dia_texto_plano_passa_direto(monkeypatch):
    worker = RadarNewsWorker()
    monkeypatch.setattr(
        worker.ai_classifier, '_call_gemini',
        lambda p, response_json=True: 'Aumento de aversão a risco.',
    )
    top10 = [{'title': 'X', 'categoria': 1, 'impact_summary': 'y'}]
    assert worker._gerar_conclusao_do_dia(top10) == 'Aumento de aversão a risco.'


def test_gerar_conclusao_do_dia_remove_aspas_sobrando(monkeypatch):
    """Sanitização defensiva: se o modelo ainda devolver a frase entre aspas (hábito
    de JSON-string ou resposta mal formatada), as aspas das pontas são removidas."""
    worker = RadarNewsWorker()
    monkeypatch.setattr(
        worker.ai_classifier, '_call_gemini',
        lambda p, response_json=True: '"Fluxo institucional positivo."',
    )
    top10 = [{'title': 'X', 'categoria': 1, 'impact_summary': 'y'}]
    assert worker._gerar_conclusao_do_dia(top10) == 'Fluxo institucional positivo.'


def test_p12_loop_drena_fila_antes_do_ciclo_rss():
    """P1.2 — correção mínima: drenar a fila e checar o resumo antes de checar se é
    hora do próximo ciclo RSS, não depois. Não resolve o caso de um ciclo RSS já em
    execução (única thread) — isso fica fora do escopo P0 (seção 13 do documento)."""
    import inspect
    src = inspect.getsource(RadarNewsWorker.rodar)
    # 'self.' no índice evita casar com a menção ao método dentro do comentário
    # explicativo acima da chamada real.
    idx_drain = src.index('self._drain_telegram_queue()')
    idx_rss = src.index('self._run_rss_cycle()')
    assert idx_drain < idx_rss


def test_filtros_operacionais_permanecem_congelados():
    """Seção 17.1 do documento, código literal — trava contra regressão futura de
    qualquer valor/limiar que este plano de correção NÃO deveria mudar."""
    import inspect
    import rss_collector
    import worker_radar_news

    recent_signature = inspect.signature(rss_collector.RSSCollector._is_recent)
    assert recent_signature.parameters['minutes'].default == 30
    assert rss_collector.SIMILARITY_WINDOW_HOURS == 72
    assert rss_collector.SIMILARITY_THRESHOLD == 85
    assert worker_radar_news.DISPATCH_DEDUP_HOURS == 72
    assert worker_radar_news.DISPATCH_SIMILARITY_THRESHOLD == 88
    assert worker_radar_news.NIVEL1_HOURLY_CAP == 3
    assert worker_radar_news.NIVEL1_DAILY_CAP == 10
    assert worker_radar_news.TEMA_COOLDOWN_HOURS == 2
    assert worker_radar_news.JANELA_UTIL_HORAS == 6
    assert worker_radar_news.ADIAMENTO_MINUTOS == 45
