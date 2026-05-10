const vscode = acquireVsCodeApi();

// ── Auth DOM ────────────────────────────────────────────────────────────────────
const authGate = document.getElementById('authGate');
const needsBackendBanner = document.getElementById('needsBackendBanner');
const bootstrapErrorBanner = document.getElementById('bootstrapErrorBanner');
const modeLoginBtn = document.getElementById('modeLoginBtn');
const modeSignupBtn = document.getElementById('modeSignupBtn');
const authForm = document.getElementById('authForm');
const nameFieldWrap = document.getElementById('nameFieldWrap');
const authName = document.getElementById('authName');
const authEmail = document.getElementById('authEmail');
const authPassword = document.getElementById('authPassword');
const authInlineError = document.getElementById('authInlineError');
const authSubmitBtn = document.getElementById('authSubmitBtn');
const authRetryBtn = document.getElementById('authRetryBtn');
const cancelAuthPanelBtn = document.getElementById('cancelAuthPanelBtn');
const signInAccountButton = document.getElementById('signInAccountButton');
const logoutButton = document.getElementById('logoutButton');
const userLabel = document.getElementById('userLabel');

// ── Main workspace DOM ─────────────────────────────────────────────────────────
const input = document.getElementById('promptInput');
const button = document.getElementById('generateButton');
const exportButton = document.getElementById('exportButton');
const generateCodeButton = document.getElementById('generateCodeButton');
const stackDetectCard = document.getElementById('stackDetectCard');
const stackPillsEl = document.getElementById('stackPills');
const frameworkEl = document.getElementById('framework');
const frameworkPillEl = document.getElementById('frameworkPill');
const previewCardsEl = document.getElementById('previewCards');
const testcasesPanel = document.getElementById('testcasesPanel');
const testcasesVisibilityButton = document.getElementById('testcasesVisibilityButton');
const testcasesVisibilityArrow = document.getElementById('testcasesVisibilityArrow');
const insightsPanel = document.getElementById('insightsPanel');
const insightsEmpty = document.getElementById('insightsEmpty');
const insightsList = document.getElementById('insightsList');
const insightsVisibilityButton = document.getElementById('insightsVisibilityButton');
const insightsVisibilityArrow = document.getElementById('insightsVisibilityArrow');
const refreshInsightsButton = document.getElementById('refreshInsightsButton');
const scriptInnerPanel = document.getElementById('scriptInnerPanel');
const scriptPlaceholder = document.getElementById('scriptPlaceholder');
const scriptMeta = document.getElementById('scriptMeta');
const scriptPre = document.getElementById('scriptPre');
const scriptVisibilityButton = document.getElementById('scriptVisibilityButton');
const scriptVisibilityArrow = document.getElementById('scriptVisibilityArrow');
const scriptToolbarActions = document.getElementById('scriptToolbarActions');
const copyScriptButton = document.getElementById('copyScriptButton');
const saveScriptButton = document.getElementById('saveScriptButton');
const scriptUiEnabled = Boolean(
	scriptInnerPanel &&
		scriptPlaceholder &&
		scriptPre &&
		copyScriptButton &&
		saveScriptButton,
);

const defaultButtonText = button?.textContent ?? 'Generate Test Cases';
const defaultExportButtonText = exportButton?.textContent ?? 'Export to Excel';
const defaultGenerateCodeText = generateCodeButton ? generateCodeButton.textContent : 'Generate Test Code';

let signupMode = false;
let hasGeneratedRows = false;
let isExporting = false;
let isGeneratingCode = false;
let isInsightsPanelOpen = true;
let isTestCasesPanelOpen = true;
let isScriptInnerPanelOpen = true;
const SCRIPT_PLACEHOLDER_EMPTY =
	'No generated code yet. Run Generate Test Cases, then use Generate Test Code to produce a script here.';
const INSIGHTS_PAGE_SIZE = 8;
let currentInsightsPage = 1;
/** @type {{ filename: string, code: string } | null} */
let currentScript = null;
/** @type {unknown[]} */
let cachedInsightFiles = [];

/** True until extension reports debuggo.backendUrl is set */
let needsBackendUrlFlag = true;

function workspaceReady() {
	return !needsBackendUrlFlag;
}

function escapeHtml(value) {
	return String(value ?? '')
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;');
}

function splitStackPieces(label) {
	if (label == null) {
		return [];
	}
	const s = String(label).trim();
	if (!s) {
		return [];
	}
	return s
		.split(/\s*\+\s*/)
		.map(part => part.trim())
		.filter(Boolean);
}

function renderTechStackPills(stackLabel) {
	if (!stackPillsEl || !stackDetectCard) {
		return;
	}
	const parts = splitStackPieces(stackLabel);
	if (parts.length === 0) {
		stackPillsEl.innerHTML = '';
		stackDetectCard.hidden = true;
		return;
	}
	stackDetectCard.hidden = false;
	stackPillsEl.innerHTML = parts
		.map(p => `<span class="pill pill-compact">${escapeHtml(p)}</span>`)
		.join('');
}

function truncateOneLine(text, maxLen = 156) {
	const s = String(text ?? '')
		.replace(/\s+/g, ' ')
		.trim();
	if (s.length <= maxLen) {
		return s;
	}
	return `${s.slice(0, Math.max(0, maxLen - 1))}…`;
}

function setFrameworkLabel(text) {
	if (frameworkEl) {
		frameworkEl.textContent = text != null && String(text).trim() ? String(text).trim() : 'Not generated yet';
	}
	const t = frameworkEl?.textContent ?? '';
	const muted =
		!t.trim() ||
		/^(not generated yet|not specified|not detected yet)$/i.test(t.trim());
	if (frameworkPillEl) {
		frameworkPillEl.classList.toggle('pill-muted', Boolean(muted));
	}
}

function openAuthPanel() {
	if (authGate) {
		authGate.hidden = false;
	}
}

function closeAuthPanel() {
	if (authGate) {
		authGate.hidden = true;
	}
	clearAuthInlineError();
}

function setSignupMode(signup) {
	signupMode = signup;
	if (modeLoginBtn && modeSignupBtn) {
		modeLoginBtn.classList.toggle('active', !signup);
		modeSignupBtn.classList.toggle('active', signup);
		modeLoginBtn.setAttribute('aria-selected', signup ? 'false' : 'true');
		modeSignupBtn.setAttribute('aria-selected', signup ? 'true' : 'false');
	}
	if (nameFieldWrap) {
		nameFieldWrap.hidden = !signup;
	}
	if (authName && signup) {
		authName.required = true;
	} else if (authName) {
		authName.required = false;
	}
	const pw = authPassword;
	if (pw) {
		pw.autocomplete = signup ? 'new-password' : 'current-password';
		pw.minLength = signup ? 8 : 0;
	}
}

function clearAuthInlineError() {
	if (authInlineError) {
		authInlineError.textContent = '';
		authInlineError.hidden = true;
	}
}

function showAuthInlineError(text) {
	if (authInlineError) {
		authInlineError.textContent = text;
		authInlineError.hidden = !text.trim();
	}
}

function updateBootstrapBanner(message) {
	if (!bootstrapErrorBanner) {
		return;
	}
	if (message && String(message).trim()) {
		bootstrapErrorBanner.textContent = message;
		bootstrapErrorBanner.hidden = false;
		if (authRetryBtn) {
			authRetryBtn.hidden = false;
		}
	} else {
		bootstrapErrorBanner.textContent = '';
		bootstrapErrorBanner.hidden = true;
		if (authRetryBtn) {
			authRetryBtn.hidden = true;
		}
	}
}

function setAuthBusy(busy) {
	if (authSubmitBtn) {
		authSubmitBtn.disabled = Boolean(busy);
		authSubmitBtn.textContent = busy ? 'Please wait…' : 'Continue';
	}
	if (authRetryBtn) {
		authRetryBtn.disabled = Boolean(busy);
	}
}

function applyAuthChrome(authenticated) {
	if (signInAccountButton) {
		signInAccountButton.hidden = Boolean(authenticated);
	}
	if (logoutButton) {
		logoutButton.hidden = !authenticated;
	}
	if (authenticated) {
		closeAuthPanel();
	}
}

const syncProjectButton = document.getElementById('syncProjectButton');
const syncWorkspaceLabel = 'Sync Workspace';

function applyWorkspaceGating() {
	const ok = workspaceReady();
	if (syncProjectButton) {
		syncProjectButton.disabled = !ok;
		syncProjectButton.style.opacity = ok ? '' : '0.55';
	}
	if (button && button.textContent !== 'Generating...') {
		button.disabled = !ok;
		button.style.opacity = ok ? '' : '0.55';
	}
}

function resetMainWorkspaceUi() {
	if (input) {
		input.value = '';
	}
	if (stackPillsEl) {
		stackPillsEl.innerHTML = '';
	}
	if (stackDetectCard) {
		stackDetectCard.hidden = true;
	}
	setFrameworkLabel('Not generated yet');
	renderTestCases([]);
	renderTestScript(null);
	cachedInsightFiles = [];
	currentInsightsPage = 1;
	renderCodeInsights([]);
	if (button) {
		button.disabled = !workspaceReady();
		button.textContent = defaultButtonText;
		button.style.opacity = workspaceReady() ? '' : '0.55';
	}
	if (syncProjectButton) {
		syncProjectButton.disabled = !workspaceReady();
		syncProjectButton.textContent = syncWorkspaceLabel;
		syncProjectButton.style.opacity = workspaceReady() ? '' : '0.55';
	}
	if (userLabel) {
		userLabel.textContent = '';
	}
	isGeneratingCode = false;
	updateGenerateCodeButton();
}

signInAccountButton?.addEventListener('click', () => {
	clearAuthInlineError();
	openAuthPanel();
});

cancelAuthPanelBtn?.addEventListener('click', () => {
	closeAuthPanel();
});

modeLoginBtn?.addEventListener('click', () => {
	clearAuthInlineError();
	setSignupMode(false);
});

modeSignupBtn?.addEventListener('click', () => {
	clearAuthInlineError();
	setSignupMode(true);
});

authForm?.addEventListener('submit', e => {
	e.preventDefault();
	clearAuthInlineError();
	const email = (authEmail?.value ?? '').trim();
	const password = authPassword?.value ?? '';
	const name = (authName?.value ?? '').trim();
	if (!email || !password) {
		showAuthInlineError('Email and password are required.');
		return;
	}
	if (signupMode) {
		if (!name) {
			showAuthInlineError('Name is required to create an account.');
			return;
		}
		vscode.postMessage({ command: 'signup', name, email, password });
	} else {
		vscode.postMessage({ command: 'login', email, password });
	}
});

authRetryBtn?.addEventListener('click', () => {
	clearAuthInlineError();
	updateBootstrapBanner('');
	vscode.postMessage({ command: 'retryAuth' });
});

logoutButton?.addEventListener('click', () => {
	vscode.postMessage({ command: 'logout' });
});

setSignupMode(false);
closeAuthPanel();

function updateInsightsPanelVisibility() {
	if (!insightsPanel) {
		return;
	}
	insightsPanel.style.display = isInsightsPanelOpen ? 'block' : 'none';
	insightsVisibilityButton?.setAttribute('aria-expanded', isInsightsPanelOpen ? 'true' : 'false');
	if (insightsVisibilityArrow) {
		insightsVisibilityArrow.textContent = isInsightsPanelOpen ? '▾' : '▸';
	}
	if (refreshInsightsButton) {
		refreshInsightsButton.style.display = isInsightsPanelOpen ? 'inline-flex' : 'none';
	}
}

function updateTestCasesPanelVisibility() {
	if (!testcasesPanel) {
		return;
	}
	testcasesPanel.style.display = isTestCasesPanelOpen ? 'block' : 'none';
	testcasesVisibilityButton?.setAttribute('aria-expanded', isTestCasesPanelOpen ? 'true' : 'false');
	if (testcasesVisibilityArrow) {
		testcasesVisibilityArrow.textContent = isTestCasesPanelOpen ? '▾' : '▸';
	}
}

function updateScriptInnerPanelVisibility() {
	if (!scriptInnerPanel) {
		return;
	}
	scriptInnerPanel.style.display = isScriptInnerPanelOpen ? 'block' : 'none';
	scriptVisibilityButton?.setAttribute(
		'aria-expanded',
		isScriptInnerPanelOpen ? 'true' : 'false',
	);
	if (scriptVisibilityArrow) {
		scriptVisibilityArrow.textContent = isScriptInnerPanelOpen ? '▾' : '▸';
	}
	if (scriptToolbarActions) {
		scriptToolbarActions.style.display = isScriptInnerPanelOpen ? 'flex' : 'none';
	}
}

function setLoading(isLoading) {
	if (!button) {
		return;
	}
	button.disabled = isLoading || !workspaceReady();
	button.textContent = isLoading ? 'Generating...' : defaultButtonText;
	button.style.opacity = !workspaceReady() ? '0.55' : '';
}

function updateExportButton() {
	if (!exportButton) {
		return;
	}
	exportButton.disabled = !hasGeneratedRows || isExporting;
	exportButton.textContent = isExporting ? 'Exporting...' : defaultExportButtonText;
}

function updateGenerateCodeButton() {
	if (!generateCodeButton) {
		return;
	}
	generateCodeButton.disabled = !hasGeneratedRows || isGeneratingCode;
	generateCodeButton.textContent = isGeneratingCode ? 'Generating Code...' : defaultGenerateCodeText;
}

function prefillPrompt(functionName) {
	if (!input) {
		return;
	}
	input.value = `Generate test cases for ${functionName}`;
	input.focus();
}

function renderInsightsPagination(totalFiles) {
	const totalPages = Math.ceil(totalFiles / INSIGHTS_PAGE_SIZE);
	if (totalPages <= 1 || !insightsList) {
		return '';
	}

	const pages = Array.from({ length: totalPages }, (_, idx) => {
		const page = idx + 1;
		const activeClass = page === currentInsightsPage ? 'active' : '';
		return `<button type="button" class="insights-page-btn ${activeClass}" data-page="${page}">${page}</button>`;
	}).join('');

	return `<div class="insights-pagination">${pages}</div>`;
}

function renderCodeInsights(files) {
	const list = Array.isArray(files) ? files : [];
	cachedInsightFiles = list;

	if (!insightsEmpty || !insightsList) {
		return;
	}

	if (list.length === 0) {
		insightsEmpty.style.display = 'block';
		insightsList.style.display = 'none';
		insightsList.innerHTML = '';
		currentInsightsPage = 1;
		return;
	}

	const totalPages = Math.max(1, Math.ceil(list.length / INSIGHTS_PAGE_SIZE));
	if (currentInsightsPage > totalPages) {
		currentInsightsPage = totalPages;
	}

	const start = (currentInsightsPage - 1) * INSIGHTS_PAGE_SIZE;
	const end = start + INSIGHTS_PAGE_SIZE;
	const visibleFiles = list.slice(start, end);

	const sections = visibleFiles.map(file => {
		const normalizedPath = String(file.filePath || '').replaceAll('\\', '/');
		const pathSegments = normalizedPath.split('/').filter(Boolean);
		const fileName = pathSegments[pathSegments.length - 1] || normalizedPath;
		const folderLabel = pathSegments.slice(0, -1).join('/');

		const functions = (file.functions || [])
			.map(fn => {
				const fnName = typeof fn === 'string' ? fn : (fn.name || 'unknown');
				const fnSignature = typeof fn === 'string' ? '' : (fn.signature || '');
				const displayText = fnSignature ? `${fnName}${fnSignature}` : fnName;
				return `<button type="button" class="insight-item insight-fn" data-function="${escapeHtml(fnName)}">${escapeHtml(displayText)}</button>`;
			})
			.join('');

		const variables = (file.variables || [])
			.map(variableName => `<div class="insight-item">${escapeHtml(variableName)}</div>`)
			.join('');

		const classes = (file.classes || [])
			.map(cls => {
				const methods = (cls.methods || [])
					.map(method => `<div class="insight-item insight-child">${escapeHtml(method)}()</div>`)
					.join('');
				return `<div class="insight-item">${escapeHtml(cls.name)}</div>${methods}`;
			})
			.join('');

		const imports = (file.imports || [])
			.map(imp => `<div class="insight-item">${escapeHtml(imp)}</div>`)
			.join('');

		const details = [
			functions
				? `<div class="insight-block insight-block-functions"><div class="insight-title"><span class="insight-glyph" aria-hidden="true">ƒ</span>Functions</div>${functions}</div>`
				: '',
			variables
				? `<div class="insight-block insight-block-variables"><div class="insight-title"><span class="insight-glyph" aria-hidden="true">$</span>Variables</div>${variables}</div>`
				: '',
			classes
				? `<div class="insight-block insight-block-classes"><div class="insight-title"><span class="insight-glyph" aria-hidden="true">◇</span>Classes</div>${classes}</div>`
				: '',
			imports
				? `<div class="insight-block insight-block-imports"><div class="insight-title"><span class="insight-glyph" aria-hidden="true">⧉</span>Imports</div>${imports}</div>`
				: ''
		].join('');

		return `
			<details class="insight-file">
				<summary class="insight-file-name" title="${escapeHtml(normalizedPath)}">
					<span class="insight-row-arrow" aria-hidden="true">▸</span>
					<span class="insight-file-base">${escapeHtml(fileName)}</span>
					${folderLabel ? `<span class="insight-file-folder">${escapeHtml(folderLabel)}</span>` : ''}
				</summary>
				<div class="insight-group">
					${details || '<div class="insight-muted">No symbols detected.</div>'}
				</div>
			</details>
		`;
	}).join('');

	insightsList.innerHTML = `${sections}${renderInsightsPagination(list.length)}`;
	insightsEmpty.style.display = 'none';
	insightsList.style.display = 'block';

	for (const node of insightsList.querySelectorAll('.insight-fn')) {
		node.addEventListener('click', () => {
			prefillPrompt(node.dataset.function || 'function');
		});
	}

	for (const pageBtn of insightsList.querySelectorAll('.insights-page-btn')) {
		pageBtn.addEventListener('click', () => {
			const page = Number(pageBtn.dataset.page || '1');
			currentInsightsPage = Number.isFinite(page) ? Math.max(1, page) : 1;
			renderCodeInsights(cachedInsightFiles);
		});
	}
}

function renderTestCases(testCases) {
	if (!previewCardsEl || !exportButton) {
		return;
	}

	if (!Array.isArray(testCases) || testCases.length === 0) {
		previewCardsEl.innerHTML = '<div class="tc-empty">No test cases generated yet.</div>';
		hasGeneratedRows = false;
		updateExportButton();
		updateGenerateCodeButton();
		return;
	}

	const cards = testCases.map(testCase => {
		const id = escapeHtml(testCase.testCaseId);
		const title = escapeHtml(testCase.title);
		const priority = escapeHtml(testCase.priority);
		const snippet = escapeHtml(truncateOneLine(testCase.description));
		const pre = escapeHtml(testCase.preconditions ?? '');
		const steps = escapeHtml(testCase.steps ?? '');
		const expected = escapeHtml(testCase.expectedResult ?? '');

		return `
			<details class="tc-card">
				<summary class="tc-summary">
					<div class="tc-sum-body">
						<div class="tc-line-top">
							<span class="tc-id">${id}</span>
							<span class="tc-title-text">${title}</span>
							<span class="tc-priority">${priority}</span>
						</div>
						<div class="tc-snippet">${snippet}</div>
					</div>
					<span class="tc-chev" aria-hidden="true">▸</span>
				</summary>
				<div class="tc-expand">
					<div class="tc-field">
						<div class="tc-field-label">Preconditions</div>
						<div class="tc-field-value">${pre}</div>
					</div>
					<div class="tc-field">
						<div class="tc-field-label">Steps</div>
						<div class="tc-field-value">${steps}</div>
					</div>
					<div class="tc-field">
						<div class="tc-field-label">Expected result</div>
						<div class="tc-field-value">${expected}</div>
					</div>
				</div>
			</details>
		`;
	}).join('');

	previewCardsEl.innerHTML = cards;
	hasGeneratedRows = true;
	updateExportButton();
	updateGenerateCodeButton();
}

/** @param {unknown} testScript */
function renderTestScript(testScript) {
	if (!scriptUiEnabled || !scriptPlaceholder || !scriptPre) {
		return;
	}

	if (!testScript || typeof testScript !== 'object') {
		currentScript = null;
		if (scriptMeta) {
			scriptMeta.textContent = '';
			scriptMeta.hidden = true;
		}
		scriptPre.textContent = '';
		scriptPre.removeAttribute('title');
		scriptPre.hidden = true;
		scriptPlaceholder.textContent = SCRIPT_PLACEHOLDER_EMPTY;
		scriptPlaceholder.hidden = false;
		if (copyScriptButton) {
			copyScriptButton.disabled = true;
		}
		if (saveScriptButton) {
			saveScriptButton.disabled = true;
		}
		return;
	}

	const ts = /** @type {{ framework?: string, language?: string, filename?: string, code?: string }} */ (
		testScript
	);
	const code = typeof ts.code === 'string' ? ts.code : '';
	if (!code.trim()) {
		renderTestScript(null);
		return;
	}

	const filename =
		typeof ts.filename === 'string' && ts.filename.trim()
			? ts.filename.trim()
			: 'generated.test.js';
	const fw = ts.framework != null ? String(ts.framework) : '';
	const lang = ts.language != null ? String(ts.language) : '';
	const relPath = `tests/${filename}`;
	if (scriptMeta) {
		scriptMeta.textContent = relPath;
		scriptMeta.hidden = false;
	}
	scriptPlaceholder.hidden = true;
	scriptPre.hidden = false;
	scriptPre.textContent = code;
	const tooltipBits = [fw, lang].filter(Boolean);
	scriptPre.title = tooltipBits.length > 0 ? `${tooltipBits.join(' · ')} · ${relPath}` : relPath;
	currentScript = { filename, code };
	if (copyScriptButton) {
		copyScriptButton.disabled = false;
	}
	if (saveScriptButton) {
		saveScriptButton.disabled = false;
	}
}

function submitPrompt() {
	if (!workspaceReady()) {
		return;
	}
	setLoading(true);
	vscode.postMessage({
		command: 'generate',
		prompt: (input?.value ?? '').trim()
	});
}

button?.addEventListener('click', submitPrompt);

syncProjectButton?.addEventListener('click', () => {
	if (!workspaceReady()) {
		return;
	}
	syncProjectButton.disabled = true;
	syncProjectButton.textContent = 'Syncing...';
	vscode.postMessage({ command: 'syncProject' });

	setTimeout(() => {
		applyWorkspaceGating();
		syncProjectButton.textContent = syncWorkspaceLabel;
	}, 2000);
});

exportButton?.addEventListener('click', () => {
	vscode.postMessage({ command: 'exportExcel' });
});

generateCodeButton?.addEventListener('click', () => {
	if (!hasGeneratedRows || isGeneratingCode) {
		return;
	}
	isGeneratingCode = true;
	updateGenerateCodeButton();
	vscode.postMessage({ command: 'generateTestCode' });
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

refreshInsightsButton?.addEventListener('click', () => {
	currentInsightsPage = 1;
	vscode.postMessage({ command: 'refreshCodeInsights' });
});

insightsVisibilityButton?.addEventListener('click', () => {
	isInsightsPanelOpen = !isInsightsPanelOpen;
	updateInsightsPanelVisibility();
});

testcasesVisibilityButton?.addEventListener('click', () => {
	isTestCasesPanelOpen = !isTestCasesPanelOpen;
	updateTestCasesPanelVisibility();
});

scriptVisibilityButton?.addEventListener('click', () => {
	isScriptInnerPanelOpen = !isScriptInnerPanelOpen;
	updateScriptInnerPanelVisibility();
});

updateInsightsPanelVisibility();
updateTestCasesPanelVisibility();
updateScriptInnerPanelVisibility();
renderTestScript(null);

input?.addEventListener('keydown', event => {
	if (event.key === 'Enter') {
		submitPrompt();
	}
});

window.addEventListener('message', event => {
	const message = event.data;

	if (message.command === 'authState') {
		const authenticated = Boolean(message.authenticated);
		const needsBackend = Boolean(message.needsBackendUrl);
		clearAuthInlineError();
		updateBootstrapBanner(authenticated ? '' : message.bootstrapError);

		needsBackendUrlFlag = needsBackend;
		applyWorkspaceGating();

		if (needsBackendBanner) {
			needsBackendBanner.hidden = authenticated || !needsBackend;
		}

		applyAuthChrome(authenticated);

		if (authenticated) {
			const display = message.user?.name?.trim?.() || message.user?.email || '';
			if (userLabel && display) {
				userLabel.textContent = display;
			}
		} else if (userLabel) {
			userLabel.textContent = '';
		}
		return;
	}

	if (message.command === 'authError') {
		const m = typeof message.message === 'string' ? message.message : 'Something went wrong.';
		showAuthInlineError(m);
		return;
	}

	if (message.command === 'authErrorClear') {
		clearAuthInlineError();
		return;
	}

	if (message.command === 'authBusy') {
		setAuthBusy(Boolean(message.busy));
		return;
	}

	if (message.command === 'resetMainUi') {
		resetMainWorkspaceUi();
		return;
	}

	if (message.command === 'init') {
		if (message.detectedStack != null) {
			renderTechStackPills(message.detectedStack);
		}
		if (message.recommendedTestingFramework != null) {
			setFrameworkLabel(message.recommendedTestingFramework);
		}
		return;
	}

	if (message.command === 'result') {
		const testCases = Array.isArray(message.testCases) ? message.testCases : [];
		setFrameworkLabel(message.recommendedTestingFramework || 'Not specified');
		renderTestCases(testCases);
		renderTestScript(message.testScript);
		setLoading(false);
		return;
	}

	if (message.command === 'exportStatus') {
		isExporting = Boolean(message.isExporting);
		updateExportButton();
		return;
	}

	if (message.command === 'testCode') {
		isGeneratingCode = false;
		updateGenerateCodeButton();
		renderTestScript(message.testScript);
		return;
	}

	if (message.command === 'codeInsights') {
		currentInsightsPage = 1;
		renderCodeInsights(message.files || []);
		return;
	}

	if (message.command === 'sessionLoaded') {
		/** Reserved for chat history UI; backend scopes by user + projectId. */
	}
});

vscode.postMessage({
	command: 'ready'
});
