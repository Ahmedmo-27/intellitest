import * as fs from 'node:fs';
import * as vscode from 'vscode';

export function getWebviewHtml(extensionUri: vscode.Uri, webview: vscode.Webview): string {
	const templatePath = vscode.Uri.joinPath(extensionUri, 'webview', 'intellitest.html');
	const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'webview', 'intellitest.css'));
	const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'webview', 'intellitest.js'));
	const template = fs.readFileSync(templatePath.fsPath, 'utf8');

	return template
		.replace(/{{cspSource}}/g, webview.cspSource)
		.replace(/{{styleUri}}/g, styleUri.toString())
		.replace(/{{scriptUri}}/g, scriptUri.toString());
}
