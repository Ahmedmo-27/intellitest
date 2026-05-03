/**
 * Context Service — business logic for project context operations.
 *
 * Owns:
 *   - enrichProjectMap: merge stored context into a fresh projectMap payload
 *   - extractFeatures:  derive feature names from generated test cases
 *
 * These were previously inline in generateController.js, violating SRP.
 * Moving them here makes the controller a thin orchestrator and makes
 * this logic independently testable.
 */

import { unionArrays } from "../utils/helpers.js";

/**
 * Merge a stored ProjectContext document into the incoming projectMap,
 * producing an enriched map that carries all accumulated knowledge.
 *
 * Rules:
 *   - Arrays (modules, routes, priorityFiles) → union, deduplicated
 *   - codeInsights → stored keys kept, incoming keys override on collision
 *   - All other projectMap fields → kept as-is
 *
 * @param {object} projectMap   — validated incoming map (from validateGenerate)
 * @param {object|null} context — stored ProjectContext plain object (may be null)
 * @returns {object}            — enriched map ready for promptService
 */
export function enrichProjectMap(projectMap, context) {
  if (!context) return projectMap;

  const modules       = unionArrays(context.modules,       projectMap.modules);
  const routes        = unionArrays(context.routes,        projectMap.routes);
  const priorityFiles = unionArrays(context.priorityFiles, projectMap.priorityFiles);

  // Stored codeInsights is a Mongoose Map — convert to plain object first
  const storedInsights =
    context.codeInsights instanceof Map
      ? Object.fromEntries(context.codeInsights)
      : (context.codeInsights ?? {});

  const codeInsights = { ...storedInsights, ...(projectMap.codeInsights ?? {}) };

  return { ...projectMap, modules, routes, priorityFiles, codeInsights };
}

/**
 * Derive a list of feature records from the tags of generated test cases.
 * Used to populate the Feature collection after each successful generation.
 *
 * @param {object[]} testCases — normalised test case array from formatter
 * @returns {Array<{ name: string, testScore: number }>}
 */
export function extractFeatures(testCases) {
  if (!Array.isArray(testCases) || testCases.length === 0) return [];

  const nameSet = new Set();
  for (const tc of testCases) {
    const tags = Array.isArray(tc.tags) ? tc.tags : [];
    for (const tag of tags) {
      if (tag && typeof tag === "string" && tag.trim()) {
        nameSet.add(tag.trim());
      }
    }
  }

  // Seed with an optimistic 50/100 score; incremented by actual pass/fail data later
  return [...nameSet].map((name) => ({ name, testScore: 50 }));
}

/**
 * Format stored codeInsights (Map or plain object) as an array of
 * human-readable "key: value" strings for the API response.
 *
 * @param {Map|object} codeInsights
 * @returns {string[]}
 */
export function insightsToArray(codeInsights) {
  if (!codeInsights) return [];
  const entries =
    codeInsights instanceof Map
      ? [...codeInsights.entries()]
      : Object.entries(codeInsights);
  return entries.map(([k, v]) => `${k}: ${v}`);
}
