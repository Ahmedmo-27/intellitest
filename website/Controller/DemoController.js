import { requestTestCases, requestTestCode } from '../Route/DemoRoute.js';

export function initializeDemoPage() {
	const form = document.getElementById('demoForm');
	const languageSelect = document.getElementById('language');
	const frameworkSelect = document.getElementById('framework');
	const codeInput = document.getElementById('codeInput');
	const promptInput = document.getElementById('promptInput');
	const generateTestCasesBtn = document.getElementById('generateTestCasesBtn');
	const generateTestsBtn = document.getElementById('generateTestsBtn');
	const resultsSection = document.getElementById('resultsSection');
	const testCasesResult = document.getElementById('testCasesResult');
	const testCasesOutput = document.getElementById('testCasesOutput');
	const testCodeResult = document.getElementById('testCodeResult');
	const testCodeOutput = document.getElementById('testCodeOutput');
	const errorResult = document.getElementById('errorResult');
	const errorOutput = document.getElementById('errorOutput');
	const loadingIndicator = document.getElementById('loadingIndicator');
	const copyCodeBtn = document.getElementById('copyCodeBtn');

	if (
		!form ||
		!languageSelect ||
		!frameworkSelect ||
		!codeInput ||
		!promptInput ||
		!generateTestCasesBtn ||
		!generateTestsBtn ||
		!resultsSection ||
		!testCasesResult ||
		!testCasesOutput ||
		!testCodeResult ||
		!testCodeOutput ||
		!errorResult ||
		!errorOutput ||
		!loadingIndicator ||
		!copyCodeBtn
	) {
		return;
	}

	const state = {
		generatedTestCases: [],
	};

	function showLoading(message = 'Processing your request...') {
		loadingIndicator.style.display = 'flex';
		loadingIndicator.querySelector('p').textContent = message;
	}

	function hideLoading() {
		loadingIndicator.style.display = 'none';
	}

	function showError(message) {
		errorOutput.textContent = message;
		errorResult.style.display = 'block';
		testCasesResult.style.display = 'none';
		testCodeResult.style.display = 'none';
		resultsSection.style.display = 'block';
	}

	function clearResults() {
		state.generatedTestCases = [];
		resultsSection.style.display = 'none';
		testCasesResult.style.display = 'none';
		testCodeResult.style.display = 'none';
		errorResult.style.display = 'none';
		testCasesOutput.innerHTML = '';
		testCodeOutput.innerHTML = '';
		generateTestsBtn.disabled = true;
	}

	function escapeHtml(text) {
		const safeText = String(text ?? '');
		const map = {
			'&': '&amp;',
			'<': '&lt;',
			'>': '&gt;',
			'"': '&quot;',
			"'": '&#039;',
		};

		return safeText.replace(/[&<>"']/g, (character) => map[character]);
	}

	function renderTestCases(testCases) {
		state.generatedTestCases = Array.isArray(testCases) ? testCases : [];

		let html = '<table class="test-cases-table"><thead><tr><th>Test Case</th><th>Description</th><th>Expected Result</th></tr></thead><tbody>';

		state.generatedTestCases.forEach((testCase, index) => {
			const steps = Array.isArray(testCase.steps) ? testCase.steps.join('<br>') : testCase.steps || '';
			html += `
				<tr>
					<td>#${index + 1}</td>
					<td><strong>${testCase.name || 'Test Case'}</strong><br>${steps}</td>
					<td>${testCase.expected || 'N/A'}</td>
				</tr>
			`;
		});

		html += '</tbody></table>';
		testCasesOutput.innerHTML = html;
		testCasesResult.style.display = 'block';
		errorResult.style.display = 'none';
		resultsSection.style.display = 'block';
		generateTestsBtn.disabled = state.generatedTestCases.length === 0;
	}

	function renderTestCode(script) {
		const html = `
			<div class="code-block">
				<div class="code-header">
					<span class="framework-badge">${escapeHtml(script?.framework || 'Code')}</span>
				</div>
				<pre><code>${escapeHtml(script?.code || '')}</code></pre>
			</div>
		`;

		testCodeOutput.innerHTML = html;
		testCodeResult.style.display = 'block';
		errorResult.style.display = 'none';
		resultsSection.style.display = 'block';
	}

	function buildRequestPayload() {
		return {
			type: 'function',
			language: languageSelect.value,
			framework: frameworkSelect.value,
			prompt: promptInput.value.trim(),
			modules: [codeInput.value.trim()],
		};
	}

	function validateForm() {
		if (!form.checkValidity()) {
			form.reportValidity();
			return false;
		}

		return true;
	}

	async function handleGenerateTestCases() {
		if (!validateForm()) {
			return;
		}

		clearResults();
		showLoading('Generating test cases...');

		try {
			const testCases = await requestTestCases(buildRequestPayload());
			renderTestCases(testCases);
		} catch (error) {
			console.error('Error generating test cases:', error);
			showError(`Failed to generate test cases: ${error.message}`);
		} finally {
			hideLoading();
		}
	}

	async function handleGenerateTests() {
		if (state.generatedTestCases.length === 0) {
			showError('Please generate test cases first.');
			return;
		}

		showLoading('Generating test code...');

		try {
			const payload = {
				...buildRequestPayload(),
				testCases: state.generatedTestCases,
			};

			const script = await requestTestCode(payload);
			renderTestCode(script);
		} catch (error) {
			console.error('Error generating test code:', error);
			showError(`Failed to generate test code: ${error.message}`);
		} finally {
			hideLoading();
		}
	}

	function handleCopyCode() {
		const codeElement = testCodeOutput.querySelector('code');

		if (!codeElement) {
			return;
		}

		navigator.clipboard.writeText(codeElement.textContent || '').then(() => {
			const originalText = copyCodeBtn.textContent;
			copyCodeBtn.textContent = 'Copied!';

			setTimeout(() => {
				copyCodeBtn.textContent = originalText;
			}, 2000);
		}).catch((error) => {
			console.error('Failed to copy code:', error);
			showError('Failed to copy code to clipboard.');
		});
	}

	generateTestCasesBtn.addEventListener('click', handleGenerateTestCases);
	generateTestsBtn.addEventListener('click', handleGenerateTests);
	copyCodeBtn.addEventListener('click', handleCopyCode);
	generateTestsBtn.disabled = true;
}
