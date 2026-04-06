import * as fs from 'node:fs';
import * as path from 'node:path';

const MAX_FILES_IN_CONTEXT = 120;
const MAX_CONTEXT_CHARS = 3500;

const ignoredFolders = new Set([
	'.git',
	'.vscode',
	'.venv',
	'venv',
	'env',
	'node_modules',
	'vendor',
	'dist',
	'out',
	'build',
	'target',
	'coverage',
	'.next',
	'.nuxt',
	'.cache',
	'tmp',
	'temp',
	'logs'
]);

export function listProjectRelativePaths(
	workspaceRootPath: string | undefined,
	maxFiles = 500
): string[] {
	if (!workspaceRootPath || !fs.existsSync(workspaceRootPath)) {
		return [];
	}
	return collectProjectFileNames(workspaceRootPath).slice(0, maxFiles);
}

function collectProjectFileNames(rootPath: string): string[] {
	const fileNames: string[] = [];

	function walk(currentPath: string): void {
		for (const entry of fs.readdirSync(currentPath, { withFileTypes: true })) {
			if (entry.isDirectory()) {
				if (!ignoredFolders.has(entry.name)) {
					walk(path.join(currentPath, entry.name));
				}
				continue;
			}

			fileNames.push(path.relative(rootPath, path.join(currentPath, entry.name)));
		}
	}

	walk(rootPath);
	fileNames.sort();
	return fileNames;
}

export function buildCodebaseContext(workspaceRootPath: string | undefined): string {
	if (!workspaceRootPath || !fs.existsSync(workspaceRootPath)) {
		return 'No workspace context available.';
	}

	const projectFiles = collectProjectFileNames(workspaceRootPath);
	if (projectFiles.length === 0) {
		return 'No project files were found for context.';
	}

	const selectedFiles = projectFiles.slice(0, MAX_FILES_IN_CONTEXT);
	const lines = ['Project files detected:', ...selectedFiles.map(file => `- ${file}`)];

	let context = lines.join('\n');
	if (context.length > MAX_CONTEXT_CHARS) {
		context = `${context.slice(0, MAX_CONTEXT_CHARS)}\n...[truncated]`;
	}

	return context;
}
