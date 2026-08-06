"""
Radar News V1.0 — Testes de comportamento (substituem os testes obsoletos que
travavam o comportamento ANTERIOR à especificação: janela de 3h, dedup por
título+fonte, fail-open, discovery_radar acoplado). Cobrem C1-C9 e a seção 2
(carteira Cripto.ico).
"""

import time as _time
from datetime import datetime, timedelta
from unittest.mock import MagicMock

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


def test_d2_reservar_despacho_sucesso():
    worker = RadarNewsWorker()
    row = {'id': 20, 'event_key': 'X|Y|2026-08-05'}
    conn = _mock_conn()

    assert worker._reservar_despacho(row, conn) is True
    assert '_dispatch_key' in row


def test_d2_reservar_despacho_ja_existe_bloqueia():
    worker = RadarNewsWorker()
    row = {'id': 21, 'event_key': 'X|Y|2026-08-05'}
    conn = _mock_conn()
    conn.cursor().execute.side_effect = pymysql.err.IntegrityError(1062, 'Duplicate entry')

    assert worker._reservar_despacho(row, conn) is False


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


def test_d4_reservar_resumo_do_dia_sucesso():
    worker = RadarNewsWorker()
    conn = _mock_conn()
    assert worker._reservar_resumo_do_dia(datetime(2026, 8, 5).date(), conn) is True


def test_d4_reservar_resumo_ja_enviado_bloqueia():
    worker = RadarNewsWorker()
    conn = _mock_conn()
    conn.cursor().execute.side_effect = pymysql.err.IntegrityError(1062, 'Duplicate entry')
    assert worker._reservar_resumo_do_dia(datetime(2026, 8, 5).date(), conn) is False


def test_d4_sem_janela_em_memoria_como_unica_garantia():
    """F09: self._last_resumo_date não pode mais ser a única trava — a tabela
    genesis_radar_resumo precisa aparecer no caminho de envio."""
    import inspect
    src = inspect.getsource(RadarNewsWorker._run_resumo_diario)
    assert '_reservar_resumo_do_dia' in src


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
