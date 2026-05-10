import * as vscode from 'vscode';

const MAX_TOTAL_CHARS = 14_000;

/** Relative paths (repo root) worth embedding into code-gen prompts. */
const ENV_EXAMPLE_CANDIDATES = [
	'.env.example',
	'.env.sample',
	'example.env',
	'.env.local.example',
	'client/.env.example',
	'web/.env.example',
	'apps/web/.env.example',
	'server/.env.example'
];

/**
 * Reads non-secret env templates from the workspace so the LLM can align URLs and keys
 * with what the project already documents.
 */
export async function collectLocalConfigHints(workspaceRootPath: string | undefined): Promise<string | undefined> {
	if (!workspaceRootPath?.trim()) {
		return undefined;
	}
	const rootUri = vscode.Uri.file(workspaceRootPath.trim());
	const decoder = new TextDecoder('utf-8');
	const chunks: string[] = [];
	let total = 0;

	for (const rel of ENV_EXAMPLE_CANDIDATES) {
		if (total >= MAX_TOTAL_CHARS) {
			break;
		}
		try {
			const uri = vscode.Uri.joinPath(rootUri, ...rel.split('/'));
			const raw = await vscode.workspace.fs.readFile(uri);
			const text = decoder.decode(raw).trim();
			if (!text) {
				continue;
			}
			const header = `\n### ${rel}\n`;
			const slice = text.slice(0, MAX_TOTAL_CHARS - total - header.length);
			chunks.push(`${header}\`\`\`\n${slice}\n\`\`\``);
			total += header.length + slice.length + 8;
		} catch {
			/* file missing */
		}
	}

	return chunks.length ? chunks.join('\n').trim() : undefined;
}
