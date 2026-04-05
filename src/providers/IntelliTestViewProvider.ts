import * as vscode from 'vscode';
import { buildCodebaseContext } from '../services/codebaseContext';
import { generateTestCases } from '../services/groq';
import type { WebviewMessage } from '../types/messages';
import { getWebviewHtml } from '../webview/template';

export class IntelliTestViewProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = 'intellitestView';

	private readonly extensionUri: vscode.Uri;
	private readonly detectedStack: string;
	private view?: vscode.WebviewView;

	public constructor(extensionUri: vscode.Uri, detectedStack: string) {
		this.extensionUri = extensionUri;
		this.detectedStack = detectedStack;
	}

	public resolveWebviewView(webviewView: vscode.WebviewView): void {
		this.view = webviewView;
		const webview = webviewView.webview;

		webview.options = {
			enableScripts: true,
			localResourceRoots: [
				vscode.Uri.joinPath(this.extensionUri, 'media'),
				vscode.Uri.joinPath(this.extensionUri, 'webview')
			]
		};

		webview.onDidReceiveMessage((message: WebviewMessage) => {
			if (message.command === 'generate') {
				void this.handleGenerate(message.prompt);
			}

			if (message.command === 'ready') {
				void webview.postMessage({
					command: 'init',
					detectedStack: this.detectedStack
				});
			}
		});

		webview.html = getWebviewHtml(this.extensionUri, webview);
	}

	private async handleGenerate(promptInput: string): Promise<void> {
		const prompt = (promptInput ?? '').trim();

		if (!prompt) {
			this.postResult('Please enter a prompt to generate test cases.');
			void vscode.window.showInformationMessage('Please enter a prompt first.');
			return;
		}

		try {
			const workspaceRootPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
			const codebaseContext = buildCodebaseContext(workspaceRootPath);

			const testCases = await vscode.window.withProgress(
				{
					location: vscode.ProgressLocation.Notification,
					title: 'Generating IntelliTest test cases',
					cancellable: false
				},
				async () => generateTestCases(prompt, this.detectedStack, codebaseContext)
			);

			this.postResult(testCases);
			void vscode.window.showInformationMessage('IntelliTest generated test cases successfully.');
		} catch (error) {
			this.postResult('Something went wrong while generating test cases. Please try again.');
			const errorMessage = error instanceof Error ? error.message : String(error);
			void vscode.window.showErrorMessage(`IntelliTest generation failed: ${errorMessage}`);
		}
	}

	private postResult(testCases: string): void {
		void this.view?.webview.postMessage({
			command: 'result',
			testCases
		});
	}
}
