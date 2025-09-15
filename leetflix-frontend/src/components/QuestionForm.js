import React, { useState } from 'react';

const QuestionForm = ({ onAddQuestion, onCancel, allShows }) => {
  const [showName, setShowName] = useState('');
  const [seasonName, setSeasonName] = useState('');
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '', '', '']);
  const [answer, setAnswer] = useState('');
  const [newShowName, setNewShowName] = useState('');
  const [newPosterUrl, setNewPosterUrl] = useState('');

  const handleOptionChange = (index, value) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const isNewShow = showName === 'new';
    const finalShowName = isNewShow ? newShowName : showName;
    const finalPosterUrl = isNewShow ? newPosterUrl : (allShows.find(s => s.name === showName)?.posterUrl || '');

    const newQuestion = {
      showName: finalShowName,
      posterUrl: finalPosterUrl,
      seasonName,
      question,
      options,
      answer
    };
    onAddQuestion(newQuestion);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>Add a New Quiz Question</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Select an Existing Show or Add a New One:</label>
            <select onChange={(e) => setShowName(e.target.value)} value={showName}>
              <option value="">--Select Show--</option>
              {allShows.map(show => (
                <option key={show.name} value={show.name}>{show.name}</option>
              ))}
              <option value="new">Add New Show</option>
            </select>
          </div>
          {showName === 'new' && (
            <>
              <div className="form-group">
                <label>New Show Name:</label>
                <input type="text" value={newShowName} onChange={(e) => setNewShowName(e.target.value)} required />
              </div>
              <div className="form-group">
                <label>Poster URL:</label>
                <input type="text" value={newPosterUrl} onChange={(e) => setNewPosterUrl(e.target.value)} required />
              </div>
            </>
          )}
          <div className="form-group">
            <label>Season Name:</label>
            <input type="text" value={seasonName} onChange={(e) => setSeasonName(e.target.value)} required />
          </div>
          <div className="form-group">
            <label>Question:</label>
            <input type="text" value={question} onChange={(e) => setQuestion(e.target.value)} required />
          </div>
          <div className="form-group">
            <label>Options (4):</label>
            {options.map((option, index) => (
              <input
                key={index}
                type="text"
                value={option}
                onChange={(e) => handleOptionChange(index, e.target.value)}
                required
              />
            ))}
          </div>
          <div className="form-group">
            <label>Correct Answer:</label>
            <input type="text" value={answer} onChange={(e) => setAnswer(e.target.value)} required />
          </div>
          <div className="form-actions">
            <button type="submit">Add Question</button>
            <button type="button" onClick={onCancel}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default QuestionForm;