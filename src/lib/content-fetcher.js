/**
 * Fetch problem JSON and manifest.json from the content repo.
 * Light caching in chrome.storage.local with 24h TTL.
 */

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function localApi() {
  return chrome.storage.local;
}

async function getCached(key) {
  const obj = await localApi().get(key);
  return obj[key];
}

async function setCached(key, value) {
  await localApi().set({ [key]: value });
}

/**
 * @param {string} slug
 * @param {string} repoUrl  base raw URL, e.g. https://raw.githubusercontent.com/USER/repo/main
 * @returns {Promise<object|null>}  null when 404, throws on other errors
 */
export async function fetchProblem(slug, repoUrl) {
  const key = `cache_problem_${slug}`;
  const cached = await getCached(key);
  if (cached && Date.now() - cached.fetched_at < CACHE_TTL_MS) {
    return cached.data;
  }
  const url = `${repoUrl.replace(/\/$/, '')}/problems/${slug}.json`;
  let res;
  try {
    res = await fetch(url, { cache: 'no-cache' });
  } catch (e) {
    if (cached) return cached.data;
    throw e;
  }
  if (res.status === 404) {
    await setCached(key, { data: null, fetched_at: Date.now() });
    return null;
  }
  if (!res.ok) {
    if (cached) return cached.data;
    throw new Error(`Fetch failed: ${res.status}`);
  }
  const data = await res.json();
  await setCached(key, { data, fetched_at: Date.now() });
  return data;
}

export async function fetchManifest(repoUrl) {
  const key = 'cache_manifest';
  const cached = await getCached(key);
  if (cached && Date.now() - cached.fetched_at < CACHE_TTL_MS) {
    return cached.data;
  }
  const url = `${repoUrl.replace(/\/$/, '')}/manifest.json`;
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) {
    if (cached) return cached.data;
    throw new Error(`Manifest fetch failed: ${res.status}`);
  }
  const data = await res.json();
  await setCached(key, { data, fetched_at: Date.now() });
  return data;
}

/** Force-clear caches (used by Settings → "Refresh content"). */
export async function clearContentCache() {
  const all = await localApi().get(null);
  const keys = Object.keys(all).filter(k => k.startsWith('cache_'));
  if (keys.length) await localApi().remove(keys);
}
