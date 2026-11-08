// Client-side API helper with in-memory caching and in-flight request deduplication

const quizCache = new Map();
const inFlightQuizRequests = new Map();

let cachedShows = null;
let cachedShowsExpiry = 0;
let inFlightShowsRequest = null;

// Fetches the list of shows with 60s client cache and request deduplication
export const fetchShows = async (forceRefresh = false) => {
  if (!forceRefresh && cachedShows && Date.now() < cachedShowsExpiry) {
    return cachedShows;
  }

  if (inFlightShowsRequest) {
    return inFlightShowsRequest;
  }

  inFlightShowsRequest = (async () => {
    try {
      const response = await fetch('/shows');
      if (!response.ok) {
        throw new Error('Failed to fetch shows');
      }
      const shows = await response.json();
      cachedShows = shows;
      cachedShowsExpiry = Date.now() + 60 * 1000;
      return shows;
    } catch (error) {
      console.error("Error fetching shows:", error.message);
      return cachedShows || [];
    } finally {
      inFlightShowsRequest = null;
    }
  })();

  return inFlightShowsRequest;
};

// Fetches quiz questions with client-side caching & in-flight deduplication
export const fetchQuizQuestions = async (showName, seasonName) => {
  const cacheKey = `${showName.trim().toLowerCase()}::${seasonName.trim().toLowerCase()}`;

  if (quizCache.has(cacheKey)) {
    return quizCache.get(cacheKey);
  }

  if (inFlightQuizRequests.has(cacheKey)) {
    return inFlightQuizRequests.get(cacheKey);
  }

  const requestPromise = (async () => {
    try {
      const encodedShowName = encodeURIComponent(showName);
      const encodedSeasonName = encodeURIComponent(seasonName);
      const response = await fetch(`/quizzes/${encodedShowName}/${encodedSeasonName}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to fetch quiz');
      }
      
      const questions = await response.json();
      quizCache.set(cacheKey, questions);
      return questions;
    } catch (error) {
      console.error("Error fetching quiz questions:", error.message);
      return [];
    } finally {
      inFlightQuizRequests.delete(cacheKey);
    }
  })();

  inFlightQuizRequests.set(cacheKey, requestPromise);
  return requestPromise;
};

// Helper to prefetch questions in the background
export const prefetchQuizQuestions = (showName, seasonName) => {
  const cacheKey = `${showName.trim().toLowerCase()}::${seasonName.trim().toLowerCase()}`;
  if (!quizCache.has(cacheKey) && !inFlightQuizRequests.has(cacheKey)) {
    fetchQuizQuestions(showName, seasonName).catch(() => {});
  }
};

// Clears client-side API caches upon mutations
export const clearApiCache = () => {
  cachedShows = null;
  cachedShowsExpiry = 0;
  quizCache.clear();
};
