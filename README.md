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
3. Request is sent to AI (Groq API) with prompt + project context.
4. AI returns structured JSON test cases.
5. Results are displayed in the sidebar table preview.
6. User can export generated test cases to Excel.

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
