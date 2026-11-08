import React, { useState, useMemo, useEffect } from 'react';
import { prefetchQuizQuestions } from '../mockApi';

// Numerical season sorting helper
const sortSeasons = (seasons) => {
  return [...seasons].sort((a, b) => {
    const aName = a.seasonName || '';
    const bName = b.seasonName || '';
    
    const aMatch = aName.match(/\d+/);
    const bMatch = bName.match(/\d+/);
    
    const aNum = aMatch ? parseInt(aMatch[0], 10) : null;
    const bNum = bMatch ? parseInt(bMatch[0], 10) : null;
    
    if (aNum !== null && bNum !== null) return aNum - bNum;
    if (aNum !== null) return -1;
    if (bNum !== null) return 1;
    
    return aName.localeCompare(bName);
  });
};

const SeasonSelection = ({ show, onSelectSeason, onBack }) => {
  const [randomize, setRandomize] = useState(false);

  // Memoize sorted seasons so toggling checkboxes does not cause recalculations
  const seasons = useMemo(() => {
    const seasonsWithAll = [...(show.seasons || []), { seasonName: 'All Questions' }];
    return sortSeasons(seasonsWithAll);
  }, [show.seasons]);

  // Background-prefetch questions for available seasons so quiz starts instantly on click
  useEffect(() => {
    if (show && show.name && seasons.length > 0) {
      seasons.forEach((season) => {
        prefetchQuizQuestions(show.name, season.seasonName);
      });
    }
  }, [show, seasons]);

  return (
    <div className="quiz-page-container">
      <div className="fixed-poster large-poster">
        <div className="poster-wrapper small-poster">
          <img
            src={show.posterUrl}
            alt={`${show.name} poster`}
            loading="lazy"
            decoding="async"
            width="250"
            height="370"
            onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = '/fallback-poster.svg'; }}
          />
        </div>
      </div>

      <div className="quiz-container slimmer-container">
        <button type="button" onClick={onBack} className="home-button">Back</button>
        <div className="quiz-header">
          <h1>{show.name}</h1>
          <h2>Select a Season</h2>
          <div className="randomize-toggle">
            <label>
              <input
                type="checkbox"
                checked={randomize}
                onChange={(e) => setRandomize(e.target.checked)}
              />
              Randomize Questions
            </label>
          </div>
        </div>
        <div className="options-list">
          {seasons.map((season, index) => (
            <div key={index} className="season-row">
              <div className="season-label">{season.seasonName}</div>
              <button
                className="start-season-btn"
                onMouseEnter={() => prefetchQuizQuestions(show.name, season.seasonName)}
                onFocus={() => prefetchQuizQuestions(show.name, season.seasonName)}
                onClick={() => onSelectSeason(show.name, season.seasonName, randomize)}
              >
                Start Quiz
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default React.memo(SeasonSelection);
