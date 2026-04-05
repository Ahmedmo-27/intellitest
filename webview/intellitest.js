const vscode = acquireVsCodeApi();

const input = document.getElementById('promptInput');
const button = document.getElementById('generateButton');
const output = document.getElementById('output');
const techStackEl = document.getElementById('techStack');
const stackTextEl = document.getElementById('stackText');
const defaultButtonText = button.textContent;

function setLoading(isLoading) {
	button.disabled = isLoading;
	button.textContent = isLoading ? 'Generating...' : defaultButtonText;
}

function submitPrompt() {
	setLoading(true);
	vscode.postMessage({
		command: 'generate',
		prompt: input.value.trim()
	});
}

button.addEventListener('click', submitPrompt);

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
		output.textContent = message.testCases;
		setLoading(false);
	}
});