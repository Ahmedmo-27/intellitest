export type CodeInsightClass = {
	name: string;
	methods: string[];
};

export type CodeInsightFile = {
	filePath: string;
	functions: string[];
	variables: string[];
	classes: CodeInsightClass[];
	imports: string[];
};

export type CodeInsightsPayload = {
	files: CodeInsightFile[];
	totalAnalyzedFiles: number;
};
