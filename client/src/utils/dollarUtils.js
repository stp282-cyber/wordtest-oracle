import { addReward, getRewardSettings as fetchRewardSettings, getDailyGameEarnings as fetchDailyEarnings } from '../api/client';

export const addDollars = async (userId, amount, reason, type = 'earned') => {
    try {
        const result = await addReward(userId, amount, reason, type);
        return result.newBalance;
    } catch (error) {
        console.error("Error adding dollars:", error);
        return null;
    }
};

export const getRewardSettings = async () => {
    try {
        return await fetchRewardSettings();
    } catch (error) {
        console.error("Error fetching reward settings:", error);
        return {
            daily_completion_reward: 0.5,
            curriculum_completion_reward: 0.1,
            game_high_score_reward: 0.05,
            game_high_score_threshold: 80,
            game_daily_max_reward: 0.5
        };
    }
};

export const getDailyGameEarnings = async (userId) => {
    try {
        return await fetchDailyEarnings(userId);
    } catch (error) {
        console.error("Error calculating daily game earnings:", error);
        return 0;
    }
};

// This function might need a backend endpoint if we want to check daily reward status properly.
// For now, we can assume it's handled by the backend or client logic.
// If needed, we can add an API for this.
export const hasReceivedDailyReward = async (userId) => {
    // TODO: Implement API for checking daily reward status if needed.
    // For now, returning false to allow reward (backend should handle duplicate checks if critical).
    return false;
};
