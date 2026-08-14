<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * SUBSTITUIR o MacroController.php integralmente por este arquivo.
 * Correcoes:
 * 1. generateMacro() — usa google_search_retrieval real com as 4 economias corretas
 * 2. sentimento()    — novo endpoint por simbolo, cache 1h, max 300 chars
 */
class MacroController extends Controller
{
    /**
     * GET /api/v1/macro/today
     * Retorna resumo macroeconomico e geopolitico do dia.
     * Cache ate o fim do dia.
     */
    public function today(Request $request): JsonResponse
    {
        $today    = Carbon::now()->format('d/m/Y');
        $cacheKey = "macro_governance_{$today}";

        $macro = Cache::remember($cacheKey, now()->endOfDay(), function () {
            Log::info('MacroController: gerando macro via Gemini (cache miss)');
            return $this->generateMacro();
        });

        return response()->json([
            'date'    => $today,
            'content' => $macro,
        ]);
    }

    /**
     * GET /api/v1/macro/sentimento?symbol=BTCUSDT
     * Retorna sentimento de mercado especifico para o simbolo.
     * Cache 1 hora.
     */
    public function sentimento(Request $request): JsonResponse
    {
        $symbol   = strtoupper($request->input('symbol', ''));
        $base     = str_replace(['USDT', 'BUSD', 'USDC', 'BTC', 'ETH'], '', $symbol);
        $cacheKey = 'sentimento_' . $symbol . '_' . Carbon::now()->format('Y-m-d-H');

        $sentimento = Cache::remember($cacheKey, 3600, function () use ($symbol, $base) {
            Log::info("MacroController: gerando sentimento para {$symbol}");
            return $this->generateSentimento($symbol, $base);
        });

        return response()->json([
            'symbol'     => $symbol,
            'sentimento' => $sentimento,
        ]);
    }

    /**
     * Gera resumo macroeconomico via Google Search.
     * Foco: EUA (Fed), BCE (Eurozona), China (PBOC), Japao (BOJ).
     * Max 300 caracteres, texto corrido, sem titulos.
     */
    private function generateMacro(): string
    {
        $today  = Carbon::now()->format('d/m/Y');
        $apiKey = config('services.gemini_key');

        $prompt = "Data de hoje: {$today}. Use Google Search para buscar eventos macroeconomicos e geopoliticos ATUAIS desta semana."
            . " ECONOMIAS A MONITORAR: Estados Unidos (Fed, CPI, Payroll, PIB, Treasuries),"
            . " Banco Central Europeu (BCE, inflacao eurozona),"
            . " China (PBOC, dados economicos, tensoes comerciais),"
            . " Japao (BOJ, iene, politica monetaria)."
            . " INCLUIR: agenda economica da semana, decisoes de juros, dados de inflacao, tensoes geopoliticas graves com impacto nos mercados globais."
            . " EXCLUIR COMPLETAMENTE: criptomoedas, tokens, projetos especificos, analise tecnica."
            . " Retorne apenas os fatos relevantes em texto corrido em portugues, maximo 300 caracteres, sem titulos ou marcadores."
            . " Se nao houver eventos relevantes: Sem eventos macroeconomicos de alto impacto previstos para o periodo.";

        $payload = [
            'contents'         => [['parts' => [['text' => $prompt]]]],
            'tools'            => [['google_search_retrieval' => new \stdClass()]],
            'generationConfig' => ['temperature' => 0, 'maxOutputTokens' => 256],
        ];

        try {
            $response = Http::timeout(30)->post(
                "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={$apiKey}",
                $payload
            );

            if (!$response->successful()) {
                Log::warning('MacroController: generateMacro falhou', ['status' => $response->status()]);
                return 'Dados macroeconomicos temporariamente indisponiveis.';
            }

            return $response->json()['candidates'][0]['content']['parts'][0]['text']
                ?? 'Sem eventos macroeconomicos relevantes no periodo.';

        } catch (\Throwable $e) {
            Log::error('MacroController: generateMacro erro', ['error' => $e->getMessage()]);
            return 'Dados macroeconomicos temporariamente indisponiveis.';
        }
    }

    /**
     * Gera sentimento de mercado para o simbolo via Google Search.
     * Foco: noticias do projeto, parcerias, atualizacoes, listagens.
     * Max 300 caracteres, texto corrido, sem titulos.
     */
    private function generateSentimento(string $symbol, string $base): string
    {
        $apiKey = config('services.gemini_key');

        $prompt = "Use Google Search para buscar noticias e atualizacoes RECENTES sobre {$base} ({$symbol})."
            . " INCLUIR: parcerias, atualizacoes de protocolo, listagens em exchanges, decisoes de governanca, eventos relevantes do projeto, mudancas de equipe."
            . " EXCLUIR COMPLETAMENTE: precos, analise tecnica, predicoes de preco, dados macroeconomicos."
            . " Retorne apenas fatos relevantes em texto corrido em portugues, maximo 300 caracteres, sem titulos ou marcadores."
            . " Se nao houver noticias relevantes: Sem atualizacoes relevantes para {$base} no periodo recente.";

        $payload = [
            'contents'         => [['parts' => [['text' => $prompt]]]],
            'tools'            => [['google_search_retrieval' => new \stdClass()]],
            'generationConfig' => ['temperature' => 0, 'maxOutputTokens' => 256],
        ];

        try {
            $response = Http::timeout(30)->post(
                "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={$apiKey}",
                $payload
            );

            if (!$response->successful()) {
                Log::warning("MacroController: generateSentimento falhou para {$symbol}", ['status' => $response->status()]);
                return 'Dados de sentimento temporariamente indisponiveis.';
            }

            return $response->json()['candidates'][0]['content']['parts'][0]['text']
                ?? "Sem atualizacoes relevantes para {$base} no periodo recente.";

        } catch (\Throwable $e) {
            Log::error("MacroController: generateSentimento erro para {$symbol}", ['error' => $e->getMessage()]);
            return 'Dados de sentimento temporariamente indisponiveis.';
        }
    }
}

// ============================================================
// ADICIONAR EM routes/api.php:
// Route::get('/macro/today',      [MacroController::class, 'today']);
// Route::get('/macro/sentimento', [MacroController::class, 'sentimento']);
// ============================================================
