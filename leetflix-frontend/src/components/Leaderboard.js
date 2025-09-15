import React, { useState, useEffect } from 'react';

const Leaderboard = ({ showName, onClose }) => {
    const [leaderboardData, setLeaderboardData] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchLeaderboard = async () => {
            try {
                const encodedName = encodeURIComponent(showName);
                const response = await fetch(`http://localhost:3001/leaderboard/${encodedName}`);
                if (response.ok) {
                    const data = await response.json();
                    setLeaderboardData(data);
                } else {
                    setLeaderboardData([]);
                }
            } catch (error) {
                console.error('Error fetching leaderboard:', error);
                setLeaderboardData([]);
            } finally {
                setIsLoading(false);
            }
        };
        fetchLeaderboard();
    }, [showName]);

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <h2>Leaderboard for {showName}</h2>
                {isLoading ? (
                    <p>Loading leaderboard...</p>
                ) : leaderboardData.length > 0 ? (
                    <ul className="leaderboard-list">
                        {leaderboardData.map((entry, index) => (
                            <li key={index} className="leaderboard-entry">
                                <span>{index + 1}. {entry.username}</span>
                                <span>Score: {entry.score}</span>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p>No scores submitted yet for this show.</p>
                )}
                <div className="form-actions">
                    <button type="button" onClick={onClose}>Close</button>
                </div>
            </div>
        </div>
    );
};

export default Leaderboard;