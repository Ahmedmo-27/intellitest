const vscode = acquireVsCodeApi();

const input = document.getElementById('promptInput');
const button = document.getElementById('generateButton');
const exportButton = document.getElementById('exportButton');
const techStackEl = document.getElementById('techStack');
const stackTextEl = document.getElementById('stackText');
const frameworkEl = document.getElementById('framework');
const previewBody = document.getElementById('previewBody');
const scriptSection = document.getElementById('scriptSection');
const scriptMeta = document.getElementById('scriptMeta');
const scriptPre = document.getElementById('scriptPre');
const copyScriptButton = document.getElementById('copyScriptButton');
const saveScriptButton = document.getElementById('saveScriptButton');
const scriptUiEnabled = Boolean(scriptSection && copyScriptButton && saveScriptButton);
const defaultButtonText = button.textContent;
const defaultExportButtonText = exportButton.textContent;
let hasGeneratedRows = false;
let isExporting = false;
/** @type {{ filename: string, code: string } | null} */
let currentScript = null;

function setLoading(isLoading) {
	button.disabled = isLoading;
	button.textContent = isLoading ? 'Generating...' : defaultButtonText;
}

function updateExportButton() {
	exportButton.disabled = !hasGeneratedRows || isExporting;
	exportButton.textContent = isExporting ? 'Exporting...' : defaultExportButtonText;
}

function escapeHtml(value) {
	return String(value ?? '')
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;');
}

function renderTable(testCases) {
	if (!Array.isArray(testCases) || testCases.length === 0) {
		previewBody.innerHTML = '<tr><td colspan="7" class="empty-row">No test cases generated yet.</td></tr>';
		hasGeneratedRows = false;
		updateExportButton();
		return;
	}

	const rows = testCases.map(testCase => {
		return `
			<tr>
				<td>${escapeHtml(testCase.testCaseId)}</td>
				<td>${escapeHtml(testCase.title)}</td>
				<td>${escapeHtml(testCase.description)}</td>
				<td>${escapeHtml(testCase.preconditions)}</td>
				<td>${escapeHtml(testCase.steps)}</td>
				<td>${escapeHtml(testCase.expectedResult)}</td>
				<td>${escapeHtml(testCase.priority)}</td>
			</tr>
		`;
	}).join('');

	previewBody.innerHTML = rows;
	hasGeneratedRows = true;
	updateExportButton();
}

/** @param {unknown} testScript */
function renderTestScript(testScript) {
	if (!testScript || typeof testScript !== 'object') {
		scriptSection.style.display = 'none';
		currentScript = null;
		return;
	}
	const ts = /** @type {{ framework?: string, language?: string, filename?: string, code?: string }} */ (testScript);
	const code = typeof ts.code === 'string' ? ts.code : '';
	if (!code.trim()) {
		scriptSection.style.display = 'none';
		currentScript = null;
		return;
	}
	const filename = typeof ts.filename === 'string' && ts.filename.trim() ? ts.filename.trim() : 'generated.test.js';
	const fw = ts.framework != null ? String(ts.framework) : '';
	const lang = ts.language != null ? String(ts.language) : '';
	scriptMeta.textContent = [
		fw && `Framework: ${fw}`,
		lang && `Language: ${lang}`,
		`File: tests/${filename}`
	]
		.filter(Boolean)
		.join(' · ');
	scriptPre.textContent = code;
	currentScript = { filename, code };
	scriptSection.style.display = '';
}

function submitPrompt() {
	setLoading(true);
	vscode.postMessage({
		command: 'generate',
		prompt: input.value.trim()
	});
}

button.addEventListener('click', submitPrompt);
exportButton.addEventListener('click', () => {
	vscode.postMessage({ command: 'exportExcel' });
});

copyScriptButton?.addEventListener('click', () => {
	if (currentScript?.code) {
		vscode.postMessage({ command: 'copyTestScript', code: currentScript.code });
	}
});

saveScriptButton?.addEventListener('click', () => {
	if (currentScript) {
		vscode.postMessage({
			command: 'saveTestScript',
			filename: currentScript.filename,
			code: currentScript.code
		});
	}
});

input.addEventListener('keydown', event => {
	if (event.key === 'Enter') {
		submitPrompt();
	}
});

vscode.postMessage({
	command: 'ready'
});

window.addEventListener('message', event => {
	const message = event.data;
	if (message.command === 'init') {
		stackTextEl.textContent = message.detectedStack;
		techStackEl.style.display = 'block';
		if (message.recommendedTestingFramework) {
			frameworkEl.textContent = message.recommendedTestingFramework;
		}
	} else if (message.command === 'result') {
		const testCases = Array.isArray(message.testCases) ? message.testCases : [];
		frameworkEl.textContent = message.recommendedTestingFramework || 'Not specified';
		renderTable(testCases);
		renderTestScript(message.testScript);
		setLoading(false);
	} else if (message.command === 'exportStatus') {
		isExporting = Boolean(message.isExporting);
		updateExportButton();
	}
});