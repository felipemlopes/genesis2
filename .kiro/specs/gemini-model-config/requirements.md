# Requirements Document

## Introduction

The Genesis platform uses two distinct Gemini AI models: a **flash** model for fast text/analysis tasks (macro summaries, sentiment, news classification, opportunity scanner) and a **pro** model for visual/OCR tasks (chart scanning, image analysis). Currently, several components hardcode the model identifier in source code, making it impossible to swap models without modifying and redeploying code.

This feature centralizes both model identifiers behind environment variables (`GEMINI_ANALYSIS_MODEL` and `GEMINI_VISUAL_MODEL`), ensuring every component that calls the Gemini API reads its model name from configuration rather than embedding it literally.

## Glossary

- **Analysis_Model**: The Gemini model used for text-based tasks — macro summaries, market sentiment, geo-events, opportunity scanning, and news classification. Default: `gemini-2.5-flash`.
- **Visual_Model**: The Gemini model used for image/OCR tasks — chart scanning and technical analysis image processing. Default: `gemini-3.1-pro-preview`.
- **GEMINI_ANALYSIS_MODEL**: The environment variable that controls the Analysis_Model identifier.
- **GEMINI_VISUAL_MODEL**: The environment variable that controls the Visual_Model identifier.
- **Config_Layer**: The Laravel `config/services.php` file that reads env vars and exposes them to the application.
- **MacroController**: The Laravel controller (`app/Http/Controllers/Api/MacroController.php`) responsible for macro summaries and sentiment endpoints.
- **GeoEventService**: The Laravel service (`app/Services/GeoEventService.php`) responsible for geo-political event retrieval.
- **IAGatewayController**: The Laravel controller (`app/Http/Controllers/Api/IAGatewayController.php`) that includes the `geminiProxy` endpoint consumed by the frontend.
- **GeminiAnalysisService**: The Laravel service (`app/Services/GeminiAnalysisService.php`) that performs full chart analysis.
- **OpportunityScanner**: The React component (`components/OpportunityScanner.tsx`) that sends search requests through the gemini-proxy endpoint.
- **AI_Classifier**: The Python monitor script (`monitor/ai_classifier.py`) that classifies news items using Gemini.
- **Flash_Fallback**: The client-side fallback mechanism in `services/geminiService.ts` that retries with a flash model on 503/timeout errors from the pro model.

---

## Requirements

### Requirement 1: Backend — MacroController uses Analysis_Model from config

**User Story:** As a platform operator, I want the MacroController to read the Gemini model from configuration, so that I can change the analysis model without touching PHP source code.

#### Acceptance Criteria

1. THE MacroController SHALL read the analysis model identifier via `config('services.gemini_analysis_model')` instead of embedding the string `gemini-2.5-flash` literally in HTTP endpoint URLs.
2. WHEN `GEMINI_ANALYSIS_MODEL` is set in the environment, THE MacroController SHALL use that value for both `generateMacro()` and `generateSentimento()` calls.
3. IF `GEMINI_ANALYSIS_MODEL` is absent from the environment, THEN THE Config_Layer SHALL supply `gemini-2.5-flash` as the default value, preserving existing behavior.

---

### Requirement 2: Backend — GeoEventService uses Analysis_Model from config

**User Story:** As a platform operator, I want the GeoEventService to read the Gemini model from configuration, so that geo-event classification uses the same configurable model as the rest of the analysis pipeline.

#### Acceptance Criteria

1. THE GeoEventService SHALL read the analysis model identifier via `config('services.gemini_analysis_model')` instead of embedding the string `gemini-2.5-flash` in the endpoint URL.
2. WHEN `GEMINI_ANALYSIS_MODEL` is set in the environment, THE GeoEventService SHALL use that value when constructing the Gemini API URL.
3. IF `GEMINI_ANALYSIS_MODEL` is absent from the environment, THEN THE Config_Layer SHALL supply `gemini-2.5-flash` as the default, preserving existing behavior.

---

### Requirement 3: Backend — IAGatewayController geminiProxy uses Analysis_Model as default

**User Story:** As a platform operator, I want the geminiProxy endpoint to default to the configured analysis model, so that frontend callers that do not specify a model explicitly receive the environment-driven default.

#### Acceptance Criteria

1. THE IAGatewayController SHALL default the proxy model to `config('services.gemini_analysis_model')` when the request body does not include a `model` field.
2. WHEN the request body includes an explicit `model` value, THE IAGatewayController SHALL use the caller-supplied value, allowing the frontend to override on a per-request basis.
3. IF `GEMINI_ANALYSIS_MODEL` is absent from the environment, THEN THE Config_Layer SHALL supply `gemini-2.5-flash` as the default.

---

### Requirement 4: Frontend — OpportunityScanner sends model from backend default

**User Story:** As a platform operator, I want the OpportunityScanner to stop hardcoding the Gemini model in its proxy request, so that the model selection is driven by the backend configuration.

#### Acceptance Criteria

1. THE OpportunityScanner SHALL remove the hardcoded `model: "gemini-2.5-flash"` field from the gemini-proxy request body.
2. WHEN the OpportunityScanner sends a request to the gemini-proxy endpoint without a `model` field, THE IAGatewayController SHALL apply the configured Analysis_Model default (per Requirement 3).
3. THE OpportunityScanner SHALL continue to function identically from the user's perspective after the model field is removed from the request body.

---

### Requirement 5: Python monitor — AI_Classifier reads Analysis_Model from environment

**User Story:** As a platform operator, I want the Python news classifier to read the Gemini model from an environment variable, so that I can change the classification model without editing Python source code.

#### Acceptance Criteria

1. THE AI_Classifier SHALL read the Gemini model identifier from the `GEMINI_ANALYSIS_MODEL` environment variable.
2. IF `GEMINI_ANALYSIS_MODEL` is absent from the environment, THEN THE AI_Classifier SHALL use `gemini-2.5-flash` as the default value.
3. THE AI_Classifier SHALL construct `GEMINI_URL` using the value resolved in criteria 1–2, replacing the current hardcoded assignment.

---

### Requirement 6: Environment variable declaration

**User Story:** As a developer onboarding to the project, I want both model environment variables declared in `.env` and `.env.example`, so that I know exactly which values to configure.

#### Acceptance Criteria

1. THE genesis-api `.env` file SHALL declare `GEMINI_ANALYSIS_MODEL=gemini-2.5-flash` alongside the existing `GEMINI_VISUAL_MODEL` entry.
2. THE genesis-api `.env.example` file (if present) SHALL declare both `GEMINI_ANALYSIS_MODEL` and `GEMINI_VISUAL_MODEL` with their default values and inline comments explaining their purpose.
3. WHILE both variables are declared, THE Config_Layer SHALL continue to read `GEMINI_VISUAL_MODEL` for visual tasks and `GEMINI_ANALYSIS_MODEL` for text analysis tasks, maintaining the semantic separation between the two model roles.

---

### Requirement 7: Config_Layer correctness and consistency

**User Story:** As a backend developer, I want a single authoritative source for model identifiers in the Laravel application, so that adding a new Gemini-powered feature automatically inherits the configured model.

#### Acceptance Criteria

1. THE Config_Layer SHALL expose exactly two Gemini model keys: `gemini_analysis_model` (for text tasks) and `gemini_visual_model` (for image tasks).
2. THE Config_Layer SHALL read each key from its corresponding environment variable with a safe default so that the application starts correctly even when the env vars are missing.
3. FOR ALL backend components that call the Gemini API for text tasks, THE component SHALL resolve the model via `config('services.gemini_analysis_model')` and not via any inline string literal.
4. FOR ALL backend components that call the Gemini API for visual tasks, THE component SHALL resolve the model via `config('services.gemini_visual_model')` and not via any inline string literal.
