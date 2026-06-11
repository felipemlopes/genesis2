# Tasks — gemini-model-config

## Task List

- [x] 1. Verify Config_Layer
  - [x] 1.1 Confirm `genesis-api/config/services.php` exposes `gemini_analysis_model` with `env('GEMINI_ANALYSIS_MODEL', 'gemini-2.5-flash')` and `gemini_visual_model` with `env('GEMINI_VISUAL_MODEL', 'gemini-3.1-pro-preview')`

- [x] 2. Update environment files
  - [x] 2.1 Add `GEMINI_ANALYSIS_MODEL=gemini-2.5-flash` to `genesis-api/.env` (alongside the existing `GEMINI_VISUAL_MODEL` line)
  - [x] 2.2 Add or update `genesis-api/.env.example` to declare both `GEMINI_ANALYSIS_MODEL` and `GEMINI_VISUAL_MODEL` with inline comments explaining their purpose

- [x] 3. Fix MacroController
  - [x] 3.1 In `generateMacro()`, replace the hardcoded `gemini-2.5-flash` URL segment with `$model = config('services.gemini_analysis_model');` and interpolate `{$model}` into the URL
  - [x] 3.2 In `generateSentimento()`, apply the same config-read replacement

- [x] 4. Fix GeoEventService
  - [x] 4.1 In `genesis-api/app/Services/GeoEventService.php` (~line 205), replace the hardcoded `gemini-2.5-flash` URL segment with `$model = config('services.gemini_analysis_model');` and interpolate `{$model}` into the URL

- [x] 5. Fix IAGatewayController geminiProxy default
  - [x] 5.1 In `geminiProxy()`, replace `$request->input("model", "gemini-2.5-flash")` with `$request->input("model", config('services.gemini_analysis_model'))`

- [x] 6. Fix OpportunityScanner
  - [x] 6.1 In `G-nesis-2.0-main/components/OpportunityScanner.tsx`, remove the `model: "gemini-2.5-flash"` field from the gemini-proxy request body JSON

- [x] 7. Fix AI_Classifier
  - [x] 7.1 In `G-nesis-2.0-main/monitor/ai_classifier.py`, replace `GEMINI_MODEL = 'gemini-2.5-flash'` with `GEMINI_MODEL = os.getenv('GEMINI_ANALYSIS_MODEL', 'gemini-2.5-flash')`

- [ ] 8. Write tests
  - [ ] 8.1 Write a unit test (PHP) confirming `config('services.gemini_analysis_model')` returns `gemini-2.5-flash` when the env var is absent
  - [ ] 8.2 Write a property-based test (PHP) for Property 1: given a random model identifier set as `GEMINI_ANALYSIS_MODEL`, MacroController and GeoEventService URL builders produce a URL containing that identifier
  - [ ] 8.3 Write a property-based test (PHP) for Property 3: given a random caller-supplied model string in the request body, `geminiProxy` uses it instead of the config default
  - [ ] 8.4 Write a property-based test (Python/Hypothesis) for Property 4: given a random model name in `GEMINI_ANALYSIS_MODEL`, `GEMINI_URL` contains it as the path segment between `/models/` and `:generateContent`
  - [ ] 8.5 Write a unit/example test (TypeScript) for Property 6: the OpportunityScanner fetch body does not include a `model` key
  - [ ] 8.6 Write a static-analysis test for Property 5: assert no text-task PHP file references `gemini_visual_model` and no visual-task PHP file references `gemini_analysis_model`
