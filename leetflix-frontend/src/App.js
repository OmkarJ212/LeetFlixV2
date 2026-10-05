import React, { useState, useEffect } from 'react';
import Login from './Login';
import QuestionForm from './components/QuestionForm';
import BulkQuestionForm from './components/BulkQuestionForm';
import Leaderboard from './components/Leaderboard';
import SeasonSelection from './components/SeasonSelection';
import GlobalLeaderboard from './components/GlobalLeaderboard';
import { fetchShows, fetchQuizQuestions } from './mockApi';
import './App.css';

// Module-scope shuffle so it isn't recreated on every render/call.
function shuffleArray(arr) {
  const a = Array.isArray(arr) ? [...arr] : [];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// MainApp is at module scope so React never treats it as a new component
// type between renders of App, preventing full remounts and state loss.
function MainApp({ currentUser, isAdmin, isDarkMode, handleLogout, toggleTheme }) {
  const [allShows, setAllShows] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedShow, setSelectedShow] = useState(null);
  const [selectedSeason, setSelectedSeason] = useState(null);
  const [isAddingQuestion, setIsAddingQuestion] = useState(false);
  const [isBulkUploading, setIsBulkUploading] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(null);
  const [showGlobalLeaderboard, setShowGlobalLeaderboard] = useState(false);
  const [isSelectingSeason, setIsSelectingSeason] = useState(false);
  const [quizQuestions, setQuizQuestions] = useState([]);
  const [quizStarted, setQuizStarted] = useState(false);
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);

  useEffect(() => {
    fetchShows().then(setAllShows).finally(() => setIsLoading(false));
  }, []);

  const filteredShows = allShows.filter(show =>
    show.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleStartQuiz = (show) => {
    setSelectedShow(show);
    setIsSelectingSeason(true);
  };

  const handleSelectSeason = async (showName, seasonName, randomize = false) => {
    const questions = await fetchQuizQuestions(showName, seasonName);
    const isAllQuestions = seasonName.toLowerCase() === 'all questions';
    const base = isAllQuestions ? questions : questions.slice(0, 10);
    const ordered = randomize ? shuffleArray(base) : base;
    // Shuffle each question's options independently
    const withShuffledOptions = ordered.map(q => ({ ...q, options: shuffleArray(q.options || []) }));
    setQuizQuestions(withShuffledOptions);
    setIndex(0);
    setScore(0);
    setSelectedSeason(seasonName);
    setQuizStarted(true);
    setIsSelectingSeason(false);
  };

  const handleAnswer = (option) => {
    if (option === quizQuestions[index].answer) setScore(s => s + 1);
    setIndex(i => i + 1);
  };

  const submitScore = async () => {
    try {
      await fetch('/submit-score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: currentUser, showName: selectedShow.name, seasonName: selectedSeason, score }),
      });
    } catch (err) {
      console.error('Failed to submit score:', err);
    }
  };

  const resetGame = () => {
    if (quizStarted && selectedShow && currentUser) submitScore();
    setQuizStarted(false);
    setSelectedShow(null);
    setSelectedSeason(null);
    setQuizQuestions([]);
    setIndex(0);
    setScore(0);
  };

  const handleAddQuizQuestion = async (newQuestion) => {
    try {
      const response = await fetch('/add-question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newQuestion),
      });
      const data = await response.json();
      if (response.ok) {
        alert(data.message);
        setIsAddingQuestion(false);
        fetchShows().then(setAllShows);
      } else {
        alert(`Error: ${data.message}`);
      }
    } catch {
      alert('Failed to add question. Server might not be running.');
    }
  };

  const handleBulkUpload = async (questions) => {
    try {
      const response = await fetch('/bulk-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questions }),
      });
      const data = await response.json();
      if (response.ok) {
        alert(data.message);
        setIsBulkUploading(false);
        fetchShows().then(setAllShows);
      } else {
        alert(`Error: ${data.message}`);
      }
    } catch {
      alert('Bulk upload failed. Server might not be running.');
    }
  };

  // --- Conditional views ---

  if (showGlobalLeaderboard) {
    return <GlobalLeaderboard onClose={() => setShowGlobalLeaderboard(false)} />;
  }
  if (isAddingQuestion) {
    return <QuestionForm onAddQuestion={handleAddQuizQuestion} onCancel={() => setIsAddingQuestion(false)} allShows={allShows} />;
  }
  if (isBulkUploading) {
    return <BulkQuestionForm onBulkUpload={handleBulkUpload} onCancel={() => setIsBulkUploading(false)} />;
  }
  if (showLeaderboard) {
    return <Leaderboard showName={showLeaderboard} onClose={() => setShowLeaderboard(null)} />;
  }
  if (isSelectingSeason) {
    return <SeasonSelection show={selectedShow} onSelectSeason={handleSelectSeason} onBack={() => setIsSelectingSeason(false)} />;
  }

  if (quizStarted) {
    if (quizQuestions.length === 0) {
      return <div className="quiz-page-container"><h2>Loading Quiz...</h2></div>;
    }
    const currentQuestion = quizQuestions[index];
    if (!currentQuestion) {
      return (
        <div className="quiz-page-container">
          <div className="fixed-poster">
            <div className="poster-wrapper small-poster">
              <img src={selectedShow.posterUrl} alt={`${selectedShow.name} poster`}
                onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = '/fallback-poster.svg'; }} />
            </div>
          </div>
          <div className="quiz-container">
            <h2>Quiz Complete!</h2>
            <p className="question-text">Your score is: {score} / {quizQuestions.length}</p>
            <button onClick={resetGame} className="reset-quiz-btn">Play Again</button>
          </div>
        </div>
      );
    }
    return (
      <div className="quiz-page-container">
        <div className="fixed-poster">
          <div className="poster-wrapper small-poster">
            <img src={selectedShow.posterUrl} alt={`${selectedShow.name} poster`}
              onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = '/fallback-poster.svg'; }} />
          </div>
        </div>
        <div className="quiz-container">
          <button type="button" onClick={resetGame} className="home-button">Quit Quiz</button>
          <div className="quiz-header">
            <h1>{selectedShow.name}</h1>
            <h2>Question {index + 1} of {quizQuestions.length}</h2>
          </div>
          <p className="question-text">{currentQuestion.question}</p>
          <div className="options-container season-options">
            {currentQuestion.options.map((option, idx) => (
              <button key={idx} className="option" onClick={() => handleAnswer(option)}>
                <span className="option-text">{option}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // --- Main browse view ---
  return (
    <div className={`app-container ${isDarkMode ? 'dark-theme' : 'light-theme'}`}>
      <header className="navbar">
        <h1 className="logo">LEET<span className="brand-leet">FLIX</span></h1>
        <div className="user-info">
          {currentUser && <span className="welcome-message">Welcome, {currentUser}!</span>}
          <div className="dropdown">
            <button className="dropdown-toggle">
              <span className="bar" /><span className="bar" /><span className="bar" />
            </button>
            <div className="dropdown-menu">
              <button onClick={() => setShowGlobalLeaderboard(true)} className="dropdown-btn">Global Leaderboard</button>
              <button onClick={handleLogout} className="dropdown-btn">Logout</button>
              {isAdmin && (
                <>
                  <button onClick={() => setIsAddingQuestion(true)} className="dropdown-btn">Add Question</button>
                  <button onClick={() => setIsBulkUploading(true)} className="dropdown-btn">Bulk Upload</button>
                </>
              )}
              <button onClick={toggleTheme} className="dropdown-btn">
                Switch to {isDarkMode ? 'Light' : 'Dark'} Theme
              </button>
            </div>
          </div>
        </div>
      </header>
      <main>
        <div className="filter-bar">
          <input
            type="text"
            placeholder="Search for a show..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-bar"
          />
        </div>
        <div className="show-grid">
          {isLoading ? (
            <p className="loading-message">Loading shows...</p>
          ) : filteredShows.length > 0 ? (
            filteredShows.map((show) => (
              <div key={show.id} className="show-card">
                <div className="poster-wrapper">
                  <img src={show.posterUrl} alt={`${show.name} poster`}
                    onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = '/fallback-poster.svg'; }} />
                </div>
                <div className="card-info">
                  <h3 className="show-title">{show.name}</h3>
                  <div className="card-actions">
                    <button onClick={() => setShowLeaderboard(show.name)} className="view-leaderboard-btn">Leaderboard</button>
                    <button onClick={() => handleStartQuiz(show)} className="start-quiz-btn">Select Season</button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p className="loading-message">No shows found.</p>
          )}
        </div>
      </main>
    </div>
  );
}

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);

  const handleLogin = async (username, password) => {
    try {
      const response = await fetch('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await response.json();
      if (response.ok) {
        setIsLoggedIn(true);
        setCurrentUser(data.username);
        setIsAdmin(data.isAdmin || false);
      } else {
        alert(`Error: ${data.message}`);
      }
    } catch {
      alert('Login failed. The server might not be running.');
    }
  };

  const handleSignup = async (username, password) => {
    try {
      const response = await fetch('/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await response.json();
      if (response.ok) {
        alert(data.message);
        handleLogin(username, password);
      } else {
        alert(`Error: ${data.message}`);
      }
    } catch {
      alert('Signup failed. The server might not be running.');
    }
  };

  const handleAdminLogin = async (username, password, adminKey) => {
    try {
      const response = await fetch('/admin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, adminKey }),
      });
      const data = await response.json();
      if (response.ok) {
        setIsLoggedIn(true);
        setCurrentUser(data.username);
        setIsAdmin(true);
      } else {
        alert(`Error: ${data.message}`);
      }
    } catch {
      alert('Admin login failed. The server might not be running.');
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setCurrentUser(null);
    setIsAdmin(false);
  };

  const toggleTheme = () => setIsDarkMode(d => !d);

  if (!isLoggedIn) {
    return (
      <div className={`app ${isDarkMode ? 'dark-theme' : 'light-theme'}`}>
        <Login onLogin={handleLogin} onSignup={handleSignup} onAdminLogin={handleAdminLogin} />
      </div>
    );
  }

  return (
    <div className={`app ${isDarkMode ? 'dark-theme' : 'light-theme'}`}>
      <MainApp
        currentUser={currentUser}
        isAdmin={isAdmin}
        isDarkMode={isDarkMode}
        handleLogout={handleLogout}
        toggleTheme={toggleTheme}
      />
    </div>
  );
}

export default App;