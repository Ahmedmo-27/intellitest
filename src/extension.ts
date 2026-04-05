import * as vscode from 'vscode';
import { IntelliTestViewProvider } from './providers/IntelliTestViewProvider';
import { detectTechStack } from './services/techStack';

export async function activate(context: vscode.ExtensionContext) {
	console.log('IntelliTest extension activated');

	// Show welcome message
	void vscode.window.showInformationMessage('Welcome to IntelliTest! Generate test cases from prompts.');

	// Detect tech stack from workspace
	const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
	let detectedStack = 'Unknown Tech Stack';

	if (workspaceFolder) {
		detectedStack = await detectTechStack(workspaceFolder.uri);
		console.log(`Detected tech stack: ${detectedStack}`);
		void vscode.window.showInformationMessage(`IntelliTest detected: ${detectedStack}`);
	}

	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(
			IntelliTestViewProvider.viewType,
			new IntelliTestViewProvider(context.extensionUri, detectedStack)
		)
	);
}

export function deactivate() {}
