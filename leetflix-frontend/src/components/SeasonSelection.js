import React from 'react';

const SeasonSelection = ({ show, onSelectSeason, onBack }) => {
  // Assume show object has a seasons array
  const seasons = show.seasons || [{ seasonName: 'All Seasons' }];

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
        </div>
        <div className="options-list">
          {seasons.map((season, index) => (
            <div key={index} className="season-row">
              <div className="season-label">{season.seasonName}</div>
              <button
                className="start-season-btn"
                onClick={() => onSelectSeason(show.name, season.seasonName)}
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