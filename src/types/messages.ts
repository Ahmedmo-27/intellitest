export type WebviewMessage =
	| {
			command: 'generate';
			prompt: string;
	  }
	| {
			command: 'generateTestCode';
	  }
	| {
			command: 'exportExcel';
	  }
	| {
			command: 'syncProject';
	  }
	| {
			command: 'ready';
	  }
	| {
			command: 'refreshCodeInsights';
	  }
	| {
			command: 'copyTestScript';
			code: string;
	  }
	| {
			command: 'saveTestScript';
			filename: string;
			code: string;
	  };
