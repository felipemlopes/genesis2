"""Piso deterministico de severidade. So promove, nunca rebaixa.
Rede de seguranca para o caso de o classificador subestimar um evento do catalogo.

ATENCAO (Fase 3 do plano radar-news-v1-1-monitor): as listas de entidades abaixo
(EXCHANGES_SISTEMICAS, TESOURARIAS_BTC, EMISSORES_SISTEMICOS) e os limiares em
dolar usados em piso_de_severidade/_maior_valor_usd sao PROPOSTA do documento
Radar News V1.1 (RT-01, RT-02, RT-03 da secao 12) e AINDA NAO FORAM RATIFICADOS
pelo Fabricio (PO). Estao aqui como os valores literais do documento para a
mecanica do piso poder ser escrita e testada — nao sao definitivos ate a
ratificacao. Nao subir para producao sem essa confirmacao.
"""

import re

# RT-01 (pendente ratificacao PO): listas de entidades de C.1
EXCHANGES_SISTEMICAS = (
    'binance', 'coinbase', 'okx', 'bybit', 'upbit', 'kraken', 'bitstamp', 'bitfinex',
    'kucoin', 'htx', 'huobi', 'gate.io', 'mexc', 'crypto.com', 'gemini exchange',
    'bithumb', 'cme',
)

TESOURARIAS_BTC = (
    'microstrategy', 'strategy inc', 'metaplanet', 'marathon digital', 'mara holdings',
    'riot platforms', 'tesla', 'block inc', 'semler scientific', 'twenty one capital',
    'galaxy digital', 'bitcoin group',
)

EMISSORES_SISTEMICOS = (
    'tether', 'circle', 'makerdao', 'sky protocol', 'ethena labs', 'paxos',
    'bitgo', 'fireblocks', 'anchorage',
)

RX_FECHAMENTO = re.compile(
    r'\b(halt|halts|halted|suspend\w*|freez\w*|pause[sd]?|shut\s?down|insolven\w*|'
    r'bankrupt\w*|chapter\s*11|collapse[sd]?|wind[s]?\s?down|'
    r'suspend\w*|congelamento|insolven\w*|falenc\w*|encerra\w*|recuperacao judicial)\b', re.I)

RX_SAQUES = re.compile(r'\b(withdrawal|withdrawals|redemption|saque|saques|resgate)\w*\b', re.I)

RX_VENDA = re.compile(
    r'\b(sold|sells|selling|sale of|offload\w*|liquidat\w*|dump\w*|divest\w*|'
    r'vendeu|vende|venda de|desfez|liquidou)\b', re.I)

RX_DEPEG = re.compile(r'\b(depeg\w*|de-peg\w*|loses? (the )?peg|below (the )?peg|perdeu a paridade)\b', re.I)

RX_EXPLOIT = re.compile(r'\b(exploit\w*|hack\w*|drain\w*|stolen|breach|roubo|invasao)\b', re.I)


def _cita(texto: str, entidades: tuple) -> bool:
    return any(e in texto for e in entidades)


def piso_de_severidade(titulo: str, resumo: str) -> str | None:
    """Devolve 'CRITICAL', 'HIGH' ou None. Nunca rebaixa: quem chama usa o maior valor."""
    t = f'{titulo} {resumo}'.lower()

    # G01 e G02: corretora fechando ou travando saque
    if _cita(t, EXCHANGES_SISTEMICAS):
        if RX_FECHAMENTO.search(t):
            return 'CRITICAL'
        if RX_SAQUES.search(t) and RX_FECHAMENTO.search(t):
            return 'CRITICAL'

    # G03: tesouraria vendendo BTC ou ETH (RT-03: assimetria — venda=CRITICAL, compra=ALTA)
    if _cita(t, TESOURARIAS_BTC) and RX_VENDA.search(t):
        return 'CRITICAL'

    # G05: depeg de stablecoin sistemica
    if RX_DEPEG.search(t) and any(s in t for s in ('usdt', 'tether', 'usdc', 'circle', 'dai', 'usde', 'ethena')):
        return 'CRITICAL'

    # G07: emissor ou custodiante sistemico em colapso
    if _cita(t, EMISSORES_SISTEMICOS) and RX_FECHAMENTO.search(t):
        return 'CRITICAL'

    # G06: exploit — limiares RT-02 (pendente ratificacao): >= US$ 25mi CRITICAL, >= US$ 5mi HIGH
    if RX_EXPLOIT.search(t):
        valor = _maior_valor_usd(t)
        if valor is not None and valor >= 25_000_000:
            return 'CRITICAL'
        if valor is not None and valor >= 5_000_000:
            return 'HIGH'

    return None


def _maior_valor_usd(texto: str) -> float | None:
    """Extrai o maior valor em dolares citado no texto ('$340 million', 'US$ 1.2 bilhao').

    CORREÇÃO em cima do código literal do documento (Fase 3, 05/08/2026): a alternância
    regex original listava 'mil' antes de 'million'/'milhao'/'milhoes'. Como 'mil' é
    prefixo dessas três palavras, a regex casava só os 3 primeiros caracteres de
    "million" como se fosse "mil" (mil = 10^3), subestimando o valor em 1000x — ex.:
    "$340 million" virava 340 mil em vez de 340 milhões, o que quebra a prova P18
    do próprio documento ("Protocol X exploited for $340 million" → CRITICAL por
    limiar de US$ 25 milhões). Corrigido ordenando a alternância do token mais
    específico (mais longo) pro menos específico, respeitando as relações de
    prefixo (million/milhoes/milhao antes de mil; billion/bilhoes/bilhao antes de b).
    """
    mult = {'k': 1e3, 'mil': 1e3, 'm': 1e6, 'million': 1e6, 'milhao': 1e6, 'milhoes': 1e6,
            'b': 1e9, 'billion': 1e9, 'bilhao': 1e9, 'bilhoes': 1e9}
    achados = []
    for m in re.finditer(
        r'(?:us\$|\$)\s?([\d.,]+)\s*(million|milhoes|milhao|billion|bilhoes|bilhao|mil|k|m|b)?',
        texto, re.I,
    ):
        try:
            num = float(m.group(1).replace(',', ''))
        except ValueError:
            continue
        achados.append(num * mult.get((m.group(2) or '').lower(), 1))
    return max(achados) if achados else None
