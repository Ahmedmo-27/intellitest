import * as fs from 'node:fs';
import * as vscode from 'vscode';

type WebviewMessage = {
	command: 'generate';
	feature: string;
};

class IntelliTestViewProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = 'intellitestView';

	private readonly extensionUri: vscode.Uri;
	private view?: vscode.WebviewView;

	public constructor(extensionUri: vscode.Uri) {
		this.extensionUri = extensionUri;
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

		webview.html = this.getHtml(webview);
		webview.onDidReceiveMessage((message: WebviewMessage) => {
			if (message.command === 'generate') {
				void this.handleGenerate(message.feature);
			}
		});
	}

	private async handleGenerate(featureInput: string): Promise<void> {
		const feature = (featureInput ?? '').trim();

		if (!feature) {
			this.postResult('Please enter a feature description to generate test cases.');
			void vscode.window.showInformationMessage('Please enter a feature description first.');
			return;
		}

		let testCases = '';

		try {
			await vscode.window.withProgress(
				{
					location: vscode.ProgressLocation.Notification,
					title: 'Generating IntelliTest test cases',
					cancellable: false
				},
				async () => {
					await this.delay(300);
					testCases = this.buildTestCases(feature);
				}
			);

			this.postResult(testCases);
			void vscode.window.showInformationMessage('IntelliTest generated test cases successfully.');
		} catch (error) {
			this.postResult('Something went wrong while generating test cases. Please try again.');
			void vscode.window.showErrorMessage(`IntelliTest generation failed: ${String(error)}`);
		}
	}

	private postResult(testCases: string): void {
		void this.view?.webview.postMessage({
			command: 'result',
			testCases
		});
	}

	private buildTestCases(feature: string): string {
		return `Test Cases for "${feature}":\n1. Valid input\n2. Invalid input\n3. Empty fields\n4. Edge cases`;
	}

	private getHtml(webview: vscode.Webview): string {
		const templatePath = vscode.Uri.joinPath(this.extensionUri, 'webview', 'intellitest.html');
		const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'webview', 'intellitest.css'));
		const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'webview', 'intellitest.js'));
		const template = fs.readFileSync(templatePath.fsPath, 'utf8');

		return template
			.replace(/{{cspSource}}/g, webview.cspSource)
			.replace(/{{styleUri}}/g, styleUri.toString())
			.replace(/{{scriptUri}}/g, scriptUri.toString());
	}

	private delay(milliseconds: number): Promise<void> {
		return new Promise(resolve => setTimeout(resolve, milliseconds));
	}
}

export function activate(context: vscode.ExtensionContext) {
    console.log("IntelliTest extension activated");
    
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(
			IntelliTestViewProvider.viewType,
			new IntelliTestViewProvider(context.extensionUri)
		)
	);
}

export function deactivate() {}
