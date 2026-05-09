# AI Context for IntelliTest

## Purpose
This document is the primary context guide for any AI coding assistant working on this repository.
Read this file before generating, refactoring, or modifying code.

**Extension vs web app:** Features that live in the VS Code sidebar (webview under `webview/`, logic under `src/providers/`, etc.) are **not** the same as the standalone **website** under `website/`. Authentication UI and JWT handling described here apply to the **extension** unless a task explicitly targets the browser app.

Use this as the source of truth for:
- project intent
- architecture boundaries
- output format requirements
- UI/UX constraints
- coding and integration conventions

## Project Overview
IntelliTest is a VS Code extension that generates structured software test cases using AI.

Primary objective:
- help developers and testers quickly generate practical, structured test cases from a user prompt, while also considering project context
- include the most relevant code symbols and files when the prompt names a specific file or area

## Core Features
- Sidebar UI inside VS Code
- Prompt input field for test generation requests
- AI-generated structured test cases
- Automatic tech stack detection from project files
- Recommended testing framework from AI response
- Tabular preview of generated test cases in the sidebar
- Excel export of generated test cases

## Tech Stack
- VS Code Extension API
- TypeScript and JavaScript
- Webview frontend using HTML, CSS, and JS
- Node.js runtime for extension backend
- Axios for external API calls
- XLSX for Excel generation

## Architecture
High-level component responsibilities:
- [src/extension.ts](src/extension.ts): extension activation and provider registration
- [src/providers/IntelliTestViewProvider.ts](src/providers/IntelliTestViewProvider.ts): webview orchestration, **auth gate**, generation flow (stateful backend v2), session/bootstrap, export
- [src/services/authSession.ts](src/services/authSession.ts): IntelliTest account login/sign-up HTTP calls + JWT persisted in VS Code SecretStorage
- [src/services/backendClient.ts](src/services/backendClient.ts): HTTP client for the Node/Mongo backend (`/generate`, `/analyze-intent`, `/project/...`), sends `Authorization: Bearer` when authenticated
- [src/errors/unauthorized.ts](src/errors/unauthorized.ts): `UnauthorizedApiError` when the backend returns 401 (clears session in the sidebar)
- [src/services/groq.ts](src/services/groq.ts): legacy/direct Groq integration (still present; primary product path uses backend LLM configuration)
- [src/services/techStack.ts](src/services/techStack.ts): tech stack detection logic
- [src/services/codebaseContext.ts](src/services/codebaseContext.ts): broad codebase context builder for file-name awareness
- [src/services/codeInsights.ts](src/services/codeInsights.ts): AST-based symbol extraction with syntax and semantic layers
- [src/services/projectMap.ts](src/services/projectMap.ts): builds prioritized AI context from tech stack, routes, modules, code insights, and prompt hints
- [src/services/excel.ts](src/services/excel.ts): Excel workbook generation and file export
- [src/types/messages.ts](src/types/messages.ts): webview-backend message contract
- [src/types/testCases.ts](src/types/testCases.ts): strongly typed test case data model
- [webview/intellitest.html](webview/intellitest.html): sidebar markup
- [webview/intellitest.css](webview/intellitest.css): VS Code-themed styling
- [webview/intellitest.js](webview/intellitest.js): frontend behavior, state updates, and message handling

### Message Passing Model
Communication is event-driven between webview and extension host (`IntelliTestViewProvider`).

Webview → extension commands:
- `ready` — webview mounted; triggers auth bootstrap (`GET /auth/me` when a stored JWT exists) or shows the gate
- `login` / `signup` — email/password (+ name on sign-up); on success JWT is stored and the full UI loads
- `logout` — deletes stored JWT and returns to the gate
- `retryAuth` — re-runs bootstrap after a connection failure
- `generate`, `syncProject`, `exportExcel`, `refreshCodeInsights`, test script clipboard/save commands (unchanged)

Extension → webview commands (non-exhaustive):
- `authState` — `{ authenticated, needsBackendUrl?, user?, bootstrapError? }` toggles **gate-only** vs **full sidebar**
- `authError` / `authErrorClear`, `authBusy` — gate form validation and UX
- `resetMainUi` — clears preview table and prompt after logout or session expiry
- `init`, `sessionLoaded`, `result`, `exportStatus`, `codeInsights`

### Authentication (extension)
- Until the user is authenticated with the IntelliTest **server**, the sidebar shows only the **login / sign-up** gate (VS Code theme tokens). The main generator UI is hidden (`#appWorkspace`).
- JWT from `POST /auth/login` or `POST /auth/signup` is stored via `ExtensionContext.secrets` (`intellitest.authJwt`). It survives restarting VS Code on the same machine until logout or JWT expiry (`JWT_EXPIRES_IN` on server, default 7 days).
- All stateful backend calls from the extension include `Authorization: Bearer <token>` so MongoDB persists and loads **per userId + projectId** (messages, context, generations).

## AI Integration
Stateful generation uses the **IntelliTest Node backend** (`Server/`), which calls the configured LLM (see server config). Older or alternative paths may reference Groq directly in extension code.

Key points:
- API transport via Axios (extension ↔ backend; backend ↔ model provider as configured)
- Behavior controlled by a system prompt and structured user prompt assembly
- AI must return JSON in the expected schema
- Parser supports practical model output patterns and normalizes into internal types
- structured code insights are added when available, with priority files moved to the front of the context

### Current Prompting Strategy
AI input combines:
- user prompt
- detected tech stack
- project file-name context
- structured code insights extracted from the workspace

### Code Context Strategy
The repository does not send raw file contents character-by-character to the model. Instead, it parses supported JS/TS files into an AST and extracts only the relevant symbols:
- function names, parameters, and type signatures
- class names and method names
- variable names and inferred/declared types where available
- import paths
- optional JSDoc descriptions when present

If the user mentions a specific file in the prompt, that file is prioritized in the generated context so its symbols appear first.

Scope behavior:
- if user explicitly limits scope with terms like only, just, limit to, or focus on, generation must stay within that scope
- if the user mentions a filename, that file is prioritized in the code context
- otherwise generation can provide broader relevant coverage

## Coding Guidelines
- Keep code modular and responsibility-driven
- Prefer small focused services over large monolithic files
- Use async and await for async flows
- Handle errors explicitly and surface user-friendly messages
- Never hardcode API keys or secrets
- Follow VS Code extension best practices for webview lifecycle and message handling
- Preserve existing behavior unless change is explicitly requested

## UI and UX Guidelines
- Follow VS Code theme tokens and variables
- Avoid hardcoded color values
- Match native VS Code visual tone and spacing
- Keep interactions clear and low-friction
- Keep loading states explicit for generation and export actions

## Required Test Case Data Format
Every generated test case must map to this exact structure:

- Test Case ID:
- Title:
- Description:
- Preconditions:
- Steps:
- Expected Result:
- Priority:

Additional output requirement:
- include one recommended testing framework for the generated scope

## AI Behavior Rules
- Always include meaningful edge cases
- Include negative scenarios
- Keep outputs structured and machine-parsable
- Avoid unnecessary narrative explanations in generated payloads
- Prioritize prompt intent over unrelated assumptions

## Extension Workflow
1. User signs in or creates an account (gate); JWT stored in SecretStorage
2. Extension loads workspace `projectId`, optional session from `GET /project/:id/init` (scoped to logged-in user)
3. User enters prompt in sidebar
4. Extension has detected tech stack context (and may sync file list for the backend graph)
5. Backend-driven AI generates structured test cases plus recommended framework
6. Webview renders tabular preview
7. User exports to Excel when needed

## Excel Export Notes
- Uses XLSX for workbook generation
- Converts normalized test case rows into sheet records
- Applies column auto-width sizing
- Filename uses a readable timestamp format
- Success notification provides open folder action

## Security and Config Notes
- Do not commit secrets
- Use environment variable GROQ_API_KEY
- Debug run configuration supports environment loading via [ .vscode/launch.json ](.vscode/launch.json)

## Future Extensions
- streaming AI responses in the sidebar
- deeper multi-file relevance selection for context building
- automated test code generation from approved test cases
- per-project settings for framework preferences and output style

## Notes for AI Tools
- Do not assume raw file contents are sent to the model; the current design sends structured symbol context instead
- Prefer updating this file when the codebase gains new context-building or AI-prompt behavior

## Instructions for AI Tools
Before making changes:
1. Read this file fully
2. Follow existing architecture boundaries
3. Preserve message contracts unless intentionally versioned
4. Keep output format stable and structured
5. Do not break the required test case schema
6. Do not introduce unnecessary complexity

When adding new features:
1. Keep backend logic simple and modular
2. Keep UI aligned with VS Code style conventions
3. Maintain export compatibility with existing Excel format
4. Validate TypeScript compile success after changes
