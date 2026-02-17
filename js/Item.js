class Item {
    constructor(x, y, typeId) {
        this.x = x;
        this.y = y;
        this.typeId = typeId || "TypeA";

        // Lookup meta from MATERIALS or DROP_ITEMS
        this.meta = null;
        this.category = "MATERIAL"; // Default

        if (GAME_BALANCE_DATA.DROP_ITEMS && GAME_BALANCE_DATA.DROP_ITEMS[this.typeId]) {
            this.meta = GAME_BALANCE_DATA.DROP_ITEMS[this.typeId];
            this.category = this.meta.Type; // BUFF, HEAL, MONEY, STAT
        } else if (GAME_BALANCE_DATA.MATERIALS && GAME_BALANCE_DATA.MATERIALS[this.typeId]) {
            this.meta = GAME_BALANCE_DATA.MATERIALS[this.typeId];
            this.category = "MATERIAL";
        }

        this.name = this.meta ? this.meta.Name : "Unknown";
        this.color = this.meta ? (this.meta.Color || "#f1c40f") : "#f1c40f";

        this.vx = (Math.random() - 0.5) * 2;
        this.vy = -3; // Initial pop up
        this.gravity = 0.1;
        this.width = 24;
        this.height = 24;

        this.markedForDeletion = false;
        this.life = 900; // 15 seconds

        this.isMagnetized = false;
        this.frameCount = 0;
        this.scale = 1.0;
    }

    update(playerX, playerY, hasCollector) {
        this.life--;
        this.frameCount++;

        // Pulse Animation: 80% > 100% > 120% > 100% > 80% ...
        // Cycle every 20 frames (5 frames per step approx)
        // Using explicit steps or sine wave?
        // "5フレーム毎に 확대 축소" implies step changes?
        // Let's use a smooth sine for better visual, or stepped if strict.
        // User said: "5フレーム毎に... 80%>100%>120%>100%>80%"
        // Frame 0-4: 80%, 5-9: 100%, 10-14: 120%, 15-19: 100%, 20-24: 80%
        const cycle = Math.floor(this.frameCount / 5) % 4;
        // 0->0.8, 1->1.0, 2->1.2, 3->1.0
        if (cycle === 0) this.scale = 0.8;
        else if (cycle === 1) this.scale = 1.0;
        else if (cycle === 2) this.scale = 1.2;
        else this.scale = 1.0;

        if (this.life <= 0 || this.y > 900) {
            this.markedForDeletion = true;
            return;
        }

        // Magnet logic
        if (hasCollector) {
            const dx = playerX - this.x;
            const dy = playerY - this.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 250) { // Extended range for upgrades
                this.isMagnetized = true;
                this.vx += dx * 0.005; // Smooth accel
                this.vy += dy * 0.005;
            }
        }

        if (!this.isMagnetized) {
            this.vy += this.gravity;
            if (this.vy > 3) this.vy = 3;

            this.x += this.vx;
            this.y += this.vy;

            this.vx *= 0.98;
        } else {
            // Magnet movement
            this.x += this.vx;
            this.y += this.vy;
            this.vx *= 0.95; // Damping
            this.vy *= 0.95;
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.scale(this.scale, this.scale);

        // Glow effect based on color
        ctx.shadowBlur = 15;
        ctx.shadowColor = this.color;
        ctx.fillStyle = this.color;

        // Shape based on Category/Type
        if (this.category === "STAT") { // Legalia (Star)
            this.drawStar(ctx, 0, 0, 5, this.width / 2, this.width / 4);
        } else if (this.category === "BUFF" || this.category === "HEAL") { // Circle
            ctx.beginPath();
            ctx.arc(0, 0, this.width / 2, 0, Math.PI * 2);
            ctx.fill();
        } else if (this.category === "MONEY") { // Diamond/Crystal? Or Circle? User said "Purple"
            // Let's use Diamond
            ctx.beginPath();
            ctx.moveTo(0, -this.height / 2);
            ctx.lineTo(this.width / 2, 0);
            ctx.lineTo(0, this.height / 2);
            ctx.lineTo(-this.width / 2, 0);
            ctx.fill();
        } else { // MATERIAL (Rect)
            ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);
        }

        // Text/Icon overlay
        ctx.shadowBlur = 0; // Reset shadow for text
        ctx.fillStyle = "black"; // Or white depending on color?
        // Most colors are bright, black text is safe.
        ctx.font = "bold 10px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        // Display Short Name or ID suffix?
        // Materials: TypeA -> 'A'
        // Buffs: PU01 -> 'P'
        // Let's deduce specific char
        let label = "?";
        if (this.category === "MATERIAL") {
            label = this.typeId.replace("Type", "");
        } else if (this.typeId.startsWith("PU")) label = "P";
        else if (this.typeId.startsWith("OS")) label = "O";
        else if (this.typeId.startsWith("LU")) label = "L";
        else if (this.typeId.startsWith("SP")) label = "S";
        else if (this.typeId.startsWith("SD")) label = "Shield";
        else if (this.typeId.startsWith("JL")) label = "$";
        else if (this.typeId.startsWith("LG")) label = "★";

        // Adjust font for Shield
        if (label.length > 1) ctx.font = "bold 8px Arial";

        ctx.fillText(label, 0, 0);

        ctx.restore();
    }

    drawStar(ctx, cx, cy, spikes, outerRadius, innerRadius) {
        let rot = Math.PI / 2 * 3;
        let x = cx;
        let y = cy;
        let step = Math.PI / spikes;

        ctx.beginPath();
        ctx.moveTo(cx, cy - outerRadius);
        for (let i = 0; i < spikes; i++) {
            x = cx + Math.cos(rot) * outerRadius;
            y = cy + Math.sin(rot) * outerRadius;
            ctx.lineTo(x, y);
            rot += step;

            x = cx + Math.cos(rot) * innerRadius;
            y = cy + Math.sin(rot) * innerRadius;
            ctx.lineTo(x, y);
            rot += step;
        }
        ctx.lineTo(cx, cy - outerRadius);
        ctx.closePath();
        ctx.fill();
    }
}
