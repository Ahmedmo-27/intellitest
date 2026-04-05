import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vscode from 'vscode';

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

export async function detectTechStack(workspaceUri: vscode.Uri): Promise<string> {
	const rootPath = workspaceUri.fsPath;
	const files = collectWorkspaceFiles(rootPath);
	const detected: string[] = [];

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

	for (const file of Object.keys(fileMap)) {
		if (files.includes(file)) {
			detected.push(fileMap[file]);
		}
	}

	if (files.some(file => file.endsWith('.csproj') || file.endsWith('.fsproj'))) {
		detected.push('.NET');
	}

	if (files.includes('Rakefile')) {
		detected.push('Rails');
	}

	const stack = [...new Set(detected)].join(' + ');
	return stack || 'Unknown Tech Stack';
}
