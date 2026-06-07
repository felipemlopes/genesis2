"""
Preservation Property Tests - Property 2: Gravação no banco e deduplicação inalteradas.

These tests verify that the UNFIXED code correctly:
1. Passes all 10 alerta fields to gravar_banco
2. Deduplicates alerts within intervalo_duplicatas
3. Logs alert info for non-duplicate alerts

These tests MUST PASS on both unfixed and fixed code (preservation guarantee).
"""
import time
from unittest.mock import patch, MagicMock, call

import pytest
from hypothesis import given, settings, HealthCheck, assume
from hypothesis import strategies as st

from monitor_worker import MonitorWorker, TIMEFRAME, INTERVALO_DUPLICATAS


# --- Strategies ---

ALERT_TYPES = [
    'SPIKE_VOLUME',
    'MOVIMENTO_BRUSCO',
    'CVD_DIVERGENCIA',
    'FUNDING_EXTREMO',
    'OI_SPIKE',
    'BOOK_IMBALANCE',
    'LIQUIDATION_CASCADE',
    'SPOT_FUTURES_DIVERGENCIA',
]

ATIVOS = [
    'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT',
    'DOGEUSDT', 'ADAUSDT', 'AVAXUSDT', 'LINKUSDT', 'DOTUSDT',
]

CORRETORAS = ['binance', 'bybit', 'okx', 'bitget']
DIRECOES = ['BULLISH', 'BEARISH', 'NEUTRAL']
URGENCIAS = ['ALTA', 'MEDIA', 'BAIXA']

tipo_st = st.sampled_from(ALERT_TYPES)
ativo_st = st.sampled_from(ATIVOS)
corretora_st = st.sampled_from(CORRETORAS)
direcao_st = st.sampled_from(DIRECOES)
urgencia_st = st.sampled_from(URGENCIAS)
preco_st = st.floats(min_value=0.01, max_value=100000.0, allow_nan=False, allow_infinity=False)
variacao_st = st.floats(min_value=-50.0, max_value=50.0, allow_nan=False, allow_infinity=False)
score_st = st.integers(min_value=0, max_value=100)
mensagem_st = st.text(min_size=1, max_size=100, alphabet=st.characters(whitelist_categories=('L', 'N', 'P', 'Z')))


# --- Helper ---

def create_worker_with_mocks():
    """Create a MonitorWorker with enviar_telegram and gravar_banco mocked."""
    worker = MonitorWorker()
    worker.enviar_telegram = MagicMock(return_value=True)
    worker.gravar_banco = MagicMock()
    worker.ultimos_alertas = {}
    return worker


# --- Property-Based Test: gravar_banco receives correct alerta dict with all 10 fields ---

@given(
    tipo=tipo_st,
    ativo=ativo_st,
    corretora=corretora_st,
    direcao=direcao_st,
    urgencia=urgencia_st,
    preco=preco_st,
    variacao=variacao_st,
    score=score_st,
    mensagem=mensagem_st,
)
@settings(
    max_examples=100,
    suppress_health_check=[HealthCheck.function_scoped_fixture],
)
def test_preservation_gravar_banco_receives_all_fields(
    tipo, ativo, corretora, direcao, urgencia, preco, variacao, score, mensagem
):
    """
    Property 2 - Preservation: For all valid alert inputs, gravar_banco receives
    a correct alerta dict with all 10 fields (ativo, tipo, mensagem, direcao,
    urgencia, corretora, timeframe, preco_atual, variacao_pct, score).
    """
    worker = create_worker_with_mocks()

    worker.processar_alerta(
        ativo=ativo,
        tipo=tipo,
        mensagem=mensagem,
        direcao=direcao,
        urgencia=urgencia,
        corretora=corretora,
        preco_atual=preco,
        variacao_pct=variacao,
        score=score,
    )

    # gravar_banco must be called exactly once for a non-duplicate alert
    worker.gravar_banco.assert_called_once()

    call_args = worker.gravar_banco.call_args[0]
    alerta_dict = call_args[0]

    # Verify all 12 fields are present and correct
    assert alerta_dict['ativo'] == ativo
    assert alerta_dict['tipo'] == tipo
    assert alerta_dict['mensagem'] == mensagem
    assert alerta_dict['direcao'] == direcao
    assert alerta_dict['urgencia'] == urgencia
    assert alerta_dict['corretora'] == corretora
    assert alerta_dict['timeframe'] == TIMEFRAME
    assert alerta_dict['preco_atual'] == preco
    assert alerta_dict['variacao_pct'] == variacao
    assert alerta_dict['score'] == score
    assert 'motivos' in alerta_dict
    assert 'timeframes' in alerta_dict

    # Verify exactly 12 keys in the dict (original 10 + motivos + timeframes)
    assert len(alerta_dict) == 12, (
        f"Expected 12 fields in alerta dict, got {len(alerta_dict)}: {list(alerta_dict.keys())}"
    )


# --- Property-Based Test: Deduplication within intervalo_duplicatas ---

@given(
    tipo=tipo_st,
    ativo=ativo_st,
    corretora=corretora_st,
    direcao=direcao_st,
    urgencia=urgencia_st,
    preco=preco_st,
    variacao=variacao_st,
    score=score_st,
)
@settings(
    max_examples=50,
    suppress_health_check=[HealthCheck.function_scoped_fixture],
)
def test_preservation_deduplication_ignores_duplicate(
    tipo, ativo, corretora, direcao, urgencia, preco, variacao, score
):
    """
    Property 2 - Preservation: For duplicate alerts within intervalo_duplicatas,
    gravar_banco is NOT called on the second invocation.
    """
    worker = create_worker_with_mocks()

    # First call — should go through
    worker.processar_alerta(
        ativo=ativo,
        tipo=tipo,
        mensagem="First alert",
        direcao=direcao,
        urgencia=urgencia,
        corretora=corretora,
        preco_atual=preco,
        variacao_pct=variacao,
        score=score,
    )
    assert worker.gravar_banco.call_count == 1

    # Second call with same ativo+tipo+corretora — should be deduplicated
    worker.gravar_banco.reset_mock()
    worker.processar_alerta(
        ativo=ativo,
        tipo=tipo,
        mensagem="Duplicate alert",
        direcao=direcao,
        urgencia=urgencia,
        corretora=corretora,
        preco_atual=preco,
        variacao_pct=variacao,
        score=score,
    )
    worker.gravar_banco.assert_not_called(), (
        f"Deduplication failed: gravar_banco called for duplicate "
        f"ativo={ativo}, tipo={tipo}, corretora={corretora}"
    )


# --- Test: logger.info is called with alert type and ativo ---

@given(
    tipo=tipo_st,
    ativo=ativo_st,
    corretora=corretora_st,
    direcao=direcao_st,
    urgencia=urgencia_st,
    preco=preco_st,
    variacao=variacao_st,
    score=score_st,
)
@settings(
    max_examples=50,
    suppress_health_check=[HealthCheck.function_scoped_fixture],
)
def test_preservation_logger_info_called(
    tipo, ativo, corretora, direcao, urgencia, preco, variacao, score
):
    """
    Property 2 - Preservation: For non-duplicate alerts, logger.info is called
    with the alert type and ativo.
    """
    worker = create_worker_with_mocks()

    with patch('monitor_worker.logger') as mock_logger:
        worker.processar_alerta(
            ativo=ativo,
            tipo=tipo,
            mensagem="Test alert",
            direcao=direcao,
            urgencia=urgencia,
            corretora=corretora,
            preco_atual=preco,
            variacao_pct=variacao,
            score=score,
        )

        # logger.info must have been called at least once
        assert mock_logger.info.called, (
            f"logger.info was not called for tipo={tipo}, ativo={ativo}"
        )

        # At least one call must contain the tipo and ativo
        log_messages = [str(c) for c in mock_logger.info.call_args_list]
        combined = ' '.join(log_messages)
        assert tipo in combined, (
            f"logger.info calls do not mention tipo={tipo}. Calls: {log_messages}"
        )
        assert ativo in combined, (
            f"logger.info calls do not mention ativo={ativo}. Calls: {log_messages}"
        )


# --- Concrete Observation Tests ---

def test_observation_gravar_banco_fields_concrete():
    """
    Observation: processar_alerta('BTCUSDT', 'SPIKE_VOLUME', 'msg', 'BULLISH', 'ALTA', 'binance', 50000.0, 5.0)
    calls gravar_banco with all fields correctly.
    """
    worker = create_worker_with_mocks()

    worker.processar_alerta(
        ativo='BTCUSDT',
        tipo='SPIKE_VOLUME',
        mensagem='msg',
        direcao='BULLISH',
        urgencia='ALTA',
        corretora='binance',
        preco_atual=50000.0,
        variacao_pct=5.0,
    )

    worker.gravar_banco.assert_called_once()
    alerta = worker.gravar_banco.call_args[0][0]

    assert alerta['ativo'] == 'BTCUSDT'
    assert alerta['tipo'] == 'SPIKE_VOLUME'
    assert alerta['mensagem'] == 'msg'
    assert alerta['direcao'] == 'BULLISH'
    assert alerta['urgencia'] == 'ALTA'
    assert alerta['corretora'] == 'binance'
    assert alerta['timeframe'] == TIMEFRAME
    assert alerta['preco_atual'] == 50000.0
    assert alerta['variacao_pct'] == 5.0
    assert alerta['score'] == 0  # default value


def test_observation_deduplication_concrete():
    """
    Observation: duplicate alert within intervalo_duplicatas is ignored (no gravar_banco call).
    """
    worker = create_worker_with_mocks()

    # First call
    worker.processar_alerta(
        ativo='BTCUSDT',
        tipo='SPIKE_VOLUME',
        mensagem='first',
        direcao='BULLISH',
        urgencia='ALTA',
        corretora='binance',
        preco_atual=50000.0,
        variacao_pct=5.0,
    )
    assert worker.gravar_banco.call_count == 1

    # Immediate duplicate — should be ignored
    worker.gravar_banco.reset_mock()
    worker.processar_alerta(
        ativo='BTCUSDT',
        tipo='SPIKE_VOLUME',
        mensagem='duplicate',
        direcao='BULLISH',
        urgencia='ALTA',
        corretora='binance',
        preco_atual=51000.0,
        variacao_pct=6.0,
    )
    worker.gravar_banco.assert_not_called()


def test_observation_logger_info_concrete():
    """
    Observation: logger.info is called with alert details for non-duplicate alerts.
    """
    worker = create_worker_with_mocks()

    with patch('monitor_worker.logger') as mock_logger:
        worker.processar_alerta(
            ativo='BTCUSDT',
            tipo='SPIKE_VOLUME',
            mensagem='msg',
            direcao='BULLISH',
            urgencia='ALTA',
            corretora='binance',
            preco_atual=50000.0,
            variacao_pct=5.0,
        )

        assert mock_logger.info.called
        log_messages = ' '.join(str(c) for c in mock_logger.info.call_args_list)
        assert 'SPIKE_VOLUME' in log_messages
        assert 'BTCUSDT' in log_messages
