import React, { useState, useEffect, useMemo, useCallback, Suspense, lazy } from 'react';
import Login from './Login';
import { fetchShows, fetchQuizQuestions, clearApiCache } from './mockApi';
import './App.css';

// Lazy-load modal and administrative components to reduce initial bundle size
const QuestionForm = lazy(() => import('./components/QuestionForm'));
const BulkQuestionForm = lazy(() => import('./components/BulkQuestionForm'));
const Leaderboard = lazy(() => import('./components/Leaderboard'));
const SeasonSelection = lazy(() => import('./components/SeasonSelection'));
const GlobalLeaderboard = lazy(() => import('./components/GlobalLeaderboard'));

// Module-scope shuffle so it isn't recreated on every render/call
function shuffleArray(arr) {
  const a = Array.isArray(arr) ? [...arr] : [];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Memoized individual ShowCard to prevent re-rendering all cards when search query changes
const ShowCard = React.memo(function ShowCard({ show, onStartQuiz, onShowLeaderboard }) {
  return (
    <div className="show-card">
      <div className="poster-wrapper">
        <img
          src={show.posterUrl}
          alt={`${show.name} poster`}
          loading="lazy"
          decoding="async"
          width="250"
          height="370"
          onError={(e) => {
            e.currentTarget.onerror = null;
            e.currentTarget.src = '/fallback-poster.svg';
          }}
        />
      </div>
      <div className="card-info">
        <h3 className="show-title">{show.name}</h3>
        <div className="card-actions">
          <button onClick={() => onShowLeaderboard(show.name)} className="view-leaderboard-btn">Leaderboard</button>
          <button onClick={() => onStartQuiz(show)} className="start-quiz-btn">Select Season</button>
        </div>
      </div>
    </div>
  );
});

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

  // Memoized show filter to avoid O(N) array scans and card re-renders on keystrokes
  const filteredShows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return allShows;
    return allShows.filter(show => (show.name || '').toLowerCase().includes(query));
  }, [allShows, searchQuery]);

  const handleStartQuiz = useCallback((show) => {
    setSelectedShow(show);
    setIsSelectingSeason(true);
  }, []);

  const handleShowLeaderboard = useCallback((name) => {
    setShowLeaderboard(name);
  }, []);

  const handleSelectSeason = useCallback(async (showName, seasonName, randomize = false) => {
    const questions = await fetchQuizQuestions(showName, seasonName);
    const isAllQuestions = seasonName.toLowerCase() === 'all questions';
    const base = isAllQuestions ? questions : questions.slice(0, 10);
    const ordered = randomize ? shuffleArray(base) : base;
    const withShuffledOptions = ordered.map(q => ({ ...q, options: shuffleArray(q.options || []) }));
    setQuizQuestions(withShuffledOptions);
    setIndex(0);
    setScore(0);
    setSelectedSeason(seasonName);
    setQuizStarted(true);
    setIsSelectingSeason(false);
  }, []);

  const handleAnswer = useCallback((option) => {
    setQuizQuestions((prevQuestions) => {
      if (option === prevQuestions[index]?.answer) {
        setScore(s => s + 1);
      }
      return prevQuestions;
    });
    setIndex(i => i + 1);
  }, [index]);

  const submitScore = useCallback(async () => {
    if (!currentUser || !selectedShow || !selectedSeason) return;
    try {
      await fetch('/submit-score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: currentUser, showName: selectedShow.name, seasonName: selectedSeason, score }),
      });
    } catch (err) {
      console.error('Failed to submit score:', err);
    }
  }, [currentUser, selectedShow, selectedSeason, score]);

  const resetGame = useCallback(async () => {
    if (quizStarted && selectedShow && currentUser) {
      await submitScore();
    }
    setQuizStarted(false);
    setSelectedShow(null);
    setSelectedSeason(null);
    setQuizQuestions([]);
    setIndex(0);
    setScore(0);
  }, [quizStarted, selectedShow, currentUser, submitScore]);

  const handleAddQuizQuestion = useCallback(async (newQuestion) => {
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
        clearApiCache();
        fetchShows(true).then(setAllShows);
      } else {
        alert(`Error: ${data.message}`);
      }
    } catch {
      alert('Failed to add question. Server might not be running.');
    }
  }, []);

  const handleBulkUpload = useCallback(async (questions) => {
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
        clearApiCache();
        fetchShows(true).then(setAllShows);
      } else {
        alert(`Error: ${data.message}`);
      }
    } catch {
      alert('Bulk upload failed. Server might not be running.');
    }
  }, []);

  // --- Suspense-wrapped lazy conditional views ---
  const modalFallback = <div className="modal-overlay"><div className="modal-content"><p>Loading...</p></div></div>;

  if (showGlobalLeaderboard) {
    return (
      <Suspense fallback={modalFallback}>
        <GlobalLeaderboard onClose={() => setShowGlobalLeaderboard(false)} />
      </Suspense>
    );
  }
  if (isAddingQuestion) {
    return (
      <Suspense fallback={modalFallback}>
        <QuestionForm onAddQuestion={handleAddQuizQuestion} onCancel={() => setIsAddingQuestion(false)} allShows={allShows} />
      </Suspense>
    );
  }
  if (isBulkUploading) {
    return (
      <Suspense fallback={modalFallback}>
        <BulkQuestionForm onBulkUpload={handleBulkUpload} onCancel={() => setIsBulkUploading(false)} />
      </Suspense>
    );
  }
  if (showLeaderboard) {
    return (
      <Suspense fallback={modalFallback}>
        <Leaderboard showName={showLeaderboard} onClose={() => setShowLeaderboard(null)} />
      </Suspense>
    );
  }
  if (isSelectingSeason) {
    return (
      <Suspense fallback={<div className="quiz-page-container"><h2>Loading Seasons...</h2></div>}>
        <SeasonSelection show={selectedShow} onSelectSeason={handleSelectSeason} onBack={() => setIsSelectingSeason(false)} />
      </Suspense>
    );
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
              <img
                src={selectedShow.posterUrl}
                alt={`${selectedShow.name} poster`}
                loading="lazy"
                decoding="async"
                width="250"
                height="370"
                onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = '/fallback-poster.svg'; }}
              />
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
            <img
              src={selectedShow.posterUrl}
              alt={`${selectedShow.name} poster`}
              loading="lazy"
              decoding="async"
              width="250"
              height="370"
              onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = '/fallback-poster.svg'; }}
            />
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
              <ShowCard
                key={show.id}
                show={show}
                onStartQuiz={handleStartQuiz}
                onShowLeaderboard={handleShowLeaderboard}
              />
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
