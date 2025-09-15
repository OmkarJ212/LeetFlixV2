import React, { useState } from 'react';

const BulkQuestionForm = ({ onBulkUpload, onCancel }) => {
  const [codeBlock, setCodeBlock] = useState('');
  
  const handleSubmit = (e) => {
    e.preventDefault();
    try {
      const questions = JSON.parse(codeBlock);
      if (Array.isArray(questions)) {
        onBulkUpload(questions);
      } else {
        alert('Invalid JSON format. The top-level element must be an array of questions.');
      }
    } catch (error) {
      alert('Invalid JSON format. Please check your syntax carefully.');
      console.error(error); // Log the error for more detail
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>Bulk Upload Quiz Questions</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Paste a JSON array of questions:</label>
            <textarea
              value={codeBlock}
              onChange={(e) => setCodeBlock(e.target.value)}
              rows="15"
              required
            />
          </div>
          <div className="form-actions">
            <button type="submit">Upload</button>
            <button type="button" onClick={onCancel}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BulkQuestionForm;