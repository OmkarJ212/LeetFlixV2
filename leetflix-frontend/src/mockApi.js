// This file is now a true API helper. It contains functions
// for fetching all dynamic data from our backend server.

// *** THIS IS THE UPDATED FUNCTION ***
// It now fetches the list of shows from your backend API's /shows endpoint.
export const fetchShows = async () => {
  try {
  const response = await fetch('/shows');
    if (!response.ok) {
      throw new Error('Failed to fetch shows');
    }
    const shows = await response.json();
    return shows;
  } catch (error) {
    console.error("Error fetching shows:", error.message);
    // Return an empty array so the app doesn't crash on an error
    return [];
  }
};

// This function now correctly fetches quiz questions from your backend API
// by including both showName and seasonName in the URL.
export const fetchQuizQuestions = async (showName, seasonName) => {
  try {
    // We encode the show name and season name to make them safe for a URL
    const encodedShowName = encodeURIComponent(showName);
    const encodedSeasonName = encodeURIComponent(seasonName);
    
    // The corrected endpoint now includes the season name
  const response = await fetch(`/quizzes/${encodedShowName}/${encodedSeasonName}`);
    
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch quiz');
    }
    
    const questions = await response.json();
    return questions;

  } catch (error) {
    console.error("Error fetching quiz questions:", error.message);
    return [];
  }
};