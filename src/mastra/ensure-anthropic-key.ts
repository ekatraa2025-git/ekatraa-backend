/**
 * Mastra resolves `anthropic/...` models via the Anthropic API and expects
 * `ANTHROPIC_API_KEY` (see error: ModelsDevGateway.getApiKey). The rest of
 * this repo uses `CLAUDE_API_KEY` with `getClaudeApiKey()`. If only one is
 * set, mirror it so a single .env value works.
 */
if (!String(process.env.ANTHROPIC_API_KEY || '').trim()) {
    const fromClaude = String(process.env.CLAUDE_API_KEY || '').trim()
    if (fromClaude) {
        process.env.ANTHROPIC_API_KEY = fromClaude
    }
}
if (!String(process.env.CLAUDE_API_KEY || '').trim()) {
    const fromAnth = String(process.env.ANTHROPIC_API_KEY || '').trim()
    if (fromAnth) {
        process.env.CLAUDE_API_KEY = fromAnth
    }
}
