export type WebviewMessage =
	| {
		command: 'generate';
		feature: string;
	}
	| {
		command: 'ready';
	};
