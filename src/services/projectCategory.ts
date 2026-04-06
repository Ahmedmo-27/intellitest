import * as fs from 'node:fs';
import * as path from 'node:path';

type Rule = { label: string; weight: number; patterns: RegExp[] };

/**
 * Heuristic domain labels for web projects (e-commerce, LMS, etc.).
 * Scores are summed from pattern matches in project text (paths, package.json, prompt).
 */
const DOMAIN_RULES: Rule[] = [
	{
		label: 'e-commerce / online store',
		weight: 1,
		patterns: [
			/\be-?commerce\b/i,
			/\bcheckout\b/i,
			/\bshopping[\s_-]?cart\b/i,
			/\bcart\b/i,
			/\bbasket\b/i,
			/\binventory\b/i,
			/\bproduct[\s_-]?(catalog|listing|page)?\b/i,
			/\border(s|ing)?\b/i,
			/\bpayment(s|gateway)?\b/i,
			/\bstripe\b/i,
			/\bpaypal\b/i,
			/\bwoocommerce\b/i,
			/\bshopify\b/i,
			/\bSKU\b/i,
			/\/store\b/i,
			/\bmarketplace\b/i
		]
	},
	{
		label: 'LMS / education platform',
		weight: 1,
		patterns: [
			/\bLMS\b/i,
			/\bcourse(s)?\b/i,
			/\blesson(s)?\b/i,
			/\bcurriculum\b/i,
			/\benrollment\b/i,
			/\bstudent(s)?\b/i,
			/\binstructor\b/i,
			/\bquiz(zes)?\b/i,
			/\bassignment(s)?\b/i,
			/\bgrade(book|s)?\b/i,
			/\bsyllabus\b/i,
			/\bmoodle\b/i,
			/\bedtech\b/i,
			/\blearning[\s_-]?(path|module)\b/i
		]
	},
	{
		label: 'SaaS / subscription product',
		weight: 1,
		patterns: [
			/\bsaas\b/i,
			/\bsubscription(s)?\b/i,
			/\bbilling\b/i,
			/\btenant(s)?\b/i,
			/\bplan(s)?\b/i,
			/\bonboarding\b/i,
			/\bworkspace(s)?\b/i
		]
	},
	{
		label: 'content / blog / CMS',
		weight: 1,
		patterns: [
			/\bblog\b/i,
			/\barticle(s)?\b/i,
			/\bCMS\b/i,
			/\bcontentful\b/i,
			/\bstrapi\b/i,
			/\bmarkdown\b/i,
			/\bpost(s)?\b/i,
			/\bpublish(ing)?\b/i
		]
	},
	{
		label: 'social / community',
		weight: 1,
		patterns: [
			/\bfeed\b/i,
			/\bfollow(ers|ing)?\b/i,
			/\bcomment(s)?\b/i,
			/\bchat\b/i,
			/\bmessenger\b/i,
			/\bcommunity\b/i,
			/\bforum\b/i,
			/\bnotification(s)?\b/i
		]
	},
	{
		label: 'dashboard / admin portal',
		weight: 1,
		patterns: [
			/\badmin(istrator|panel)?\b/i,
			/\bdashboard\b/i,
			/\banalytics\b/i,
			/\breport(s)?\b/i,
			/\bbackoffice\b/i
		]
	},
	{
		label: 'booking / scheduling',
		weight: 1,
		patterns: [/\bbooking(s)?\b/i, /\bcalendar\b/i, /\bappointment(s)?\b/i, /\breservation(s)?\b/i]
	},
	{
		label: 'healthcare / telehealth',
		weight: 1,
		patterns: [/\bpatient(s)?\b/i, /\bclinical\b/i, /\btelehealth\b/i, /\bEHR\b/i, /\bHIPAA\b/i]
	},
	{
		label: 'real estate / listings',
		weight: 1,
		patterns: [/\bproperty(ies)?\b/i, /\blisting(s)?\b/i, /\brealtor\b/i, /\blease\b/i]
	}
];

function readPackageJsonBlob(root: string | undefined): string {
	if (!root || !fs.existsSync(root)) {
		return '';
	}
	const p = path.join(root, 'package.json');
	if (!fs.existsSync(p)) {
		return '';
	}
	try {
		const raw = fs.readFileSync(p, 'utf8');
		const pkg = JSON.parse(raw) as {
			name?: string;
			description?: string;
			keywords?: string[];
		};
		return [pkg.name, pkg.description, ...(pkg.keywords ?? [])].filter(Boolean).join(' ');
	} catch {
		return '';
	}
}

function scoreRules(text: string): Map<string, number> {
	const scores = new Map<string, number>();
	const haystack = text.slice(0, 500_000);

	for (const rule of DOMAIN_RULES) {
		let score = 0;
		for (const re of rule.patterns) {
			const m = haystack.match(re);
			if (m) {
				score += m.length * rule.weight;
			}
		}
		if (score > 0) {
			scores.set(rule.label, (scores.get(rule.label) ?? 0) + score);
		}
	}
	return scores;
}

function inferDeliveryStyle(detectedStack: string, pathsSample: string): string {
	const s = detectedStack.toLowerCase();
	const p = pathsSample.toLowerCase();

	if (p.includes('next') || p.includes('pages/') || p.includes('app/') && p.includes('next')) {
		return 'web (SSR/MPA-style)';
	}
	if (s.includes('angular') || s.includes('react') || s.includes('vue') || s.includes('vite') || s.includes('svelte')) {
		return 'web (SPA/component framework)';
	}
	if (p.includes('api') && (p.includes('route') || p.includes('controller'))) {
		return 'web API / backend-for-frontend';
	}
	return 'web application';
}

/**
 * Human-readable project domain/type for LLM context (replaces generic "application").
 */
export function inferWebProjectCategory(
	workspaceRootPath: string | undefined,
	relativePaths: string[],
	userPrompt: string,
	detectedStack: string
): string {
	const pathBlob = relativePaths.join(' ');
	const pkgBlob = readPackageJsonBlob(workspaceRootPath);
	const prompt = userPrompt.trim();
	const combined = `${prompt}\n${pkgBlob}\n${pathBlob}`;

	const scores = scoreRules(combined);
	if (scores.size === 0) {
		const style = inferDeliveryStyle(detectedStack, pathBlob);
		return `general ${style} — domain not inferred from files; use the tester prompt for product context`;
	}

	const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1]);
	const top = ranked[0];
	const second = ranked[1];

	if (second && second[1] >= top[1] * 0.4 && top[1] >= 2) {
		return `${top[0]} + ${second[0]} (web)`;
	}

	return `${top[0]} (web)`;
}
