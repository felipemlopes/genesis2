"""
Radar News V1.0 — Testes de comportamento (substituem os testes obsoletos que
travavam o comportamento ANTERIOR à especificação: janela de 3h, dedup por
título+fonte, fail-open, discovery_radar acoplado). Cobrem C1-C9 e a seção 2
(carteira Cripto.ico).
"""

import time as _time
from datetime import datetime, timedelta
from unittest.mock import MagicMock

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
# C2 — Identidade por fato (event_key, hash exato, similaridade)
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
    conn.cursor().execute.assert_called_once()  # nao chega a checar hash/similaridade nem inserir


def test_c2_exact_title_hash_duplicate_blocked():
    classifier = AIClassifier(api_key='fake')
    entry = {
        'title': 'Noticia X', 'titulo_pt': 'Noticia X', 'title_hash': 'samehash',
        'event_key': None, 'source': 'Reuters', 'severity': 'MEDIUM',
        'nivel': 3, 'impact_score': 20, 'affected_assets': [],
    }
    # sem event_key -> so 1 fetchone (hash exato), que acha duplicata
    conn = _mock_conn(fetchone_sequence=[{'id': 5}])

    result = classifier.persist_classified(entry, conn)
    assert result is False


def test_c2_similar_title_72h_blocked():
    classifier = AIClassifier(api_key='fake')
    entry = {
        'title': 'Exchange XYZ suspende saques apos exploit de US$ 340 milhoes',
        'titulo_pt': 'Exchange XYZ suspende saques apos exploit de US$ 340 milhoes',
        'title_hash': 'newhash', 'event_key': None, 'source': 'Cointelegraph',
        'severity': 'CRITICAL', 'nivel': 1, 'impact_score': 100, 'affected_assets': ['BTC'],
    }
    # sem event_key, hash nao bate (None), mas titulo parafraseado bate por similaridade
    conn = _mock_conn(
        fetchone_sequence=[None],
        fetchall_result=[{'title': 'Exchange XYZ suspende saques apos exploit de US$ 340 milhões hoje'}],
    )

    result = classifier.persist_classified(entry, conn)
    assert result is False


def test_c2_new_fact_is_inserted():
    classifier = AIClassifier(api_key='fake')
    entry = {
        'title': 'Fato totalmente novo e unico', 'titulo_pt': 'Fato totalmente novo e unico',
        'title_hash': 'uniquehash', 'event_key': 'X|Y|2026-07-18', 'source': 'Decrypt',
        'severity': 'LOW', 'nivel': 3, 'impact_score': 5, 'affected_assets': [],
        'categoria': 3, 'market_bias': 'NEUTRAL',
    }
    conn = _mock_conn(fetchone_sequence=[None, None], fetchall_result=[])

    result = classifier.persist_classified(entry, conn)
    assert result is True
    conn.commit.assert_called_once()


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
