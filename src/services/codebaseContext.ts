import * as fs from 'node:fs';
import * as path from 'node:path';

const MAX_FILES_IN_CONTEXT = 120;
const MAX_CONTEXT_CHARS = 3500;

/**
 * Keep rules aligned with `shouldIncludePathForFeatures` in
 * `Server/src/services/featureExtractionService.js` (feature sync payload).
 */
const NON_SOURCE_EXTENSIONS = new Set([
	'png',
	'apng',
	'jpg',
	'jpeg',
	'gif',
	'webp',
	'bmp',
	'ico',
	'svg',
	'pdf',
	'txt',
	'md',
	'markdown',
	'rtf',
	'woff',
	'woff2',
	'ttf',
	'otf',
	'eot',
	'mp4',
	'webm',
	'mov',
	'mp3',
	'wav',
	'zip',
	'tar',
	'gz',
	'tgz',
	'7z',
	'rar',
	'map',
	'lock',
	'sqlite',
	'db',
	'bin',
	'exe',
	'dll',
	'so',
	'dylib',
	'obj',
	'o',
	'a',
	'lib',
	'log',
	'csv',
	'xlsx',
	'xls',
	'ppt',
	'pptx',
	'doc',
	'docx',
	'json',
	'yml',
	'yaml',
	'xml',
	'avif',
	'heic'
]);

const NOISY_BASENAMES = new Set(['robots.txt', 'favicon.ico', '.ds_store']);

const STATIC_TOP_LEVEL_FOLDER = new Set([
	'public',
	'static',
	'assets',
	'www',
	'uploads',
	'media',
	'images',
	'img',
	'fonts',
	'fixtures'
]);

const CODE_PATH_LIKE =
	/route|router|pages\/|\/pages|\/app\/|^app\/|\/api\/|^api\/|controller|endpoint|\/src\/|^src\/|\/components\/|\/services\/|\/handlers\/|\/screens\/|\/layouts\/|\/views\/|\/widgets\/|\/models\/|\/schemas\/|\/server\/|\/client\/|\/lib\/|\/utils\/|repository\/|repos?\//i;

export function shouldIncludePathForFeatures(filePath: string): boolean {
	const norm = String(filePath).replace(/\\/g, '/').trim();
	if (!norm || norm.startsWith('.')) return false;

	const basename = norm.split('/').pop() || '';
	if (!basename || basename.startsWith('.')) return false;

	const baseLower = basename.toLowerCase();
	if (NOISY_BASENAMES.has(baseLower)) return false;

	const dot = basename.lastIndexOf('.');
	if (dot > 0) {
		const ext = basename.slice(dot + 1).toLowerCase();
		if (NON_SOURCE_EXTENSIONS.has(ext)) return false;
		return true;
	}

	return CODE_PATH_LIKE.test(norm);
}

/** Paths to send with POST /project/:id/sync (source-like only). */
export function filterPathsForFeatureSync(paths: string[]): string[] {
	return paths.filter(p => {
		const bareTopLevel =
			!p.includes('/') && !p.includes('\\') && !p.includes('.');
		if (bareTopLevel && STATIC_TOP_LEVEL_FOLDER.has(p.toLowerCase())) {
			return false;
		}
		return shouldIncludePathForFeatures(p);
	});
}

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
