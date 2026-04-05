import * as fs from 'node:fs';
import * as path from 'node:path';
import axios from 'axios';
import * as vscode from 'vscode';

type WebviewMessage =
	| {
		command: 'generate';
		feature: string;
	}
	| {
		command: 'ready';
	};

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.3-70b-versatile';
const SYSTEM_PROMPT =
	'You are a senior QA engineer. Generate structured, concise, practical software test cases. Use clear sections and numbered test cases with title, preconditions, steps, and expected result.';

const ignoredFolders = new Set([
	'.git',
	'.vscode',
	'.venv',
	'venv',
	'env',
	'node_modules',
	'dist',
	'out',
	'build',
	'target',
	'coverage'
]);

function collectWorkspaceFiles(rootPath: string): string[] {
	const files: string[] = [];

	function walk(currentPath: string): void {
		for (const entry of fs.readdirSync(currentPath, { withFileTypes: true })) {
			if (entry.isDirectory()) {
				if (!ignoredFolders.has(entry.name)) {
					walk(path.join(currentPath, entry.name));
				}
				continue;
			}

			files.push(entry.name);
		}
	}

	walk(rootPath);
	return files;
}

async function detectTechStack(workspaceUri: vscode.Uri): Promise<string> {
	const rootPath = workspaceUri.fsPath;
	const files = collectWorkspaceFiles(rootPath);
	const detected: string[] = [];

	// Simple file-to-tech mapping
	const fileMap: Record<string, string> = {
		'package.json': 'Node.js',
		'pom.xml': 'Java (Maven)',
		'build.gradle': 'Java (Gradle)',
		'build.gradle.kts': 'Java (Gradle)',
		'requirements.txt': 'Python',
		'setup.py': 'Python',
		'pyproject.toml': 'Python',
		'Pipfile': 'Pipenv',
		'angular.json': 'Angular',
		'vite.config.js': 'Vite',
		'vite.config.ts': 'Vite',
		'Gemfile': 'Ruby',
		'composer.json': 'PHP',
		'go.mod': 'Go',
		'Cargo.toml': 'Rust',
		'Dockerfile': 'Docker',
		'docker-compose.yml': 'Docker',
		'docker-compose.yaml': 'Docker',
		'index.html': 'Web',
	};

	// Map files to techs
	for (const file of Object.keys(fileMap)) {
		if (files.includes(file)) {
			detected.push(fileMap[file]);
		}
	}

	// Check for .Net project files
	if (files.some(f => f.endsWith('.csproj') || f.endsWith('.fsproj'))) {
		detected.push('.NET');
	}

	// Check Rails alongside Ruby
	if (files.includes('Rakefile')) {
		detected.push('Rails');
	}

	// Deduplicate and return
	const stack = [...new Set(detected)].join(' + ');
	return stack || 'Unknown Tech Stack';
}

class IntelliTestViewProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = 'intellitestView';

	private readonly extensionUri: vscode.Uri;
	private detectedStack: string;
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
				void this.handleGenerate(message.feature);
			} else if (message.command === 'ready') {
				void webview.postMessage({
					command: 'init',
					detectedStack: this.detectedStack
				});
			}
		});

		webview.html = this.getHtml(webview);
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
					testCases = await this.generateTestCases(feature);
				}
			);

			this.postResult(testCases);
			void vscode.window.showInformationMessage('IntelliTest generated test cases successfully.');
		} catch (error) {
			this.postResult('Something went wrong while generating test cases. Please try again.');
			const errorMessage = axios.isAxiosError(error)
				? (error.response?.data?.error?.message ?? error.message)
				: String(error);
			void vscode.window.showErrorMessage(`IntelliTest generation failed: ${errorMessage}`);
		}
	}

	private async generateTestCases(feature: string): Promise<string> {
		const apiKey = process.env.GROQ_API_KEY?.trim().replace(/^['"]|['"]$/g, '') ?? '';

		if (!apiKey) {
			throw new Error('Missing GROQ_API_KEY environment variable.');
		}

		const finalUserPrompt = `Generate structured test cases for a ${feature} in a ${this.detectedStack} project.`;

		const response = await axios.post(
			GROQ_API_URL,
			{
				model: GROQ_MODEL,
				messages: [
					{ role: 'system', content: SYSTEM_PROMPT },
					{ role: 'user', content: finalUserPrompt }
				]
			},
			{
				headers: {
					Authorization: `Bearer ${apiKey}`,
					'Content-Type': 'application/json'
				}
			}
		);

		const content = response.data?.choices?.[0]?.message?.content;
		if (typeof content !== 'string' || !content.trim()) {
			throw new Error('Groq API returned an empty response.');
		}

		return content;
	}

	private postResult(testCases: string): void {
		void this.view?.webview.postMessage({
			command: 'result',
			testCases
		});
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

}

export async function activate(context: vscode.ExtensionContext) {
	console.log('IntelliTest extension activated');

	// Show welcome message
	void vscode.window.showInformationMessage('Welcome to IntelliTest! Generate test cases from feature descriptions.');

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
