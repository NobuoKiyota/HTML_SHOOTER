/**
 * 依頼管理クラス
 * ランダムな依頼の生成と報酬計算を行う
 */
const MissionManager = {
    // 3つのランダムな依頼を生成
    // Generate 3 missions based on player stats
    generateMissions: (playerData) => {
        const missions = [];
        // Calculate Total Stats (Sum of all upgrade levels)
        let totalStats = 0;
        if (playerData && playerData.upgradeLevels) {
            totalStats = Object.values(playerData.upgradeLevels).reduce((a, b) => a + b, 0);
        }

        // Determine Difficulty Probabilities
        const scaling = GAME_BALANCE_DATA.MISSION_DATA.DIFFICULTY_SCALING;
        let probs = scaling[0].probs;
        for (let i = 0; i < scaling.length; i++) {
            if (totalStats >= scaling[i].minStat) {
                probs = scaling[i].probs;
            }
        }

        for (let i = 0; i < 3; i++) {
            // Select Stars based on probability
            const rand = Math.floor(Math.random() * 100);
            let stars = 1;
            let cum = 0;
            for (let s in probs) {
                cum += probs[s];
                if (rand < cum) { stars = parseInt(s); break; }
            }

            const params = GAME_BALANCE_DATA.MISSION_DATA.DIFFICULTY_PARAMS[stars];
            const dist = Math.floor(Math.random() * (params.dist[1] - params.dist[0])) + params.dist[0];

            // Weight (Random 1-5 for now, could be scaled?)
            const weight = Math.floor(Math.random() * 5) + 1;

            // Reward Calculation
            const baseReward = dist * 0.5; // Base rate
            const reward = Math.floor(baseReward * params.rewardMod);
            const penalty = Math.floor(reward * 0.5);

            // Target Time (Avg speed ~12m/s)
            const targetTime = Math.floor(dist / 12) + 20;

            missions.push({
                id: `mission-${Date.now()}-${i}`,
                title: `輸送依頼 Lv.${stars}`,
                stars: stars,
                distance: dist,
                weight: weight,
                reward: reward,
                penalty: penalty,
                targetTime: targetTime,
                weatherTable: params.weatherTable, // Setup for dynamic weather
                enemyTier: params.enemyTier
            });
        }
        return missions;
    },

    rerollMissions: (playerData) => {
        const COST = 100;
        if (playerData.money < COST) return null;
        playerData.money -= COST;
        return MissionManager.generateMissions(playerData);
    }
};
