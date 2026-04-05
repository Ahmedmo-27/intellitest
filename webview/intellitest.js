const vscode = acquireVsCodeApi();

const input = document.getElementById('featureInput');
const button = document.getElementById('generateButton');
const output = document.getElementById('output');
const techStackEl = document.getElementById('techStack');
const stackTextEl = document.getElementById('stackText');
const defaultButtonText = button.textContent;

function setLoading(isLoading) {
	button.disabled = isLoading;
	button.textContent = isLoading ? 'Generating...' : defaultButtonText;
}

function submitFeature() {
	setLoading(true);
	vscode.postMessage({
		command: 'generate',
		feature: input.value.trim()
	});
}

button.addEventListener('click', submitFeature);

input.addEventListener('keydown', event => {
	if (event.key === 'Enter') {
		submitFeature();
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