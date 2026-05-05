import { listProjectRelativePaths } from './codebaseContext.js';
import { inferWebProjectCategory } from './projectCategory.js';

function inferLanguage(detectedStack: string): string {
	const s = detectedStack.toLowerCase();
	if (s.includes('python')) {
		return 'python';
	}
	if (s.includes('java')) {
		return 'java';
	}
	if (s.includes('go')) {
		return 'go';
	}
	if (s.includes('rust')) {
		return 'rust';
	}
	if (s.includes('ruby') || s.includes('rails')) {
		return 'ruby';
	}
	if (s.includes('php')) {
		return 'php';
	}
	if (s.includes('.net') || s.includes('csharp') || s.includes('c#')) {
		return 'csharp';
	}
	return 'javascript';
}

export function buildProjectMap(
	workspaceRootPath: string | undefined,
	detectedStack: string,
	userPrompt: string
): Record<string, string | string[]> {
	const paths = listProjectRelativePaths(workspaceRootPath, 400);
	const modules =
		paths.length > 0
			? [
					...new Set(
						paths
							.map((p: string) => p.split(/[/\\]/)[0])
							.filter((seg: string) => seg.length > 0 && !seg.startsWith('.'))
					)
				].slice(0, 40)
			: [];

	const routeHints = paths
		.filter(
			(p: string) =>
				/route|router|pages[/\\]|app[/\\]|api[/\\]|controller|endpoint/i.test(p) &&
				!p.includes('node_modules')
		)
		.slice(0, 60);

	const framework = detectedStack.trim() || 'Unknown stack';
	const projectKind = inferWebProjectCategory(workspaceRootPath, paths, userPrompt, detectedStack);

	return {
		type: projectKind,
		language: inferLanguage(detectedStack),
		framework,
		modules: modules as string[],
		routes: routeHints,
		prompt: userPrompt.trim()
	};
}
