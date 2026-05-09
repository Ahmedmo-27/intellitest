import * as vscode from 'vscode';
import { DebuggoViewProvider } from './providers/DebuggoViewProvider.js';
import { detectRecommendedTestingFramework } from './services/testingFramework.js';
import { detectTechStack } from './services/techStack.js';

export async function activate(context: vscode.ExtensionContext) {
	console.log('Debuggo extension activated');

	// Show welcome message
	void vscode.window.showInformationMessage('Welcome to Debuggo! Generate test cases from prompts.');

	// Detect tech stack from workspace
	const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
	let detectedStack = 'Unknown Tech Stack';

	let recommendedTestingFramework = 'Not detected yet';
	if (workspaceFolder) {
		detectedStack = await detectTechStack(workspaceFolder.uri);
		recommendedTestingFramework = detectRecommendedTestingFramework(workspaceFolder.uri.fsPath);
		console.log(`Detected tech stack: ${detectedStack}`);
		void vscode.window.showInformationMessage(`Debuggo detected: ${detectedStack}`);
	}

	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(
			DebuggoViewProvider.viewType,
			// Pass context so the provider can persist projectId in workspaceState
			new DebuggoViewProvider(context, context.extensionUri, detectedStack, recommendedTestingFramework)
		)
	);
}

export function deactivate() {}
