"""
Unit tests for OI persistence methods (_buscar_oi_banco, _gravar_oi_banco, _criar_tabela_oi, _carregar_oi_banco).
Validates Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6
"""
import sys
import os
from unittest.mock import patch, MagicMock

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


class TestOiPersistence:
    """Tests for OI persistence in MySQL with fallback to memory cache."""

    def _create_worker(self):
        """Create a MonitorWorker instance with DB calls mocked during __init__."""
        with patch('monitor_worker.signal.signal'):
            with patch.object(_get_worker_class(), '_criar_tabela_oi'):
                with patch.object(_get_worker_class(), '_carregar_oi_banco'):
                    from monitor_worker import MonitorWorker
                    return MonitorWorker()

    def test_criar_tabela_oi_success(self):
        """_criar_tabela_oi executes CREATE TABLE IF NOT EXISTS without error."""
        worker = self._create_worker()
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value.__enter__ = MagicMock(return_value=mock_cursor)
        mock_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)

        with patch.object(worker, 'conectar_bd', return_value=mock_conn):
            worker._criar_tabela_oi()

        mock_cursor.execute.assert_called_once()
        call_sql = mock_cursor.execute.call_args[0][0]
        assert 'CREATE TABLE IF NOT EXISTS oi_historico' in call_sql
        mock_conn.commit.assert_called_once()
        mock_conn.close.assert_called_once()

    def test_criar_tabela_oi_no_connection(self):
        """_criar_tabela_oi gracefully handles no DB connection (Req 10.6)."""
        worker = self._create_worker()
        with patch.object(worker, 'conectar_bd', return_value=None):
            # Should not raise
            worker._criar_tabela_oi()

    def test_carregar_oi_banco_loads_cache(self):
        """_carregar_oi_banco loads latest OI per symbol into _oi_cache (Req 10.3)."""
        worker = self._create_worker()
        worker._oi_cache = {}

        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.fetchall.return_value = [
            {'symbol': 'BTCUSDT', 'oi_valor': 50000.0},
            {'symbol': 'ETHUSDT', 'oi_valor': 12000.0},
        ]
        mock_conn.cursor.return_value.__enter__ = MagicMock(return_value=mock_cursor)
        mock_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)

        with patch.object(worker, 'conectar_bd', return_value=mock_conn):
            worker._carregar_oi_banco()

        assert worker._oi_cache['BTCUSDT_oi'] == 50000.0
        assert worker._oi_cache['ETHUSDT_oi'] == 12000.0
        mock_conn.close.assert_called_once()

    def test_carregar_oi_banco_no_connection(self):
        """_carregar_oi_banco gracefully handles no DB (Req 10.6)."""
        worker = self._create_worker()
        worker._oi_cache = {}
        with patch.object(worker, 'conectar_bd', return_value=None):
            worker._carregar_oi_banco()
        assert worker._oi_cache == {}

    def test_buscar_oi_banco_returns_value(self):
        """_buscar_oi_banco returns last OI value from MySQL (Req 10.1)."""
        worker = self._create_worker()
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.fetchone.return_value = {'oi_valor': 42000.5}
        mock_conn.cursor.return_value.__enter__ = MagicMock(return_value=mock_cursor)
        mock_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)

        with patch.object(worker, 'conectar_bd', return_value=mock_conn):
            result = worker._buscar_oi_banco('BTCUSDT')

        assert result == 42000.5
        mock_cursor.execute.assert_called_once()
        call_args = mock_cursor.execute.call_args[0]
        assert 'BTCUSDT' in call_args[1]
        mock_conn.close.assert_called_once()

    def test_buscar_oi_banco_returns_none_no_data(self):
        """_buscar_oi_banco returns None when no OI data for symbol."""
        worker = self._create_worker()
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.fetchone.return_value = None
        mock_conn.cursor.return_value.__enter__ = MagicMock(return_value=mock_cursor)
        mock_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)

        with patch.object(worker, 'conectar_bd', return_value=mock_conn):
            result = worker._buscar_oi_banco('UNKNOWNUSDT')

        assert result is None

    def test_buscar_oi_banco_returns_none_on_error(self):
        """_buscar_oi_banco returns None on DB error (Req 10.6 fallback)."""
        worker = self._create_worker()
        with patch.object(worker, 'conectar_bd', side_effect=Exception("DB down")):
            result = worker._buscar_oi_banco('BTCUSDT')
        assert result is None

    def test_buscar_oi_banco_returns_none_no_connection(self):
        """_buscar_oi_banco returns None when no connection."""
        worker = self._create_worker()
        with patch.object(worker, 'conectar_bd', return_value=None):
            result = worker._buscar_oi_banco('BTCUSDT')
        assert result is None

    def test_gravar_oi_banco_inserts_record(self):
        """_gravar_oi_banco inserts OI into MySQL (Req 10.2)."""
        worker = self._create_worker()
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value.__enter__ = MagicMock(return_value=mock_cursor)
        mock_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)

        with patch.object(worker, 'conectar_bd', return_value=mock_conn):
            worker._gravar_oi_banco('ETHUSDT', 15000.75)

        mock_cursor.execute.assert_called_once()
        call_args = mock_cursor.execute.call_args[0]
        assert 'INSERT INTO oi_historico' in call_args[0]
        assert call_args[1] == ('ETHUSDT', 'BINANCE', 15000.75)
        mock_conn.commit.assert_called_once()
        mock_conn.close.assert_called_once()

    def test_gravar_oi_banco_no_connection(self):
        """_gravar_oi_banco silently handles no DB connection (Req 10.6)."""
        worker = self._create_worker()
        with patch.object(worker, 'conectar_bd', return_value=None):
            # Should not raise
            worker._gravar_oi_banco('BTCUSDT', 50000.0)

    def test_gravar_oi_banco_handles_exception(self):
        """_gravar_oi_banco silently handles DB exception (Req 10.6)."""
        worker = self._create_worker()
        mock_conn = MagicMock()
        mock_conn.cursor.side_effect = Exception("Connection lost")

        with patch.object(worker, 'conectar_bd', return_value=mock_conn):
            # Should not raise
            worker._gravar_oi_banco('BTCUSDT', 50000.0)

    def test_oi_fallback_to_banco_when_cache_empty(self):
        """When _oi_cache is empty, buscar_dados_extras falls back to _buscar_oi_banco (Req 10.5)."""
        worker = self._create_worker()
        worker._oi_cache = {}

        with patch.object(worker, 'buscar_funding_rate', return_value=0.01):
            with patch.object(worker, 'buscar_open_interest', return_value=55000.0):
                with patch.object(worker, '_buscar_oi_banco', return_value=50000.0) as mock_buscar:
                    with patch.object(worker, '_gravar_oi_banco') as mock_gravar:
                        result = worker.buscar_dados_extras('BTCUSDT')

        mock_buscar.assert_called_once_with('BTCUSDT')
        mock_gravar.assert_called_once_with('BTCUSDT', 55000.0)
        assert result['oi_subindo'] is True
        assert result['oi_atual'] == 55000.0
        assert result['oi_anterior'] == 50000.0

    def test_oi_no_fallback_when_cache_populated(self):
        """When _oi_cache has data, _buscar_oi_banco is NOT called."""
        worker = self._create_worker()
        worker._oi_cache = {'BTCUSDT_oi': 48000.0}

        with patch.object(worker, 'buscar_funding_rate', return_value=0.01):
            with patch.object(worker, 'buscar_open_interest', return_value=49000.0):
                with patch.object(worker, '_buscar_oi_banco') as mock_buscar:
                    with patch.object(worker, '_gravar_oi_banco') as mock_gravar:
                        result = worker.buscar_dados_extras('BTCUSDT')

        mock_buscar.assert_not_called()
        mock_gravar.assert_called_once_with('BTCUSDT', 49000.0)
        assert result['oi_subindo'] is True

    def test_init_calls_criar_and_carregar(self):
        """__init__ calls _criar_tabela_oi and _carregar_oi_banco (Req 10.3)."""
        with patch('monitor_worker.signal.signal'):
            with patch.object(_get_worker_class(), '_criar_tabela_oi') as mock_criar:
                with patch.object(_get_worker_class(), '_carregar_oi_banco') as mock_carregar:
                    from monitor_worker import MonitorWorker
                    worker = MonitorWorker()

        mock_criar.assert_called_once()
        mock_carregar.assert_called_once()


def _get_worker_class():
    """Helper to get MonitorWorker class for patching."""
    from monitor_worker import MonitorWorker
    return MonitorWorker
