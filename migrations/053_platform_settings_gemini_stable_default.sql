-- Move default Gemini away from preview-lite (frequent Google 503 "high demand" under capacity limits).
-- Mastra planning agents read platform_settings.ai_gemini_model when provider is gemini.

UPDATE platform_settings
SET
    ai_gemini_model = 'gemini-2.0-flash',
    ai_primary_model = CASE
        WHEN ai_primary_provider = 'gemini' AND NULLIF(TRIM(ai_primary_model), '') = 'gemini-3.1-flash-lite-preview'
            THEN 'gemini-2.0-flash'
        ELSE ai_primary_model
    END
WHERE id = 'default'
  AND NULLIF(TRIM(ai_gemini_model), '') = 'gemini-3.1-flash-lite-preview';
