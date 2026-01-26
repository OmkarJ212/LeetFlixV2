import React, { useState } from 'react';

const SeasonSelection = ({ show, onSelectSeason, onBack }) => {
  // State for randomize toggle
  const [randomize, setRandomize] = useState(false);
  // Assume show object has a seasons array, add "All Questions" option
  const seasons = [...(show.seasons || []), { seasonName: 'All Questions' }];

  return (
    <div className="quiz-page-container">
      {/* Poster rendered outside the main container so it doesn't affect container size */}
      <div className="fixed-poster large-poster">
        <div className="poster-wrapper small-poster">
          <img
            src={show.posterUrl}
            alt={`${show.name} poster`}
            onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = '/fallback-poster.svg'; }}
          />
        </div>
      </div>

      <div className="quiz-container slimmer-container">
        <button type="button" onClick={onBack} className="home-button">Back</button>
        <div className="quiz-header">
          <h1>{show.name}</h1>
          <h2>Select a Season</h2>
          {/* Randomize Questions Toggle */}
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

export default SeasonSelection;