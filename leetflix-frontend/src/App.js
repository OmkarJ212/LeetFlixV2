import React, { useState, useEffect } from 'react';
import Login from './Login';
import QuestionForm from './components/QuestionForm';
import BulkQuestionForm from './components/BulkQuestionForm';
import Leaderboard from './components/Leaderboard';
import SeasonSelection from './components/SeasonSelection';
import GlobalLeaderboard from './components/GlobalLeaderboard'; 
import { fetchShows, fetchQuizQuestions } from './mockApi';
import './App.css';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [showGlobalLeaderboard, setShowGlobalLeaderboard] = useState(false);

  const handleSignup = async (username, password) => {
    try {
      const response = await fetch('http://localhost:3001/signup', {
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
    } catch (error) {
      alert('Signup failed. The server might not be running.');
    }
  };

  const handleLogin = async (username, password) => {
    try {
      const response = await fetch('http://localhost:3001/login', {
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
    } catch (error) {
      alert('Login failed. The server might not be running.');
    }
  };
  
  const handleAdminLogin = async (username, password, adminKey) => {
      try {
          const response = await fetch('http://localhost:3001/admin-login', {
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
      } catch (error) {
          alert('Admin login failed. The server might not be running.');
      }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setCurrentUser(null);
    setIsAdmin(false);
  };
  
  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
  };

  const MainApp = () => {
    const [allShows, setAllShows] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedShow, setSelectedShow] = useState(null);
    const [isAddingQuestion, setIsAddingQuestion] = useState(false);
    const [isBulkUploading, setIsBulkUploading] = useState(false);
    const [showLeaderboard, setShowLeaderboard] = useState(null);
    const [isSelectingSeason, setIsSelectingSeason] = useState(false);
    
    // NEW: Add a state variable to hold the selected season name
    const [selectedSeason, setSelectedSeason] = useState(null);

    const [quizQuestions, setQuizQuestions] = useState([]);
    const [quizStarted, setQuizStarted] = useState(false);
    const [index, setIndex] = useState(0);
    const [score, setScore] = useState(0);

    useEffect(() => {
      const getShows = async () => {
        setIsLoading(true);
        const showsData = await fetchShows();
        setAllShows(showsData);
        setIsLoading(false);
      };
      getShows();
    }, []);

    const filteredShows = allShows.filter(show =>
      show.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleStartQuiz = (show) => {
        setSelectedShow(show);
        setIsSelectingSeason(true);
    };

    const handleSelectSeason = async (showName, seasonName) => {
      const questions = await fetchQuizQuestions(showName, seasonName);
      setQuizQuestions(questions);
      setQuizStarted(true);
      setIsSelectingSeason(false);
      // NEW: Set the selected season name in state
      setSelectedSeason(seasonName); 
    };
    
    const handleAnswer = (option) => {
      if (option === quizQuestions[index].answer) {
        setScore(score + 1);
      }
      setIndex(index + 1);
    };

    const submitScore = async () => {
        try {
            await fetch('http://localhost:3001/submit-score', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: currentUser,
                    showName: selectedShow.name,
                    // NEW: Include the selected season name in the score submission
                    seasonName: selectedSeason,
                    score: score
                })
            });
        } catch (error) {
            console.error("Failed to submit score:", error);
        }
    };

    const resetGame = () => {
      if (quizStarted && selectedShow && currentUser) {
          submitScore();
      }
      setQuizStarted(false);
      setSelectedShow(null);
      setQuizQuestions([]);
      setIndex(0);
      setScore(0);
      // NEW: Clear the selected season when the game resets
      setSelectedSeason(null);
    };

    const currentQuestion = quizQuestions[index];
    
    const handleAddQuizQuestion = async (newQuestion) => {
      const endpoint = '/add-question';
      try {
        const response = await fetch(`http://localhost:3001${endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newQuestion),
        });
        const data = await response.json();
        if (response.ok) {
          alert(data.message);
          setIsAddingQuestion(false);
          const updatedShows = await fetchShows();
          setAllShows(updatedShows);
        } else {
          alert(`Error: ${data.message}`);
        }
      } catch (error) {
        alert('Failed to add question. Server might not be running.');
      }
    };
    
    const handleBulkUpload = async (questions) => {
        try {
            const response = await fetch('http://localhost:3001/bulk-upload', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ questions }),
            });
            const data = await response.json();
            if (response.ok) {
                alert(data.message);
                setIsBulkUploading(false);
                const updatedShows = await fetchShows();
                setAllShows(updatedShows);
            } else {
                alert(`Error: ${data.message}`);
            }
        } catch (error) {
            alert('Bulk upload failed. Server might not be running.');
        }
    };
    
    if (showGlobalLeaderboard) {
        return <GlobalLeaderboard onClose={() => setShowGlobalLeaderboard(false)} />;
    }

    if (isAddingQuestion) {
      return (
        <QuestionForm
          onAddQuestion={handleAddQuizQuestion}
          onCancel={() => setIsAddingQuestion(false)}
          allShows={allShows}
        />
      );
    }
    
    if (isBulkUploading) {
        return (
            <BulkQuestionForm
                onBulkUpload={handleBulkUpload}
                onCancel={() => setIsBulkUploading(false)}
            />
        );
    }
    
    if (showLeaderboard) {
        return <Leaderboard showName={showLeaderboard} onClose={() => setShowLeaderboard(null)} />;
    }

    if (isSelectingSeason) {
      return (
        <SeasonSelection
          show={selectedShow}
          onSelectSeason={handleSelectSeason}
          onBack={() => setIsSelectingSeason(false)}
        />
      );
    }

    if (quizStarted) {
      if (quizQuestions.length === 0) return <div className="quiz-page-container"><h2>Loading Quiz...</h2></div>;
      if (!currentQuestion) {
        return (
          <div className="quiz-page-container">
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
          <div className="quiz-container">
            <button type="button" onClick={resetGame} className="home-button">Quit Quiz</button>
            <div className="quiz-header">
              <h1>{selectedShow.name}</h1>
              <h2>Question {index + 1} of {quizQuestions.length}</h2>
            </div>
            <p className="question-text">{currentQuestion.question}</p>
            <div className="options-container">
              {currentQuestion.options.map((option, idx) => (
                <button
                  key={idx}
                  className="option"
                  onClick={() => handleAnswer(option)}
                >
                  <span className="option-text">{option}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className={`app-container ${isDarkMode ? 'dark-theme' : 'light-theme'}`}>
        <header className="navbar">
          <h1 className="logo">
            LEET<span className="brand-leet">FLIX</span>
          </h1>
          <div className="user-info">
            {currentUser && <span className="welcome-message">Welcome, {currentUser}!</span>}
            <div className="dropdown">
              <button className="dropdown-toggle">
                <span className="bar"></span>
                <span className="bar"></span>
                <span className="bar"></span>
              </button>
              <div className="dropdown-menu">
                {isLoggedIn && (
                  <>
                    <button onClick={() => setShowGlobalLeaderboard(true)} className="dropdown-btn">Global Leaderboard</button>
                    <button onClick={handleLogout} className="dropdown-btn">Logout</button>
                  </>
                )}
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
                  <img src={show.posterUrl} alt={`${show.name} poster`} className="show-poster" />
                  <div className="card-info">
                    <h3 className="show-title">{show.name}</h3>
                    <button onClick={() => handleStartQuiz(show)} className="start-quiz-btn">Start Quiz</button>
                    <button onClick={() => setShowLeaderboard(show.name)} className="view-leaderboard-btn">Leaderboard</button>
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
  };
  
  return (
    <div className={`app ${isDarkMode ? 'dark-theme' : 'light-theme'}`}>
      {!isLoggedIn ? (
        <Login onLogin={handleLogin} onSignup={handleSignup} onAdminLogin={handleAdminLogin} />
      ) : (
        <MainApp />
      )}
    </div>
  );
}

export default App;