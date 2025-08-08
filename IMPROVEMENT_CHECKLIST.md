### Providers architecture (create `src/providers/`)
- [x] Create directory `src/providers/`
- [x] Define `Provider` interface (methods: `processImages(prompt, images)`, `processText(prompt, text)`, `loadModels()`, `testConnection()`)
- [x] Define shared types: `ProviderId` (`anthropic` | `ollama` | `openrouter`), `ModelInfo` (id, displayName, capabilities)
- [x] Implement `AnthropicProvider` adapter using existing logic from `src/ai.ts`
- [x] Implement `OllamaProvider` adapter (initial port from existing logic)
- [x] Implement `OpenRouterProvider` adapter (stub)
- [ ] Introduce a unified internal message/content abstraction and translate in each provider
- [x] Refactor `src/ai.ts` to a thin router delegating to providers
- [x] Update settings types to hold provider-specific config where applicable
- [ ] Update UI for provider selection to use provider registry and dynamic model lists

### Strengthen Ollama integration (robustness, quality, UX)
- [ ] Multi‑page support
  - [x] Add setting: "Images per request" (default 1) and "Page chunk size"
  - [x] If model supports multi-image, send multiple images; otherwise iterate per chunk and merge results
  - [x] Preserve page order with clear delimiters between chunks
- [ ] Capability detection and health checks
  - [x] Implement capability probe via `/api/tags` and `/api/show` (if available) to tag vision support
  - [x] Add "Test connection" button that validates URL, model availability, and vision capability
  - [x] Auto-normalize URL (ensure protocol, trailing slashes)
- [ ] Request sizing and image controls
  - [x] Configurable DPI, max width, and output format (PNG/JPEG with quality)
  - [x] Estimate payload size and split requests if over threshold
- [ ] Error handling & retries
  - [x] Add retry with backoff for transient network errors
  - [x] Specific user notices for: connection refused, model not found, model incompatible with images
 - [ ] Streaming & progress
  - [x] Attempt `stream: true` support
   - [x] Implement page-by-page/chunk progress updates
   - [x] Update progress modal to show per-page/chunk progress
- [ ] Model selection UX
  - [x] Filter and label vision-capable models (llava, bakllava, etc.)
  - [x] Add override: "Force send images to this model"
- [ ] Text-only fallback
  - [ ] If image processing fails or model lacks vision, optionally run PDF text extraction + formatting prompt
 - [ ] Cross‑platform extraction
  - [x] Replace hardcoded `/opt/homebrew/bin/pdftoppm` with PATH lookup and configurable binary path
  - [x] If Poppler missing, fallback to PDF.js rendering path

### Add OpenRouter provider (broader model support)
- [ ] Settings
  - [ ] Add provider `openrouter` with API key field and base URL `https://openrouter.ai/api/v1`
  - [ ] Fetch and cache models (`GET /models`) for dropdown; refresh button
  - [ ] Tag vision-capable models based on metadata or curated list
- [ ] Requests (multimodal)
  - [ ] Implement OpenAI-compatible chat payload with content parts for text + image data URLs
  - [ ] Support single and multi-image requests; fall back to chunking if needed
  - [ ] Handle streaming (SSE) later; start with non-streaming
- [ ] Errors & limits
  - [ ] Map HTTP/API errors to friendly notices and retryable categories
  - [ ] Rate limit handling with backoff and clear messaging

### PDF conversion reliability and options
- [ ] Poppler improvements
  - [x] Configurable DPI, max width, format (PNG/JPEG + quality)
  - [ ] Page range selection in modal (e.g., `1-5,7,10-`)
- [ ] PDF.js fallback renderer
  - [ ] Implement stable canvas render path in `src/pdf.ts` for environments without Poppler
  - [ ] Auto-select fallback when Poppler is missing or fails

### Output quality and post‑processing
- [ ] Multi-pass pipeline (optional via setting)
  - [ ] Pass 1: raw extraction; Pass 2: structure/cleanup; optional Pass 3: headings/tables refinement
- [ ] Table-aware prompts
  - [ ] Add default prompts specialized for tables, forms, academic papers
- [ ] Image attachments
  - [ ] Optionally save page images alongside the note and reference with `![Page N](path)`

### UX and workflow
- [ ] Progress modal upgrades
  - [ ] Show step-by-step progress, current page/chunk, elapsed time
  - [ ] Add cancel/abort that terminates in-flight requests and cleans temp files
- [ ] Folder watcher
  - [ ] Debounce events and ignore partial writes
  - [ ] Concurrency limit for batch processing
  - [ ] Optional filename filters (e.g., only `_scan.pdf`)
 - [ ] Status notifications
   - [ ] Add a setting to enable/disable step popup notices
   - [ ] Respect setting during processing (modal still shows progress)

### Security and privacy
- [ ] Add "Verbose logging" toggle; default to minimal logs
- [ ] Enforce payload size thresholds with warnings/confirmation
- [ ] Avoid logging large content lengths and headers unless verbose is enabled

### Code architecture & migrations
- [ ] Remove Anthropic "emergency fix" by replacing with validated alias mapping
- [ ] Migrate settings to provider-specific sections (e.g., OpenRouter API key)
- [ ] Centralize model alias/display names and capabilities map
- [ ] Update `src/ui/PDF2MDSettingTab.ts` to use provider registry (dynamic fields per provider)

### Tests & diagnostics
- [ ] Add a "Run diagnostics" action in settings
  - [ ] Tests: connectivity, model listing, tiny sample request per provider
  - [ ] Surface clear pass/fail messages and suggested fixes
- [ ] Unit-testable helpers (URL normalization, payload splitting, image sizing)

### Documentation
- [ ] Update `README.md` with new providers, settings, and requirements
- [ ] Add a short "Getting started with OpenRouter" section
- [ ] Add notes on Poppler installation and PDF.js fallback
