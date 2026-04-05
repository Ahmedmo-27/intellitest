export type WebviewMessage =
	| {
		command: 'generate';
		prompt: string;
	}
	| {
		command: 'exportExcel';
	}
	| {
		command: 'ready';
	};
