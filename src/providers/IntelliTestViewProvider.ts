import * as vscode from 'vscode';
import { buildCodebaseContext } from '../services/codebaseContext';
import { exportTestCasesToExcel } from '../services/excel';
import { generateTestCases } from '../services/groq';
import type { GeneratedTestCases } from '../types/testCases';
import type { WebviewMessage } from '../types/messages';
import { getWebviewHtml } from '../webview/template';

const EMPTY_GENERATION: GeneratedTestCases = {
	recommendedTestingFramework: 'Not generated yet',
	testCases: []
};

export class IntelliTestViewProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = 'intellitestView';

	private readonly extensionUri: vscode.Uri;
	private readonly detectedStack: string;
	private view?: vscode.WebviewView;
	private latestGenerated: GeneratedTestCases = EMPTY_GENERATION;

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
			switch (message.command) {
				case 'generate':
					void this.handleGenerate(message.prompt);
					break;
				case 'exportExcel':
					void this.handleExportExcel();
					break;
				case 'ready':
					void webview.postMessage({
						command: 'init',
						detectedStack: this.detectedStack
					});
					break;
			}
		});

		webview.html = getWebviewHtml(this.extensionUri, webview);
	}

	private async handleGenerate(promptInput: string): Promise<void> {
		const prompt = (promptInput ?? '').trim();

		if (!prompt) {
			this.latestGenerated = EMPTY_GENERATION;
			this.postResult(this.latestGenerated);
			void vscode.window.showInformationMessage('Please enter a prompt first.');
			return;
		}

		try {
			const workspaceRootPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
			const codebaseContext = buildCodebaseContext(workspaceRootPath);

			this.latestGenerated = await vscode.window.withProgress(
				{
					location: vscode.ProgressLocation.Notification,
					title: 'Generating IntelliTest test cases',
					cancellable: false
				},
				async () => generateTestCases(prompt, this.detectedStack, codebaseContext)
			);

			this.postResult(this.latestGenerated);
			void vscode.window.showInformationMessage('IntelliTest generated test cases successfully.');
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			void vscode.window.showErrorMessage(`IntelliTest generation failed: ${errorMessage}`);
		}
	}

	private async handleExportExcel(): Promise<void> {
		this.postExportStatus(true);

		if (this.latestGenerated.testCases.length === 0) {
			void vscode.window.showWarningMessage('No generated test cases available to export.');
			this.postExportStatus(false);
			return;
		}

		try {
			const workspaceRootPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
			const outputUri = await exportTestCasesToExcel(this.latestGenerated.testCases, workspaceRootPath);

			const action = await vscode.window.showInformationMessage(
				'Excel file generated successfully',
				'Open Folder'
			);

			if (action === 'Open Folder') {
				await vscode.commands.executeCommand('revealFileInOS', outputUri);
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			if (errorMessage.includes('cancelled')) {
				return;
			}
			void vscode.window.showErrorMessage(`Excel export failed: ${errorMessage}`);
		} finally {
			this.postExportStatus(false);
		}
	}

	private postResult(generated: GeneratedTestCases): void {
		void this.view?.webview.postMessage({
			command: 'result',
			testCases: generated.testCases,
			recommendedTestingFramework: generated.recommendedTestingFramework
		});
	}

	private postExportStatus(isExporting: boolean): void {
		void this.view?.webview.postMessage({
			command: 'exportStatus',
			isExporting
		});
	}
}
