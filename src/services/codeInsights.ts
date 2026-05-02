import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import ts from 'typescript';
import { listProjectRelativePaths } from './codebaseContext';
import type { CodeInsightClass, CodeInsightFile, CodeInsightsPayload } from '../types/codeInsights';

const SUPPORTED_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx']);
const MAX_FILE_SIZE_BYTES = 200 * 1024;

type CacheEntry = {
	payload: CodeInsightsPayload;
};

const cache = new Map<string, CacheEntry>();

function getScriptKind(filePath: string): ts.ScriptKind {
	if (filePath.endsWith('.tsx')) {
		return ts.ScriptKind.TSX;
	}
	if (filePath.endsWith('.ts')) {
		return ts.ScriptKind.TS;
	}
	if (filePath.endsWith('.jsx')) {
		return ts.ScriptKind.JSX;
	}
	return ts.ScriptKind.JS;
}

function getBindingNames(bindingName: ts.BindingName): string[] {
	if (ts.isIdentifier(bindingName)) {
		return [bindingName.text];
	}

	const names: string[] = [];
	for (const element of bindingName.elements) {
		if (ts.isBindingElement(element)) {
			names.push(...getBindingNames(element.name));
		}
	}
	return names;
}

function extractFromSourceFile(sourceFile: ts.SourceFile): Omit<CodeInsightFile, 'filePath'> {
	const functions: string[] = [];
	const variables: string[] = [];
	const classes: CodeInsightClass[] = [];
	const imports: string[] = [];

	for (const node of sourceFile.statements) {
		if (ts.isFunctionDeclaration(node) && node.name) {
			const params = node.parameters
				.map(parameter => {
					if (ts.isIdentifier(parameter.name)) {
						return parameter.name.text;
					}
					return 'param';
				})
				.join(', ');
			functions.push(`${node.name.text}(${params})`);
			continue;
		}

		if (ts.isVariableStatement(node)) {
			for (const declaration of node.declarationList.declarations) {
				variables.push(...getBindingNames(declaration.name));
			}
			continue;
		}

		if (ts.isClassDeclaration(node) && node.name) {
			const methods: string[] = [];
			for (const member of node.members) {
				if (ts.isMethodDeclaration(member) && member.name && ts.isIdentifier(member.name)) {
					methods.push(member.name.text);
				}
			}
			classes.push({
				name: node.name.text,
				methods
			});
			continue;
		}

		if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
			imports.push(node.moduleSpecifier.text);
		}
	}

	return { functions, variables, classes, imports };
}

async function analyzeFile(workspaceRootPath: string, relativePath: string): Promise<CodeInsightFile | null> {
	const absolutePath = path.join(workspaceRootPath, relativePath);
	const extension = path.extname(relativePath).toLowerCase();
	if (!SUPPORTED_EXTENSIONS.has(extension)) {
		return null;
	}

	let stat;
	try {
		stat = await fs.stat(absolutePath);
	} catch {
		return null;
	}

	if (!stat.isFile() || stat.size > MAX_FILE_SIZE_BYTES) {
		return null;
	}

	let text: string;
	try {
		text = await fs.readFile(absolutePath, 'utf8');
	} catch {
		return null;
	}

	try {
		const sourceFile = ts.createSourceFile(relativePath, text, ts.ScriptTarget.Latest, true, getScriptKind(relativePath));
		const extracted = extractFromSourceFile(sourceFile);
		if (
			extracted.functions.length === 0 &&
			extracted.variables.length === 0 &&
			extracted.classes.length === 0 &&
			extracted.imports.length === 0
		) {
			return null;
		}

		return {
			filePath: relativePath,
			...extracted
		};
	} catch {
		return null;
	}
}

export async function getCodeInsights(
	workspaceRootPath: string | undefined,
	forceRefresh = false
): Promise<CodeInsightsPayload> {
	if (!workspaceRootPath) {
		return { files: [], totalAnalyzedFiles: 0 };
	}

	const cached = !forceRefresh ? cache.get(workspaceRootPath) : undefined;
	if (cached) {
		return cached.payload;
	}

	const allPaths = listProjectRelativePaths(workspaceRootPath, 1000);
	const candidates = allPaths.filter(relativePath =>
		SUPPORTED_EXTENSIONS.has(path.extname(relativePath).toLowerCase())
	);

	const files: CodeInsightFile[] = [];
	for (const relativePath of candidates) {
		const result = await analyzeFile(workspaceRootPath, relativePath);
		if (result) {
			files.push(result);
		}
	}

	const payload: CodeInsightsPayload = {
		files,
		totalAnalyzedFiles: candidates.length
	};

	cache.set(workspaceRootPath, { payload });
	return payload;
}
