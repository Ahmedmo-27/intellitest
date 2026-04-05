# IntelliTest

IntelliTest is a VS Code sidebar extension that generates starter test cases from a feature description.

## What It Does

- Adds an IntelliTest icon in the Activity Bar.
- Opens a sidebar webview with input + generate button.
- Sends the feature text from webview to extension backend.
- Simulates test case generation.
- Sends generated result back to webview and renders it.

## Technical Flow (Simple)

1. User opens the `IntelliTest` sidebar.
2. VS Code activates the extension via `onView:intellitestView`.
3. `IntelliTestViewProvider` loads webview HTML and injects CSS/JS URIs.
4. User clicks Generate in the webview.
5. Frontend JS posts `{ command: 'generate', feature }` to backend.
6. Backend runs generation logic with progress notification.
7. Backend posts `{ command: 'result', testCases }` back to webview.
8. Frontend receives result, updates output, and stops loading state.

## Files and Responsibilities

- `src/extension.ts`
  - Extension entry point and backend logic.
  - Registers `WebviewViewProvider`.
  - Handles webview messages and generation flow.

- `webview/intellitest.html`
  - Sidebar UI structure (input, button, output).

- `webview/intellitest.css`
  - Sidebar styling.

- `webview/intellitest.js`
  - Frontend behavior:
  - button click and Enter handling
  - loading state updates
  - message send/receive with backend

- `media/intellitest.svg`
  - Activity Bar icon.

- `package.json`
  - Contribution points:
  - Activity Bar container
  - Sidebar view (`intellitestView`)
  - Activation event (`onView:intellitestView`)

## Main Class and Functions

### Class: `IntelliTestViewProvider`

- `resolveWebviewView(webviewView)`
  - Configures webview options.
  - Loads HTML template.
  - Listens to frontend messages.

- `handleGenerate(featureInput)`
  - Validates input.
  - Runs progress UI.
  - Builds result text.
  - Sends result to webview.

- `postResult(testCases)`
  - Sends backend response to the webview.

- `buildTestCases(feature)`
  - Returns simulated test cases string.

- `getHtml(webview)`
  - Reads HTML template from disk.
  - Injects webview-safe CSS/JS URIs.

- `delay(milliseconds)`
  - Small async delay for simulated processing.

### Extension Lifecycle

- `activate(context)`
  - Registers `IntelliTestViewProvider`.

- `deactivate()`
  - No-op cleanup hook.

## Run Locally (Initial Setup)

Use these steps the first time you run the extension on your machine.

1. Open the project folder in VS Code.
2. Install dependencies:
  - `npm i`
3. Start the extension in a new Extension Development Host window:
  - Press `F5` (Run Extension from `.vscode/launch.json`).
  - VS Code runs the pre-launch build task automatically.
4. In the new window, click IntelliTest in the Activity Bar and use the sidebar.

## Daily Development Run

1. Start TypeScript watch mode:
  - `npm run watch`
2. Press `F5` to launch the Extension Development Host.
3. After code changes, reload the host window to pick up updates.

## Current Behavior Notes

- Generation is simulated (no external API yet).
- Empty input returns a friendly message.
- Success and progress notifications are shown by backend.
