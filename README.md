# IntelliTest

AI-powered VS Code extension for generating structured software test cases.

IntelliTest is a VS Code sidebar extension that helps developers and testers generate clean, structured test cases using an external AI model. It combines the user prompt with project context (detected stack and codebase file context), shows results in a table preview, recommends a testing framework, and supports Excel export.

## Features

- AI-powered test case generation
- VS Code sidebar UI
- Tech stack detection
- Excel export functionality
- Clean VS Code-native UI design

## Demo / Preview

Add screenshots here:

- Sidebar overview
- Generated test case table preview
- Export success flow

## Installation

1. Clone the repository.
2. Install dependencies:
   `npm install`
3. Open the project in VS Code.
4. Press `F5` to run the extension in an Extension Development Host window.

## Project Structure

Key files and folders:

- `src/extension.ts`
  - Extension activation and registration of the webview provider.
  - Main backend entrypoint for VS Code integration.

- `src/providers/IntelliTestViewProvider.ts`
  - Core backend view logic: prompt handling, AI generation flow, export flow, and webview messaging.

- `src/services/groq.ts`
  - AI API integration layer (Groq) and structured JSON parsing.

- `src/services/techStack.ts`
  - Detects project technology stack from workspace files.

- `src/services/codebaseContext.ts`
  - Builds codebase context from scanned project file names.

- `src/services/codeInsights.ts`
  - Static AST-based code symbol extraction for JS/TS files.
  - Parses files using TypeScript Compiler API to extract functions (with parameters), classes (with methods), variables, and imports.
  - Analyzes up to 200KB per file; skips unsupported file types.

- `src/services/projectMap.ts`
  - Builds lightweight structured context payload for AI generation.
  - Detects file names mentioned in user prompts and prioritizes those files in the code insights.
  - Combines tech stack, routes, modules, and code symbols into a single payload sent to the backend.

- `src/services/backendClient.ts`
  - HTTP client for communicating with the backend `/generate-testcases` endpoint.
  - Maps server test case responses to UI-ready test case rows.

- `src/services/excel.ts`
  - Excel generation and file export using `xlsx`.

- `webview/`
  - Frontend sidebar UI assets.

- `webview/intellitest.html`
  - Sidebar layout and UI structure.

- `webview/intellitest.js`
  - Handles UI interactions and message passing with backend.

- `webview/intellitest.css`
  - VS Code-themed styling using theme variables.

- `package.json`
  - Extension manifest, contributions, scripts, and dependencies.

- `AI_CONTEXT.md`
  - Context file for AI tools and coding assistants.

Note: If you prefer naming like `webview/index.html`, `webview/script.js`, `webview/style.css`, this project currently uses `intellitest.html`, `intellitest.js`, and `intellitest.css` with the same roles.

## How It Works

1. User enters a prompt in the IntelliTest sidebar.
2. Extension detects the project tech stack.
3. **Codebase is scanned**: Static analysis extracts functions, classes, and variables from JS/TS files using the TypeScript Compiler API.
4. **Code context is built**: Project structure (routes, modules), code symbols, and detected priority files are packaged into a structured payload.
5. Request is sent to AI (Groq API) with prompt + comprehensive project context.
6. AI returns structured JSON test cases.
7. Results are displayed in the sidebar table preview with optional Excel export.

## Codebase Content Reading Feature

IntelliTest includes a **static code analysis engine** that extracts code symbols from your codebase and uses them to generate highly relevant test cases.

### What It Does

- **Scans JS/TS files** in your project workspace (respecting `.gitignore` and common ignore patterns).
- **Extracts code symbols** using TypeScript Compiler API:
  - Functions (with parameter names)
  - Classes (with method lists)
  - Variables (including exports)
  - Import statements
- **Displays Code Insights in sidebar** with collapsible file groups, per-file category shading, and pagination (8 files/page).
- **Prioritizes mentioned files**: When you write "passwordModal.js" in your prompt, symbols from that file are boosted to the top of the AI context.

### How It Works (Simple Flow)

```
User writes prompt (e.g., "Test passwordModal.js validation")
        ↓
Code scanner finds all JS/TS files in workspace
        ↓
AST parser extracts functions, classes, variables, imports
        ↓
⭐ File priority detection: "passwordModal.js" detected → move to top
        ↓
Code symbols shown in sidebar Code Insights panel
        ↓
Prioritized context sent to AI backend:
  - Project type, tech stack, framework
  - Routes and modules
  - Code symbols (prioritized files first)
  - User prompt
        ↓
AI generates focused test cases for priority files
```

### What Gets Sent to AI (Both File Names + Code Context)

The AI receives a structured project map containing:

| Component | Example | Purpose |
|-----------|---------|----------|
| **File Names** | `src/modals/passwordModal.js`, `src/services/auth.ts` | Understand project organization |
| **Code Symbols** | Functions: `validatePassword()`, `resetForm()`; Classes: `PasswordValidator`; Variables: `MIN_LENGTH`, `REGEX_PATTERN` | Generate test cases that exercise actual code paths |
| **Priority Files** | `["passwordModal.js"]` (detected from prompt) | Focus AI generation on user-specified files |
| **Framework/Language** | React, Vue, Express, JavaScript, TypeScript | Use appropriate testing patterns |
| **Project Structure** | Routes, modules, API endpoints | Understand application architecture |

### Example Code Context Sent to AI

```
⭐ src/modals/passwordModal.js -> functions: validatePassword, resetForm, handleSubmit | classes: PasswordValidator | variables: MIN_LENGTH, REGEX_PATTERN
src/services/authService.js -> functions: login, logout, refreshToken | classes: AuthManager
src/utils/validators.js -> functions: isEmail, isStrongPassword, sanitizeInput | variables: EMAIL_REGEX, PASSWORD_MIN_LENGTH
```

The **⭐** symbol marks priority files so the AI knows to generate test cases focusing on those files first.

### Code Insights Panel

- Access via "Code Insights" toggle in the IntelliTest sidebar
- Shows all discovered code symbols grouped by file
- Symbols are categorized: Functions (blue), Variables (green), Classes (purple)
- Click any function name to auto-populate it in your prompt
- Pagination: 8 files per page with numbered navigation buttons

## AI Integration

- Uses Groq API for LLM inference.
- Requires `GROQ_API_KEY`.
- Backend builds system and user prompts, requests structured JSON, and normalizes responses.

### API Key Setup

Set your key before running:

- Environment variable: `GROQ_API_KEY`

For local VS Code debugging, `.vscode/launch.json` can load environment variables from `.env`.

## Excel Export

- Uses `xlsx` library.
- Generates `.xlsx` files locally.
- Output filename format includes timestamp, for example:
  - `test_cases_DD-MM-YY_HH-MM-SS.xlsx`
- Export includes columns:
  - Test Case ID
  - Title
  - Description
  - Preconditions
  - Steps
  - Expected Result
  - Priority

## Configuration

- Required:
  - `GROQ_API_KEY`
- Recommended:
  - Keep `.env` local and out of source control.
  - Ensure your debug launch configuration loads your environment values.

## Development Notes

- Uses VS Code Webview API for sidebar UI.
- Frontend and backend communicate through message passing.
- Async operations are handled with `async/await`.
- Build command:
  - `npm run compile`
