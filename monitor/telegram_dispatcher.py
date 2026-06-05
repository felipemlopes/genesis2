"""
Telegram Dispatcher — Gênesis Labs Radar News
Formata e envia alertas de notícias e descobertas para o Telegram via Bot API (HTML parse_mode).
"""

import logging
import os
import threading
import time

import requests

logger = logging.getLogger('radar-news')

TELEGRAM_TIMEOUT = 15  # seconds
RETRY_DELAY = 10       # seconds

SEVERITY_EMOJI = {
    'CRITICAL': '🔴',
    'HIGH': '🟠',
}

BIAS_LABELS = {
    'BULLISH': '📈 BULLISH',
    'BEARISH': '📉 BEARISH',
    'NEUTRAL': '➖ NEUTRAL',
}

MAX_SUMMARY_LENGTH = 500


def truncate_summary(text: str, max_length: int = MAX_SUMMARY_LENGTH) -> str:
    """Trunca texto se exceder max_length, adicionando '...' ao final.

    Se o texto tiver mais de max_length caracteres, retorna os primeiros
    max_length caracteres seguidos de '...'.
    """
    if not isinstance(text, str):
        return text
    if len(text) > max_length:
        return text[:max_length] + '...'
    return text


class TelegramDispatcher:
    """Formata e envia alertas para Telegram via Bot API."""

    def __init__(self, bot_token: str | None = None, chat_id: str | None = None):
        self.bot_token = bot_token or os.getenv('TELEGRAM_BOT_TOKEN', '')
        self.chat_id = chat_id or os.getenv('TELEGRAM_CHAT_ID', '')
        self.api_url = f'https://api.telegram.org/bot{self.bot_token}/sendMessage'

    def send_news_alert(self, entry: dict) -> bool:
        """Envia alerta de notícia classificada para o Telegram.

        Args:
            entry: dict com keys: title, severity, impact_summary,
                   affected_assets, source_url, market_bias

        Returns:
            True se enviado com sucesso, False caso contrário.
        """
        message = self._format_news_message(entry)
        return self._send_message(message)

    def send_discovery_alert(self, entry: dict) -> bool:
        """Envia alerta de descoberta (Discovery Radar) para o Telegram.

        Args:
            entry: dict com keys: symbol, discovery_score, volume_24h,
                   exchanges, context, source_url

        Returns:
            True se enviado com sucesso, False caso contrário.
        """
        message = self._format_discovery_message(entry)
        return self._send_message(message)

    # ─── Dispatch Decision Logic ─────────────────────────────────────────────

    def dispatch(self, entry: dict) -> bool:
        """Decide se e quando enviar alerta com base na severidade.

        - CRITICAL: envia imediatamente sempre
        - HIGH: primeira do ciclo envia imediatamente, demais com delay de 30s
        - MEDIUM/LOW: não envia (skip)

        Args:
            entry: dict com keys de notícia classificada (severity, title, etc.)

        Returns:
            True se despacho foi executado/agendado, False se ignorado (MEDIUM/LOW).
        """
        severity = entry.get('severity', 'LOW').upper()

        if severity == 'CRITICAL':
            logger.info(f'[Dispatch] CRITICAL — enviando imediatamente: {entry.get("title", "")[:80]}')
            self._first_sent = True
            return self.send_news_alert(entry)

        if severity == 'HIGH':
            if not getattr(self, '_first_sent', False):
                # Primeira notícia — envia na hora
                logger.info(f'[Dispatch] HIGH — enviando imediatamente (primeira): {entry.get("title", "")[:80]}')
                self._first_sent = True
                return self.send_news_alert(entry)
            else:
                # Demais — delay de 30s pra não spammar
                logger.info(f'[Dispatch] HIGH — agendando envio em {HIGH_SEVERITY_DELAY}s: {entry.get("title", "")[:80]}')
                timer = threading.Timer(HIGH_SEVERITY_DELAY, self.send_news_alert, args=[entry])
                timer.daemon = True
                timer.start()
                return True

        # MEDIUM / LOW — skip
        logger.debug(f'[Dispatch] {severity} — ignorando: {entry.get("title", "")[:80]}')
        return False

    # ─── Formatação ───────────────────────────────────────────────────────────

    def _format_news_message(self, entry: dict) -> str:
        """Formata mensagem de notícia para Telegram (HTML)."""
        severity = entry.get('severity', 'MEDIUM')
        emoji = SEVERITY_EMOJI.get(severity, '🟡')
        title = self._translate_to_pt(entry.get('title', 'Sem título'))
        impact = truncate_summary(self._translate_to_pt(entry.get('impact_summary', '')))
        assets = entry.get('affected_assets', [])
        source_url = entry.get('source_url', '')
        bias = entry.get('market_bias', 'NEUTRAL')

        assets_str = ', '.join(assets) if assets else 'N/A'
        bias_label = BIAS_LABELS.get(bias, '➖ NEUTRAL')

        lines = [
            f'{emoji} <b>{title}</b>',
            '',
            f'📊 <b>Impacto:</b> {impact}',
        ]

        if source_url:
            lines.append(f'🔗 <a href="{source_url}">Fonte</a>')

        return '\n'.join(lines)

    def _format_discovery_message(self, entry: dict) -> str:
        """Formata mensagem de descoberta para Telegram (HTML)."""
        symbol = entry.get('symbol', '???')
        score = entry.get('discovery_score', 0)
        volume = entry.get('volume_24h', 'N/A')
        exchanges = entry.get('exchanges', [])
        context = truncate_summary(entry.get('context', ''))
        source_url = entry.get('source_url', '')

        exchanges_str = ', '.join(exchanges) if exchanges else 'N/A'

        # Formata volume legível
        if isinstance(volume, (int, float)):
            volume_str = f'${volume:,.0f}'
        else:
            volume_str = str(volume)

        lines = [
            f'🔍 <b>{symbol} — Discovery Score: {score}/10</b>',
            '',
            f'📊 <b>Volume 24h:</b> {volume_str}',
            f'🏦 <b>Exchanges:</b> {exchanges_str}',
            f'📝 <b>Contexto:</b> {context}',
        ]

        if source_url:
            lines.append(f'🔗 <a href="{source_url}">CoinGecko</a>')

        return '\n'.join(lines)

    # ─── Envio ────────────────────────────────────────────────────────────────

    def _translate_to_pt(self, text: str) -> str:
        """Traduz texto para português usando Google Translate API gratuita."""
        if not text or not text.strip():
            return text
        try:
            url = 'https://translate.googleapis.com/translate_a/single'
            params = {
                'client': 'gtx',
                'sl': 'en',
                'tl': 'pt',
                'dt': 't',
                'q': text,
            }
            resp = requests.get(url, params=params, timeout=5)
            if resp.status_code == 200:
                data = resp.json()
                translated = ''.join(part[0] for part in data[0] if part[0])
                return translated
        except Exception as e:
            logger.debug(f'[Translate] Falha ao traduzir, usando original: {e}')
        return text

    def _send_message(self, text: str) -> bool:
        """Envia mensagem para Telegram com retry (1x após 10s em caso de erro).

        Returns:
            True se enviado com sucesso, False caso contrário.
        """
        payload = {
            'chat_id': self.chat_id,
            'text': text,
            'parse_mode': 'HTML',
            'disable_web_page_preview': True,
        }

        for attempt in range(2):
            try:
                resp = requests.post(
                    self.api_url,
                    json=payload,
                    timeout=TELEGRAM_TIMEOUT,
                )

                if resp.status_code == 200 and resp.json().get('ok'):
                    logger.info('[Telegram] Mensagem enviada com sucesso.')
                    return True

                logger.warning(
                    f'[Telegram] Erro na API (tentativa {attempt + 1}): '
                    f'status={resp.status_code}, body={resp.text[:200]}'
                )

            except requests.RequestException as e:
                logger.warning(
                    f'[Telegram] Erro de rede (tentativa {attempt + 1}): {e}'
                )

            # Retry após RETRY_DELAY (10s) apenas na primeira tentativa
            if attempt == 0:
                logger.info(f'[Telegram] Retentando em {RETRY_DELAY}s...')
                time.sleep(RETRY_DELAY)

        logger.error('[Telegram] Falha ao enviar mensagem após 2 tentativas.')
        return False
