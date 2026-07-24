import { deficitTopic } from './deficit.js';
import type { Topic } from './types.js';

// The registry seam. Add a topic here and the app can render it; comparing
// presidents on a topic is iterating that topic's promises. Kept as a plain
// array on purpose — no plugin system until the product needs one.
export const topics: Topic[] = [deficitTopic];

export { deficitTopic, toClaim, readAt } from './deficit.js';
export type { Topic, PromiseSpec, Term } from './types.js';
