const vscode = acquireVsCodeApi();

const input = document.getElementById('featureInput');
const button = document.getElementById('generateButton');
const output = document.getElementById('output');
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

window.addEventListener('message', event => {
	const message = event.data;
	if (message.command === 'result') {
		output.textContent = message.testCases;
		setLoading(false);
	}
});