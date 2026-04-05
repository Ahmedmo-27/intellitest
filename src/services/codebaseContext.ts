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

const importantFileNames = new Set([
	'package.json',
	'requirements.txt',
	'pyproject.toml',
	'setup.py',
	'pom.xml',
	'build.gradle',
	'build.gradle.kts',
	'Cargo.toml',
	'go.mod',
	'Dockerfile',
	'docker-compose.yml',
	'docker-compose.yaml',
	'tsconfig.json',
	'README.md'
]);

const sourceExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.go', '.rs', '.cs']);

function shouldIncludeFile(fileName: string): boolean {
	return importantFileNames.has(fileName) || sourceExtensions.has(path.extname(fileName));
}

function collectCandidateFiles(rootPath: string): string[] {
	const collected: string[] = [];

	function walk(currentPath: string): void {
		for (const entry of fs.readdirSync(currentPath, { withFileTypes: true })) {
			if (collected.length >= 12) {
				return;
			}

			if (entry.isDirectory()) {
				if (!ignoredFolders.has(entry.name)) {
					walk(path.join(currentPath, entry.name));
				}
				continue;
			}

			if (shouldIncludeFile(entry.name)) {
				collected.push(path.join(currentPath, entry.name));
			}
		}
	}

	walk(rootPath);
	return collected;
}

function readFilePreview(filePath: string): string {
	const text = fs.readFileSync(filePath, 'utf8');
	const lines = text.split(/\r?\n/).slice(0, 40).join('\n');
	return lines.length > 1200 ? `${lines.slice(0, 1200)}\n...` : lines;
}

export function buildCodebaseContext(workspaceRootPath: string | undefined): string {
	if (!workspaceRootPath || !fs.existsSync(workspaceRootPath)) {
		return 'No workspace context available.';
	}

	const candidateFiles = collectCandidateFiles(workspaceRootPath);
	if (candidateFiles.length === 0) {
		return 'No relevant project files were found for context.';
	}

	const sections: string[] = [];
	for (const absoluteFilePath of candidateFiles) {
		const relativeFilePath = path.relative(workspaceRootPath, absoluteFilePath);
		try {
			const preview = readFilePreview(absoluteFilePath);
			sections.push(`File: ${relativeFilePath}\n${preview}`);
		} catch {
			sections.push(`File: ${relativeFilePath}\n[Unable to read file preview]`);
		}
	}

	const context = sections.join('\n\n---\n\n');
	return context.length > 8000 ? `${context.slice(0, 8000)}\n\n...[truncated]` : context;
}
