import axios from 'axios';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.3-70b-versatile';
const SYSTEM_PROMPT =
	'You are a senior QA engineer. Generate structured, concise, practical software test cases. Use clear sections and numbered test cases with title, preconditions, steps, and expected result.';

export async function generateTestCases(feature: string, detectedStack: string): Promise<string> {
	const apiKey = process.env.GROQ_API_KEY?.trim().replace(/^['"]|['"]$/g, '') ?? '';

	if (!apiKey) {
		throw new Error('Missing GROQ_API_KEY environment variable.');
	}

	const finalUserPrompt = `Generate structured test cases for a ${feature} in a ${detectedStack} project.`;

	try {
		const response = await axios.post(
			GROQ_API_URL,
			{
				model: GROQ_MODEL,
				messages: [
					{ role: 'system', content: SYSTEM_PROMPT },
					{ role: 'user', content: finalUserPrompt }
				]
			},
			{
				headers: {
					Authorization: `Bearer ${apiKey}`,
					'Content-Type': 'application/json'
				}
			}
		);

		const content = response.data?.choices?.[0]?.message?.content;
		if (typeof content !== 'string' || !content.trim()) {
			throw new Error('Groq API returned an empty response.');
		}

		return content;
	} catch (error) {
		const errorMessage = axios.isAxiosError(error)
			? (error.response?.data?.error?.message ?? error.message)
			: String(error);
		throw new Error(errorMessage);
	}
}
