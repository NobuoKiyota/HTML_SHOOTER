class MissionSelector {
    constructor(engine) {
        this.engine = engine;
        this.listEl = document.getElementById('mission-list');
    }

    render() {
        if (!this.listEl) return;
        try {
            this.listEl.innerHTML = "";
            const m = MissionManager.generateMissions();
            if (!m || m.length === 0) {
                this.listEl.innerHTML = "<div style='padding:10px'>No missions available</div>";
                return;
            }
            m.forEach(mi => {
                const weather = (GAME_SETTINGS.WEATHER && GAME_SETTINGS.WEATHER[mi.weather]) ? GAME_SETTINGS.WEATHER[mi.weather] : { name: "Unknown", Name: "Unknown" };
                const stars = "★".repeat(mi.stars || 1);
                const div = document.createElement('div');
                div.className = "list-item";
                // Secure innerHTML construction
                div.innerHTML = `<div><strong>${mi.title}</strong> <span style="color:#ff0">${stars}</span> [${weather.name || weather.Name}]<br>
                    <small>目標時間: ${mi.targetTime}s | 距離: ${mi.distance}m | 報酬: $${mi.reward}</small></div>`;

                const btn = document.createElement('button');
                btn.innerText = "受注";
                btn.onclick = () => {
                    SoundManager.play('CLICK');
                    console.log(`[MissionSelector] Mission Selected: ${mi.title}`);
                    this.engine.startMission(mi);
                };
                div.appendChild(btn);

                this.listEl.appendChild(div);
            });
        } catch (e) {
            console.error("[MissionSelector] Render Error:", e);
            this.listEl.innerHTML = "<div style='color:red'>Mission List Error</div>";
        }
    }
}
