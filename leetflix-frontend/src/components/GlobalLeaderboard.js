import React, { useState, useEffect } from 'react';

const GlobalLeaderboard = ({ onClose }) => {
    const [leaderboardData, setLeaderboardData] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchGlobalLeaderboard = async () => {
            try {
                const response = await fetch('http://localhost:3001/global-leaderboard');
                if (response.ok) {
                    const data = await response.json();
                    setLeaderboardData(data);
                } else {
                    setLeaderboardData([]);
                }
            } catch (error) {
                console.error('Error fetching global leaderboard:', error);
                setLeaderboardData([]);
            } finally {
                setIsLoading(false);
            }
        };
        fetchGlobalLeaderboard();
    }, []);

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <h2>Global Leaderboard</h2>
                {isLoading ? (
                    <p>Calculating global scores...</p>
                ) : leaderboardData.length > 0 ? (
                    <ul className="leaderboard-list">
                        {leaderboardData.map((entry, index) => (
                            <li key={index} className="leaderboard-entry">
                                <span>{index + 1}. {entry.username}</span>
                                <span>Global Score: {entry.globalScore}</span>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p>No global scores submitted yet.</p>
                )}
                <div className="form-actions">
                    <button type="button" onClick={onClose}>Close</button>
                </div>
            </div>
        </div>
    );
};

export default GlobalLeaderboard;