const vscode = acquireVsCodeApi();

const input = document.getElementById('promptInput');
const button = document.getElementById('generateButton');
const exportButton = document.getElementById('exportButton');
const techStackEl = document.getElementById('techStack');
const stackTextEl = document.getElementById('stackText');
const frameworkEl = document.getElementById('framework');
const previewBody = document.getElementById('previewBody');
const defaultButtonText = button.textContent;
const defaultExportButtonText = exportButton.textContent;
let hasGeneratedRows = false;
let isExporting = false;

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
	} else if (message.command === 'result') {
		const testCases = Array.isArray(message.testCases) ? message.testCases : [];
		frameworkEl.textContent = message.recommendedTestingFramework || 'Not specified';
		renderTable(testCases);
		setLoading(false);
	} else if (message.command === 'exportStatus') {
		isExporting = Boolean(message.isExporting);
		updateExportButton();
	}
});