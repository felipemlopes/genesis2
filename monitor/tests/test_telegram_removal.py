"""
Bug Condition Exploration Test - Property 1: Envio de Telegram ocorre para todo alerta processado.

This test encodes the EXPECTED behavior (no Telegram calls, gravar_banco with False).
On UNFIXED code, this test MUST FAIL — failure confirms the bug exists.
After the fix is applied, this test should PASS.

Scoped PBT Approach: Tests all 8 alert types with random ativo/corretora combinations.
"""
import time
from unittest.mock import patch, MagicMock

import pytest
from hypothesis import given, settings, HealthCheck
from hypothesis import strategies as st

from monitor_worker import MonitorWorker


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


# --- Helper ---

def create_worker_with_mocks():
    """Create a MonitorWorker instance with enviar_telegram and gravar_banco mocked."""
    worker = MonitorWorker()
    worker.enviar_telegram = MagicMock(return_value=True)
    worker.gravar_banco = MagicMock()
    # Clear deduplication cache so each test call goes through
    worker.ultimos_alertas = {}
    return worker


# --- Property-Based Test: Bug Condition Exploration ---

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
def test_bug_condition_no_telegram_called(tipo, ativo, corretora, direcao, urgencia, preco, variacao, score):
    """
    Property 1: For any alert processed by the monitor, enviar_telegram should NOT be called.

    On UNFIXED code, this test FAILS because enviar_telegram IS called unconditionally.
    This failure confirms the bug exists.
    """
    worker = create_worker_with_mocks()

    worker.processar_alerta(
        ativo=ativo,
        tipo=tipo,
        mensagem=f"Test alert {tipo} for {ativo}",
        direcao=direcao,
        urgencia=urgencia,
        corretora=corretora,
        preco_atual=preco,
        variacao_pct=variacao,
        score=score,
    )

    # Expected behavior: enviar_telegram should NOT be called
    worker.enviar_telegram.assert_not_called(), (
        f"Bug confirmed: enviar_telegram was called for alert "
        f"tipo={tipo}, ativo={ativo}, corretora={corretora}"
    )

    # Expected behavior: gravar_banco should be called with enviado_telegram=False
    worker.gravar_banco.assert_called_once()
    call_args = worker.gravar_banco.call_args
    alerta_arg = call_args[0][0]
    enviado_telegram_arg = call_args[0][1]

    assert enviado_telegram_arg is False, (
        f"Bug confirmed: gravar_banco called with enviado_telegram={enviado_telegram_arg} "
        f"(expected False) for tipo={tipo}, ativo={ativo}"
    )


# --- Concrete Test Cases for Each Alert Type ---

@pytest.mark.parametrize("tipo", ALERT_TYPES)
def test_bug_condition_concrete_per_type(tipo):
    """
    Concrete test: For each specific alert type, verify enviar_telegram is NOT called.

    On UNFIXED code, ALL of these fail — confirming the bug exists for every alert type.
    """
    worker = create_worker_with_mocks()

    worker.processar_alerta(
        ativo='BTCUSDT',
        tipo=tipo,
        mensagem=f"Concrete test for {tipo}",
        direcao='BULLISH',
        urgencia='ALTA',
        corretora='binance',
        preco_atual=50000.0,
        variacao_pct=5.0,
        score=75,
    )

    # Expected behavior: enviar_telegram should NOT be called
    assert not worker.enviar_telegram.called, (
        f"Bug confirmed: processar_alerta('{tipo}', 'BTCUSDT', ...) calls enviar_telegram"
    )

    # Expected behavior: gravar_banco should be called with enviado_telegram=False
    assert worker.gravar_banco.called, (
        f"gravar_banco was not called for tipo={tipo}"
    )
    call_args = worker.gravar_banco.call_args
    enviado_telegram_arg = call_args[0][1]
    assert enviado_telegram_arg is False, (
        f"Bug confirmed: gravar_banco called with enviado_telegram={enviado_telegram_arg} "
        f"(expected False) for tipo={tipo}"
    )
