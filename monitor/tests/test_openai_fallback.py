"""
Reserva OpenAI do Radar News (01/10/2026): se o Gemini falhar — erro HTTP, timeout,
200 sem texto ou JSON da classificação quebrado — a mesma chamada vai para a OpenAI
(Responses API, gpt-6-luna), configurada só pelo monitor/.env.
"""
import json
import time
from unittest.mock import patch

import pytest
import requests

import ai_classifier
from ai_classifier import AIClassifier

GEMINI = 'generativelanguage.googleapis.com'
OPENAI = 'api.openai.com'

CLASSIFICACAO = json.dumps([{
    'id': 1, 'categoria': 5, 'severity': 'MEDIUM', 'affected_assets': ['BTC'],
    'titulo_pt': 'Fed mantém juros', 'impacto_pt': 'Juros estáveis.',
}])


class _Resp:
    def __init__(self, status_code: int, corpo):
        self.status_code = status_code
        self._corpo = corpo
        self.text = corpo if isinstance(corpo, str) else json.dumps(corpo)

    def json(self):
        return self._corpo if isinstance(self._corpo, dict) else {}


def _gemini(texto: str) -> _Resp:
    return _Resp(200, {'candidates': [{'content': {'parts': [{'text': texto}]}}]})


def _openai(texto: str) -> _Resp:
    return _Resp(200, {
        'model': 'gpt-6-luna',
        'output': [
            {'type': 'reasoning', 'summary': []},
            {'type': 'message', 'content': [{'type': 'output_text', 'text': texto}]},
        ],
    })


@pytest.fixture(autouse=True)
def reserva_ligada(monkeypatch):
    monkeypatch.setattr(ai_classifier, 'GENESIS_AI_URL', 'https://generativelanguage.googleapis.com')
    monkeypatch.setattr(ai_classifier, 'GENESIS_AI_TOKEN', 'chave-gemini')
    monkeypatch.setattr(ai_classifier, 'OPENAI_FALLBACK_ENABLED', True)
    monkeypatch.setattr(ai_classifier, 'OPENAI_FALLBACK_KEY', 'chave-openai')
    monkeypatch.setattr(ai_classifier, 'OPENAI_FALLBACK_MODEL', 'gpt-6-luna')
    monkeypatch.setattr(ai_classifier, 'OPENAI_FALLBACK_BASE_URL', 'https://api.openai.com/v1')
    monkeypatch.setattr(ai_classifier, 'OPENAI_FALLBACK_ATTEMPTS', 2)
    monkeypatch.setattr(time, 'sleep', lambda s: None)


def _rodar(respostas: dict, chamada):
    """Executa `chamada` com requests.post falso; respostas[host] = lista de respostas (ou exceções)."""
    feitas = []

    def fake_post(url, json=None, headers=None, timeout=None):
        host = GEMINI if GEMINI in url else OPENAI
        feitas.append({'host': host, 'url': url, 'payload': json, 'headers': headers})
        resp = respostas[host].pop(0)
        if isinstance(resp, Exception):
            raise resp
        return resp

    with patch('ai_classifier.requests.post', side_effect=fake_post):
        resultado = chamada()
    return resultado, feitas


def test_gemini_ok_nao_chama_a_openai():
    classifier = AIClassifier(api_key='fake')
    texto, feitas = _rodar({GEMINI: [_gemini('Tom neutro.')]}, lambda: classifier._call_gemini('p', response_json=False))

    assert texto == 'Tom neutro.'
    assert [f['host'] for f in feitas] == [GEMINI]


def test_gemini_503_nas_tres_tentativas_cai_na_openai_luna():
    classifier = AIClassifier(api_key='fake')
    texto, feitas = _rodar(
        {GEMINI: [_Resp(503, 'x'), _Resp(503, 'x'), _Resp(503, 'x')], OPENAI: [_openai('Tom pela OpenAI.')]},
        lambda: classifier._call_gemini('prompt do dia', response_json=False),
    )

    assert texto == 'Tom pela OpenAI.'
    assert [f['host'] for f in feitas] == [GEMINI, GEMINI, GEMINI, OPENAI]
    pedido = feitas[-1]
    assert pedido['url'] == 'https://api.openai.com/v1/responses'
    assert pedido['payload']['model'] == 'gpt-6-luna'
    assert pedido['payload']['input'] == 'prompt do dia'
    assert pedido['payload']['store'] is False
    assert pedido['headers']['Authorization'] == 'Bearer chave-openai'


def test_gemini_chave_invalida_e_timeout_tambem_caem_na_openai():
    classifier = AIClassifier(api_key='fake')
    texto, _ = _rodar({GEMINI: [_Resp(400, 'API key not valid')], OPENAI: [_openai('ok 400')]},
                      lambda: classifier._call_gemini('p', response_json=False))
    assert texto == 'ok 400'

    timeout = requests.exceptions.Timeout()
    texto, _ = _rodar({GEMINI: [timeout, timeout, timeout], OPENAI: [_openai('ok timeout')]},
                      lambda: classifier._call_gemini('p', response_json=False))
    assert texto == 'ok timeout'


def test_gemini_200_sem_texto_cai_na_openai():
    classifier = AIClassifier(api_key='fake')
    vazio = _Resp(200, {'candidates': [{'finishReason': 'SAFETY'}]})
    texto, _ = _rodar({GEMINI: [vazio, vazio, vazio], OPENAI: [_openai('ok vazio')]},
                      lambda: classifier._call_gemini('p', response_json=False))

    assert texto == 'ok vazio'


def test_classificacao_com_json_quebrado_do_gemini_vai_para_a_openai():
    classifier = AIClassifier(api_key='fake')
    resultado, feitas = _rodar(
        {GEMINI: [_gemini('[{"id": 1, "category_id": 5, "sever')], OPENAI: [_openai(CLASSIFICACAO)]},
        lambda: classifier.classify([{'title': 'Fed mantém juros', 'source': 'x', 'summary': 'y'}]),
    )

    assert [f['host'] for f in feitas] == [GEMINI, OPENAI], 'o lote foi resolvido pela reserva, sem reprocessar um a um'
    assert len(resultado) == 1
    assert resultado[0]['titulo_pt'] == 'Fed mantém juros'
    assert resultado[0]['categoria'] == 5
    assert resultado[0]['severity'] == 'MEDIUM'


def test_openai_falhando_devolve_none_como_antes():
    classifier = AIClassifier(api_key='fake')
    texto, feitas = _rodar(
        {GEMINI: [_Resp(503, 'x')] * 3, OPENAI: [_Resp(500, 'fora'), _Resp(500, 'fora')]},
        lambda: classifier._call_gemini('p', response_json=False),
    )

    assert texto is None
    assert [f['host'] for f in feitas].count(OPENAI) == 2


def test_sem_chave_ou_desligada_nao_chama_a_openai(monkeypatch):
    classifier = AIClassifier(api_key='fake')

    monkeypatch.setattr(ai_classifier, 'OPENAI_FALLBACK_KEY', '')
    texto, feitas = _rodar({GEMINI: [_Resp(503, 'x')] * 3}, lambda: classifier._call_gemini('p', response_json=False))
    assert texto is None
    assert OPENAI not in [f['host'] for f in feitas]

    monkeypatch.setattr(ai_classifier, 'OPENAI_FALLBACK_KEY', 'chave-openai')
    monkeypatch.setattr(ai_classifier, 'OPENAI_FALLBACK_ENABLED', False)
    texto, feitas = _rodar({GEMINI: [_Resp(503, 'x')] * 3}, lambda: classifier._call_gemini('p', response_json=False))
    assert texto is None
    assert OPENAI not in [f['host'] for f in feitas]


def test_resposta_do_gemini_em_varias_partes_e_lida_inteira():
    meio = len(CLASSIFICACAO) // 2
    resposta = _Resp(200, {'candidates': [{'content': {'parts': [
        {'text': 'raciocinio...', 'thought': True},
        {'text': CLASSIFICACAO[:meio]},
        {'text': CLASSIFICACAO[meio:]},
    ]}}]})
    classifier = AIClassifier(api_key='fake')
    texto, feitas = _rodar({GEMINI: [resposta]}, lambda: classifier._call_gemini('p', validar=classifier._classificacao_valida))

    assert texto == CLASSIFICACAO
    assert [f['host'] for f in feitas] == [GEMINI]
