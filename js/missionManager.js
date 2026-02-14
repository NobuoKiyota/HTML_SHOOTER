/**
 * 依頼管理クラス
 * ランダムな依頼の生成と報酬計算を行う
 */
const MissionManager = {
    // 3つのランダムな依頼を生成
    generateMissions: () => {
        const missionTypes = [
            { id: 'short', name: '近距離配送', distRange: [200, 300], rewardMod: 0.5, penaltyMod: 0.5 },
            { id: 'medium', name: '通常輸送', distRange: [400, 600], rewardMod: 0.8, penaltyMod: 1.0 },
            { id: 'long', name: '遠距離密輸', distRange: [800, 1000], rewardMod: 1.5, penaltyMod: 2.0 }
        ];

        const weathers = Object.keys(GAME_SETTINGS.WEATHER);

        return [0, 1, 2].map(i => {
            const type = missionTypes[Math.floor(Math.random() * missionTypes.length)];
            const weatherKey = weathers[Math.floor(Math.random() * weathers.length)];
            const weather = GAME_SETTINGS.WEATHER[weatherKey];

            const distance = Math.floor(Math.random() * (type.distRange[1] - type.distRange[0]) + type.distRange[0]);
            const weight = Math.floor(Math.random() * 5) + 1;
            const reward = Math.floor(distance * type.rewardMod * weather.multiply);
            const penalty = Math.floor(reward * type.penaltyMod);

            // 目標時間を設定 (距離から算出)
            // 重量による速度低下を考慮して、平均秒速12m前後を目標にする
            const targetTime = Math.floor(distance / (10 + Math.random() * 5)) + 15;

            // 難易度星 (1-5)
            let stars = 1;
            if (type.id === 'medium') stars = 2 + Math.floor(Math.random() * 2);
            if (type.id === 'long') stars = 4 + Math.floor(Math.random() * 1);

            return {
                id: `mission-${Date.now()}-${i}`,
                title: `${type.name} #${Math.floor(Math.random() * 999)}`,
                distance: distance,
                weather: weatherKey,
                weight: weight,
                reward: reward,
                penalty: penalty,
                difficulty: type.id,
                targetTime: targetTime,
                stars: stars
            };
        });
    }
};
