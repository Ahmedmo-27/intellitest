import * as vscode from 'vscode';
import { generateViaBackendV2, loadProjectSession, syncProject } from '../services/backendClient.js';
import {
	clearStoredToken,
	fetchSessionUser,
	getStoredToken,
	loginRequest,
	saveToken,
	signupRequest
} from '../services/authSession.js';
import { UnauthorizedApiError } from '../errors/unauthorized.js';
import { getCodeInsights } from '../services/codeInsights.js';
import { exportTestCasesToExcel } from '../services/excel.js';
import { detectTechStack } from '../services/techStack.js';
import { detectRecommendedTestingFramework } from '../services/testingFramework.js';
import type { IntelliGenerationResult } from '../types/testCases.js';
import { sanitizeTestFilename } from '../utils/testScriptNormalize.js';
import type { WebviewMessage } from '../types/messages.js';
import { getWebviewHtml } from '../webview/template.js';
import { getOrCreateProjectId } from '../utils/projectId.js';
import { listProjectRelativePaths } from '../services/codebaseContext.js';

const EMPTY_GENERATION: IntelliGenerationResult = {
	recommendedTestingFramework: 'Not generated yet',
	testCases: [],
	testScript: null
};

export class IntelliTestViewProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = 'intellitestView';

	private readonly extensionUri: vscode.Uri;
	private readonly extensionContext: vscode.ExtensionContext;
	/** Populated after sign-in via workspace scan — never advertised before auth. */
	private detectedStack = 'Unknown Tech Stack';
	/** Test runner(s) inferred from project files (package.json, etc.). */
	private recommendedTestingFramework = 'Not detected yet';
	private view?: vscode.WebviewView;
	private latestGenerated: IntelliGenerationResult = EMPTY_GENERATION;

	/** Stable per-workspace identifier — generated once, persisted across restarts. */
	private readonly projectId: string;

	/** In-memory JWT for this extension session; cleared on logout or invalid token. */
	private authToken?: string;

	public constructor(context: vscode.ExtensionContext, extensionUri: vscode.Uri) {
		this.extensionContext = context;
		this.extensionUri = extensionUri;
		this.projectId = getOrCreateProjectId(context);
	}

	private async hydrateWorkspaceSignalsFromFolder(): Promise<void> {
		const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
		if (!workspaceFolder) {
			return;
		}
		this.detectedStack = await detectTechStack(workspaceFolder.uri);
		this.recommendedTestingFramework =
			detectRecommendedTestingFramework(workspaceFolder.uri.fsPath) || this.recommendedTestingFramework;
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
				case 'syncProject':
					void this.handleSyncProject();
					break;
				case 'exportExcel':
					void this.handleExportExcel();
					break;
				case 'copyTestScript':
					void this.handleCopyTestScript(message.code);
					break;
				case 'saveTestScript':
					void this.handleSaveTestScript(message.filename, message.code);
					break;
				case 'ready':
					void this.handleWebviewReady();
					break;
				case 'login':
					void this.handleAuthLogin(message.email, message.password);
					break;
				case 'signup':
					void this.handleAuthSignup(message.name, message.email, message.password);
					break;
				case 'logout':
					void this.handleLogout();
					break;
				case 'retryAuth':
					void this.handleWebviewReady();
					break;
				case 'refreshCodeInsights':
					void this.postCodeInsights(true);
					break;
			}
		});

		webview.html = getWebviewHtml(this.extensionUri, webview);
	}

	private getBackendUrl(): string {
		return vscode.workspace.getConfiguration('intellitest').get<string>('backendUrl')?.trim() ?? '';
	}

	// ── Auth bootstrap ─────────────────────────────────────────────────────────────

	private async handleWebviewReady(): Promise<void> {
		const wv = this.view?.webview;
		if (!wv) {
			return;
		}

		void wv.postMessage({ command: 'authBusy', busy: false });

		const backendUrl = this.getBackendUrl();
		if (!backendUrl) {
			this.authToken = undefined;
			void wv.postMessage({
				command: 'authState',
				authenticated: false,
				needsBackendUrl: true
			});
			return;
		}

		const stored = await getStoredToken(this.extensionContext);
		this.authToken = stored;

		if (!stored) {
			void wv.postMessage({
				command: 'authState',
				authenticated: false,
				needsBackendUrl: false
			});
			return;
		}

		try {
			const user = await fetchSessionUser(backendUrl, stored);
			if (!user) {
				await clearStoredToken(this.extensionContext);
				this.authToken = undefined;
				void wv.postMessage({
					command: 'authState',
					authenticated: false,
					needsBackendUrl: false
				});
				return;
			}

			void wv.postMessage({
				command: 'authState',
				authenticated: true,
				user
			});
			await this.bootstrapAuthenticatedExperience();
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			console.warn(`IntelliTest: session bootstrap failed — ${msg}`);
			this.authToken = undefined;
			void wv.postMessage({
				command: 'authState',
				authenticated: false,
				needsBackendUrl: false,
				bootstrapError:
					'Could not reach the IntelliTest server to verify your account. Check that the backend is running and intellitest.backendUrl is correct, then use Retry below.'
			});
		}
	}

	private async handleAuthLogin(email: string, password: string): Promise<void> {
		const wv = this.view?.webview;
		const backendUrl = this.getBackendUrl();
		if (!wv) {
			return;
		}

		void wv.postMessage({ command: 'authBusy', busy: true });
		void wv.postMessage({ command: 'authErrorClear' });

		if (!backendUrl) {
			void wv.postMessage({
				command: 'authError',
				message: 'Configure intellitest.backendUrl in Settings first.'
			});
			void wv.postMessage({ command: 'authBusy', busy: false });
			return;
		}

		try {
			const { token, user } = await loginRequest(backendUrl, email, password);
			await saveToken(this.extensionContext, token);
			this.authToken = token;
			void wv.postMessage({
				command: 'authState',
				authenticated: true,
				user
			});
			await this.bootstrapAuthenticatedExperience();
		} catch (err) {
			const m = err instanceof Error ? err.message : String(err);
			void wv.postMessage({ command: 'authError', message: m });
		} finally {
			void wv.postMessage({ command: 'authBusy', busy: false });
		}
	}

	private async handleAuthSignup(name: string, email: string, password: string): Promise<void> {
		const wv = this.view?.webview;
		const backendUrl = this.getBackendUrl();
		if (!wv) {
			return;
		}

		void wv.postMessage({ command: 'authBusy', busy: true });
		void wv.postMessage({ command: 'authErrorClear' });

		if (!backendUrl) {
			void wv.postMessage({
				command: 'authError',
				message: 'Configure intellitest.backendUrl in Settings first.'
			});
			void wv.postMessage({ command: 'authBusy', busy: false });
			return;
		}

		try {
			const { token, user } = await signupRequest(backendUrl, name, email, password);
			await saveToken(this.extensionContext, token);
			this.authToken = token;
			void wv.postMessage({
				command: 'authState',
				authenticated: true,
				user
			});
			await this.bootstrapAuthenticatedExperience();
		} catch (err) {
			const m = err instanceof Error ? err.message : String(err);
			void wv.postMessage({ command: 'authError', message: m });
		} finally {
			void wv.postMessage({ command: 'authBusy', busy: false });
		}
	}

	private async handleLogout(): Promise<void> {
		await clearStoredToken(this.extensionContext);
		this.authToken = undefined;
		this.latestGenerated = EMPTY_GENERATION;

		const backendUrl = this.getBackendUrl();
		void this.view?.webview.postMessage({
			command: 'authState',
			authenticated: false,
			needsBackendUrl: !backendUrl
		});
		void this.view?.webview.postMessage({ command: 'resetMainUi' });
	}

	private async clearSessionDueToUnauthorized(): Promise<void> {
		await clearStoredToken(this.extensionContext);
		this.authToken = undefined;
		this.latestGenerated = EMPTY_GENERATION;

		void vscode.window.showWarningMessage(
			'IntelliTest: Your session expired or was revoked. Please sign in again.'
		);
		void this.view?.webview.postMessage({
			command: 'authState',
			authenticated: false,
			needsBackendUrl: !this.getBackendUrl()
		});
		void this.view?.webview.postMessage({ command: 'resetMainUi' });
	}

	private async bootstrapAuthenticatedExperience(): Promise<void> {
		const wv = this.view?.webview;
		if (!wv || !this.authToken) {
			return;
		}

		await this.hydrateWorkspaceSignalsFromFolder();

		void wv.postMessage({
			command: 'init',
			detectedStack: this.detectedStack,
			recommendedTestingFramework: this.recommendedTestingFramework,
			projectId: this.projectId
		});

		await this.loadAndPostSession();
		void this.handleSyncProject(true);
		void this.postCodeInsights();
	}

	// ── Session loading ──────────────────────────────────────────────────────────

	/**
	 * Fetch previous session from /project/:projectId/init and push it to the webview.
	 */
	private async loadAndPostSession(): Promise<void> {
		const backendUrl = this.getBackendUrl();
		if (!backendUrl || !this.authToken) {
			return;
		}

		try {
			const session = await loadProjectSession(backendUrl, this.projectId, this.authToken);
			if (!session) {
				return;
			}

			void this.view?.webview.postMessage({
				command: 'sessionLoaded',
				projectId: this.projectId,
				messages: session.messages,
				context: session.context,
				features: session.features
			});
		} catch (err) {
			if (err instanceof UnauthorizedApiError) {
				await this.clearSessionDueToUnauthorized();
				return;
			}
			const msg = err instanceof Error ? err.message : String(err);
			console.warn(`IntelliTest: could not load previous session — ${msg}`);
		}
	}

	// ── Sync Project ─────────────────────────────────────────────────────────────

	private async handleSyncProject(silent = false): Promise<void> {
		const backendUrl = this.getBackendUrl();
		if (!backendUrl || !this.authToken) {
			if (!silent) {
				void vscode.window.showErrorMessage('Please sign in and configure IntelliTest Backend URL in settings.');
			}
			return;
		}

		const workspaceRootPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
		if (!workspaceRootPath) {
			return;
		}

		const allFiles = listProjectRelativePaths(workspaceRootPath, 2000);

		if (silent) {
			try {
				await syncProject(backendUrl, this.projectId, allFiles, this.authToken);
			} catch (err) {
				if (err instanceof UnauthorizedApiError) {
					await this.clearSessionDueToUnauthorized();
				}
			}
			return;
		}

		void vscode.window.withProgress(
			{
				location: vscode.ProgressLocation.Notification,
				title: 'IntelliTest: Building Global Intelligence Graph...',
				cancellable: false
			},
			async () => {
				try {
					const success = await syncProject(backendUrl, this.projectId, allFiles, this.authToken);
					if (success) {
						void vscode.window.showInformationMessage(
							'IntelliTest: Global Knowledge Graph successfully rebuilt! The backend is now fully aware of all your new files and dependencies.'
						);
					} else {
						void vscode.window.showErrorMessage(
							'IntelliTest: Failed to sync project map. Check backend server logs.'
						);
					}
				} catch (err) {
					if (err instanceof UnauthorizedApiError) {
						await this.clearSessionDueToUnauthorized();
					} else {
						void vscode.window.showErrorMessage('IntelliTest: Failed to sync project map. Check backend server logs.');
					}
				}
			}
		);
	}

	// ── Generate ─────────────────────────────────────────────────────────────────

	private async handleGenerate(promptInput: string): Promise<void> {
		const prompt = (promptInput ?? '').trim();

		if (!prompt) {
			this.latestGenerated = EMPTY_GENERATION;
			this.postResult(this.latestGenerated);
			void vscode.window.showInformationMessage('Please enter a prompt first.');
			return;
		}

		const backendUrl = this.getBackendUrl();
		if (!backendUrl) {
			void vscode.window.showErrorMessage(
				'IntelliTest: set intellitest.backendUrl in Settings (e.g. http://localhost:3000).'
			);
			return;
		}

		if (!this.authToken) {
			void vscode.window.showErrorMessage('IntelliTest: Please sign in from the sidebar to generate test cases.');
			return;
		}

		try {
			const workspaceRootPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

			this.latestGenerated = await vscode.window.withProgress(
				{
					location: vscode.ProgressLocation.Notification,
					title: 'IntelliTest: generating test cases…',
					cancellable: false
				},
				async () =>
					generateViaBackendV2(
						backendUrl,
						this.projectId,
						workspaceRootPath,
						this.detectedStack,
						prompt,
						this.authToken
					)
			);

			this.recommendedTestingFramework =
				detectRecommendedTestingFramework(workspaceRootPath) || this.recommendedTestingFramework;

			this.postResult(this.latestGenerated);

			void vscode.window.showInformationMessage('IntelliTest: test cases are ready in the panel.');
		} catch (error) {
			if (error instanceof UnauthorizedApiError) {
				await this.clearSessionDueToUnauthorized();
				return;
			}
			const errorMessage = error instanceof Error ? error.message : String(error);
			void vscode.window.showErrorMessage(`IntelliTest generation failed: ${errorMessage}`);
		}
	}

	// ── Clipboard / file ops ──────────────────────────────────────────────────────

	private async handleCopyTestScript(code: string): Promise<void> {
		if (!code?.trim()) {
			return;
		}
		await vscode.env.clipboard.writeText(code);
		void vscode.window.showInformationMessage('Test script copied to clipboard.');
	}

	private async handleSaveTestScript(filename: string, code: string): Promise<void> {
		const trimmed = code?.trim();
		if (!trimmed) {
			return;
		}

		const folder = vscode.workspace.workspaceFolders?.[0];
		if (!folder) {
			void vscode.window.showErrorMessage('Open a folder workspace to save the test script.');
			return;
		}

		const safeName = sanitizeTestFilename(filename || 'generated.test.js');
		const testsDir = vscode.Uri.joinPath(folder.uri, 'tests');

		try {
			try {
				await vscode.workspace.fs.stat(testsDir);
			} catch {
				await vscode.workspace.fs.createDirectory(testsDir);
			}

			const target = vscode.Uri.joinPath(testsDir, safeName);
			await vscode.workspace.fs.writeFile(target, new TextEncoder().encode(trimmed));

			void vscode.window.showInformationMessage(`Saved test script to ${target.fsPath}`);

			const doc = await vscode.workspace.openTextDocument(target);
			await vscode.window.showTextDocument(doc);
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			void vscode.window.showErrorMessage(`Could not save test script: ${msg}`);
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

	// ── Post-to-webview helpers ───────────────────────────────────────────────────

	private postResult(generated: IntelliGenerationResult): void {
		void this.view?.webview.postMessage({
			command: 'result',
			testCases: generated.testCases,
			recommendedTestingFramework: this.recommendedTestingFramework,
			testScript: null
		});
	}

	private postExportStatus(isExporting: boolean): void {
		void this.view?.webview.postMessage({
			command: 'exportStatus',
			isExporting
		});
	}

	private async postCodeInsights(forceRefresh = false): Promise<void> {
		try {
			const workspaceRootPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
			const insights = await getCodeInsights(workspaceRootPath, forceRefresh);

			void this.view?.webview.postMessage({
				command: 'codeInsights',
				files: insights.files,
				totalAnalyzedFiles: insights.totalAnalyzedFiles
			});
		} catch {
			void this.view?.webview.postMessage({
				command: 'codeInsights',
				files: [],
				totalAnalyzedFiles: 0
			});
		}
	}
}
