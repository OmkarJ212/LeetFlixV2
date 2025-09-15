import React from 'react';

const SeasonSelection = ({ show, onSelectSeason, onBack }) => {
  // Assume show object has a seasons array
  const seasons = show.seasons || [{ seasonName: 'All Seasons' }];

  return (
    <div className="quiz-page-container">
      <div className="quiz-container">
        <button type="button" onClick={onBack} className="home-button">Back</button>
        <div className="quiz-header">
          <h1>{show.name}</h1>
          <h2>Select a Season</h2>
        </div>
        <div className="options-container">
          {seasons.map((season, index) => (
            <button
              key={index}
              className="option"
              onClick={() => onSelectSeason(show.name, season.seasonName)}
            >
              <span className="option-text">{season.seasonName}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SeasonSelection;