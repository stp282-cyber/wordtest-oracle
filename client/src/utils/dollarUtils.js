import { db } from '../firebase';
import { doc, getDoc, updateDoc, addDoc, collection, query, where, getDocs } from 'firebase/firestore';

export const addDollars = async (userId, amount, reason, type = 'earned') => {
    try {
        const userRef = doc(db, 'users', userId);
        const userDoc = await getDoc(userRef);

        if (userDoc.exists()) {
            const currentBalance = userDoc.data().dollar_balance || 0;
            const newBalance = currentBalance + amount;

            await updateDoc(userRef, {
                dollar_balance: newBalance
            });

            await addDoc(collection(db, 'dollar_history'), {
                user_id: userId,
                amount: amount,
                reason: reason,
                type: type,
                date: new Date().toISOString(),
                balance_after: newBalance
            });

            return newBalance;
        }
    } catch (error) {
        console.error("Error adding dollars:", error);
    }
};

export const getRewardSettings = async () => {
    try {
        const docRef = doc(db, 'settings', 'rewards');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            // Ensure new field exists even if doc exists but is old
            return {
                game_daily_max_reward: 0.5,
                ...data
            };
        }
        return {
            daily_completion_reward: 0.5,
            curriculum_completion_reward: 0.1,
            game_high_score_reward: 0.05,
            game_high_score_threshold: 80,
            game_daily_max_reward: 0.5
        };
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
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayISO = today.toISOString();

        const q = query(
            collection(db, 'dollar_history'),
            where('user_id', '==', userId),
            where('type', '==', 'game_reward'),
            where('date', '>=', todayISO)
        );

        const querySnapshot = await getDocs(q);
        let total = 0;
        querySnapshot.forEach(doc => {
            total += doc.data().amount;
        });
        return total;
    } catch (error) {
        console.error("Error calculating daily game earnings:", error);
        return 0;
    }
};

export const hasReceivedDailyReward = async (userId) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayISO = today.toISOString();

        const q = query(
            collection(db, 'dollar_history'),
            where('user_id', '==', userId),
            where('reason', '==', '매일 학습 완료'),
            where('date', '>=', todayISO)
        );

        const querySnapshot = await getDocs(q);
        return !querySnapshot.empty;
    } catch (error) {
        console.error("Error checking daily reward:", error);
        return false;
    }
};
