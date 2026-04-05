import * as fs from 'node:fs';
import * as path from 'node:path';

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

	const lines = ['Project files detected:', ...projectFiles.map(file => `- ${file}`)];
	return lines.join('\n');
}
