import * as vscode from 'vscode';
import { IntelliTestViewProvider } from './providers/IntelliTestViewProvider.js';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(
			IntelliTestViewProvider.viewType,
			new IntelliTestViewProvider(context, context.extensionUri)
		)
	);
}

export function deactivate(): void {}
