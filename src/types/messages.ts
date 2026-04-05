export type WebviewMessage =
	| {
		command: 'generate';
		prompt: string;
	}
	| {
		command: 'ready';
	};
