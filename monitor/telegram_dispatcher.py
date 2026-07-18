"""
Telegram Dispatcher — Gênesis Labs Radar News V1.0
Formata e envia alertas de notícias no formato oficial (seção 5) para o Telegram
via Bot API (HTML parse_mode). Envio para a comunidade Cripto.ico — mesmo grupo
e mesmo sistema de envio de sempre (Aviso 3); só o critério do que entra mudou.
"""

import html
import logging
import os

import requests

from ai_classifier import CATEGORIAS_NOMES

logger = logging.getLogger('radar-news')

TELEGRAM_TIMEOUT = 15  # seconds
RETRY_DELAY = 10       # seconds

SIGNATURE = 'Cripto.ico'

# Emojis por SEVERIDADE, não por categoria (seção 5)
SEVERITY_EMOJI = {
    'CRITICAL': '🔴',
    'HIGH': '🟠',
    'MEDIUM': '🟡',
    'LOW': '🟢',
}

SEVERITY_LABELS = {
    'CRITICAL': 'CRÍTICA',
    'HIGH': 'ALTA',
    'MEDIUM': 'MÉDIA',
    'LOW': 'BAIXA',
}

BIAS_LABELS = {
    'BULLISH': 'BULLISH',
    'BEARISH': 'BEARISH',
    'NEUTRAL': 'NEUTRO',
}

# Categorias com Observação opcional (Risco/Macro/Geopolítica)
CATEGORIAS_COM_OBSERVACAO = (2, 5, 6)


class TelegramDispatcher:
    """Formata e envia alertas de notícias e o resumo diário para o Telegram via Bot API."""

    def __init__(self, bot_token: str | None = None, chat_id: str | None = None):
        self.bot_token = bot_token or os.getenv('TELEGRAM_BOT_TOKEN', '')
        self.chat_id = chat_id or os.getenv('TELEGRAM_CHAT_ID', '')
        self.api_url = f'https://api.telegram.org/bot{self.bot_token}/sendMessage'

    def send_news_alert(self, entry: dict) -> bool:
        """Envia alerta de notícia (Nível 1) para o Telegram no formato oficial.

        Args:
            entry: dict classificado — titulo_pt, impacto_pt, categoria, ativo_tema,
                   market_bias, severity, source, observacao (opcional).

        Returns:
            True se enviado com sucesso, False caso contrário.
        """
        message = self._format_news_message(entry)
        return self._send_message(message)

    def send_resumo_diario(self, text: str) -> bool:
        """Envia o resumo diário (seção 5.1) já formatado para o Telegram."""
        return self._send_message(text)

    # ─── Formatação (seção 5 — formato oficial das mensagens) ────────────────

    def _format_news_message(self, entry: dict) -> str:
        """Formata mensagem de notícia para Telegram (HTML), no formato oficial da seção 5."""
        severity = (entry.get('severity') or 'LOW').upper()
        if severity not in SEVERITY_EMOJI:
            severity = 'LOW'
        emoji = SEVERITY_EMOJI[severity]
        severity_label = SEVERITY_LABELS[severity]

        categoria_num = entry.get('categoria')
        categoria_nome = CATEGORIAS_NOMES.get(categoria_num) or entry.get('category') or 'Radar News'

        title = html.escape((entry.get('titulo_pt') or entry.get('title') or 'Sem título').strip()[:85])
        impact = html.escape((entry.get('impacto_pt') or entry.get('impact_summary') or '').strip()[:220])

        affected_assets = entry.get('affected_assets') or []
        ativo_tema_raw = entry.get('ativo_tema') or (', '.join(affected_assets) if affected_assets else '-')
        ativo_tema = html.escape(ativo_tema_raw.strip()[:45] or '-')

        bias = BIAS_LABELS.get((entry.get('market_bias') or 'NEUTRAL').upper(), 'NEUTRO')
        source = html.escape((entry.get('source') or '-').strip())
        observacao = html.escape((entry.get('observacao') or '').strip()[:120])

        lines = [
            f'{emoji} <b>RADAR NEWS - {html.escape(categoria_nome)}</b>',
            '',
            f'<b>{title}</b>',
            '',
            f'Ativo ou tema: {ativo_tema}',
            f'Impacto: {impact}',
            f'Viés: {bias}',
            f'Severidade: {severity_label}',
        ]

        if categoria_num in CATEGORIAS_COM_OBSERVACAO and observacao:
            lines.append(f'Observação: {observacao}')

        lines.append(f'Fonte: {source}')
        lines.append('')
        lines.append(SIGNATURE)

        return '\n'.join(lines)

    # ─── Envio ────────────────────────────────────────────────────────────────

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

            if attempt == 0:
                logger.info(f'[Telegram] Retentando em {RETRY_DELAY}s...')
                import time
                time.sleep(RETRY_DELAY)

        logger.error('[Telegram] Falha ao enviar mensagem após 2 tentativas.')
        return False
