export type TestCaseRow = {
	testCaseId: string;
	title: string;
	description: string;
	preconditions: string;
	steps: string;
	expectedResult: string;
	priority: string;
};

export type GeneratedTestCases = {
	recommendedTestingFramework: string;
	testCases: TestCaseRow[];
};
