const dummyProjectId = "758f4df3-6ca6-403d-a46d-a89e17ce5754";
const dummyUserId = "6a0128f2087c093b38b824bf";

type DummyWeightEntry = {
  weight: number;
  coverage?: number | null;
  connectivity?: number;
  importance?: number;
};

export const dummyAuth = {
  email: "ahmedmostafa@gmail.com",
  password: "Test1234!",
  user: {
    id: dummyUserId,
    name: "Ahmed Mostafa",
    email: "ahmedmostafa@gmail.com",
  },
};

export const dummyAuthToken = "demo-session-token";

export const dummyProjects = [
  {
    projectId: dummyProjectId,
    userId: dummyUserId,
    name: "e-commerce / online store (web)",
    techStack: {
      language: "javascript",
      framework: "Node.js + TypeScript + React + Express + Vite + Tailwind CSS",
      extras: [],
    },
    type: "e-commerce / online store (web)",
    createdAt: "2026-05-11T01:01:26.859Z",
    updatedAt: "2026-05-11T02:43:02.068Z",
  },
];

const dummyRelationships = [
  {
    source: "checkout",
    target: "shopping cart",
    type: "depends_on",
    confidence: 0.97,
    evidence: [
      "flow: checkout requires cart",
      "supporting paths from feature file lists: server\\src\\models\\Cart.js; client\\src\\pages\\CartPage.tsx (+7 more)",
    ],
    files: [
      "server\\src\\models\\Cart.js",
      "client\\src\\pages\\CartPage.tsx",
      "client\\src\\store\\cartStore.ts",
      "client\\src\\services\\cartApi.ts",
      "server\\src\\routes\\cartRoutes.js",
      "client\\src\\pages\\CheckoutPage.tsx",
      "server\\src\\services\\cartService.js",
      "server\\src\\controllers\\cartController.js",
      "server\\src\\repositories\\cartRepository.js",
    ],
  },
  {
    source: "checkout",
    target: "authentication",
    type: "validates",
    confidence: 0.745,
    evidence: [
      "protected domain likely gated by auth",
      "supporting paths from feature file lists: server\\src\\utils\\jwt.js; client\\src\\lib\\authStorage.ts (+8 more)",
    ],
    files: [
      "server\\src\\utils\\jwt.js",
      "client\\src\\lib\\authStorage.ts",
      "client\\src\\pages\\LoginPage.tsx",
      "client\\src\\services\\authApi.ts",
      "server\\src\\routes\\authRoutes.js",
      "client\\src\\pages\\CheckoutPage.tsx",
      "client\\src\\pages\\RegisterPage.tsx",
      "server\\src\\services\\authService.js",
      "client\\src\\pages\\VerifyEmailPage.tsx",
      "server\\src\\middleware\\authMiddleware.js",
    ],
  },
];

const dummyWeights: Record<string, DummyWeightEntry> = {
  "product catalog": {
    weight: 0.85,
    coverage: 71,
    connectivity: 0.48,
    importance: 0.9,
  },
  checkout: {
    weight: 0.92,
    coverage: 62,
    connectivity: 0.72,
    importance: 0.92,
  },
  "shopping cart": {
    weight: 0.74,
    coverage: 48,
    connectivity: 0.64,
    importance: 0.82,
  },
  authentication: {
    weight: 0.78,
    coverage: 83,
    connectivity: 0.52,
    importance: 0.86,
  },
};

const dummyCoreFeatures = ["checkout", "product catalog", "authentication", "shopping cart"];

function computeWeightedCoverage(weightsByName: Record<string, DummyWeightEntry>): number | null {
  let total = 0;
  let weightSum = 0;
  for (const entry of Object.values(weightsByName)) {
    if (typeof entry.weight !== "number" || typeof entry.coverage !== "number") {
      continue;
    }
    total += entry.weight * entry.coverage;
    weightSum += entry.weight;
  }
  if (weightSum === 0) return null;
  return Math.round((total / weightSum) * 10) / 10;
}

const dummyGraphsByProjectId: Record<string, {
  projectId: string;
  relationships: Array<{
    source: string;
    target: string;
    type: string;
    confidence?: number;
    evidence?: string[];
    files?: string[];
  }>;
  weights: Record<string, DummyWeightEntry>;
  coreFeatures: string[];
  weightedCoverage: number | null;
  weightingModel: string;
}> = {
  [dummyProjectId]: {
    projectId: dummyProjectId,
    relationships: dummyRelationships,
    weights: dummyWeights,
    coreFeatures: dummyCoreFeatures,
    weightedCoverage: computeWeightedCoverage(dummyWeights),
    weightingModel: "core-connectivity-v1",
  },
};

function readWindowFlag(names: string[], fallback: boolean): boolean {
  if (typeof window === "undefined") return fallback;
  for (const name of names) {
    const raw = (window as any)[name];
    if (raw === undefined) continue;
    if (typeof raw === "string") {
      return raw.toLowerCase() === "true";
    }
    return Boolean(raw);
  }
  return fallback;
}

export const useDummyData = readWindowFlag(["DEMO_DUMMY_MODE", "USE_DUMMY_DATA"], true);

export function getDummyProjects() {
  return dummyProjects;
}

export function getDummyProjectGraph(projectId: string) {
  return dummyGraphsByProjectId[projectId] || null;
}
