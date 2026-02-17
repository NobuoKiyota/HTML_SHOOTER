
/**
 * ShipEditor Class
 * Handles the Ship Modification UI (Grid, Warehouse, Shop, Confirmation)
 */
class ShipEditor {
    constructor(engine) {
        console.log("[ShipEditor] Initialized");
        this.engine = engine;
        this.data = engine.data;
        this.gridEl = document.getElementById('ship-grid');
        this.warehouseEl = document.getElementById('warehouse-list');
        this.shopEl = document.getElementById('part-list');
        console.log("[ShipEditor] Elements:", this.gridEl ? "Found" : "Missing", this.warehouseEl ? "Found" : "Missing", this.shopEl ? "Found" : "Missing");
    }

    // --- Main Render Loop for Editor UI ---
    render() {
        console.log("[ShipEditor] Render called");
        this.drawGrid();
        this.renderWarehouse();
        this.renderPartShop();
    }

    // --- Grid Rendering & Interaction ---
    drawGrid() {
        if (!this.gridEl) return;
        this.gridEl.innerHTML = "";
        const data = this.data.gridData;

        // グリッドセル作成
        const maxSize = GridManager.GRID_MAX_SIZE || 10;
        const layout = GAME_SETTINGS.SHIP_LAYOUT;

        for (let r = 0; r < maxSize; r++) {
            for (let c = 0; c < maxSize; c++) {
                const cell = document.createElement('div');
                cell.className = "grid-cell";
                const cellType = layout[r] ? layout[r][c] : 0; // 0: Void
                const isUnlocked = data.unlockedCells.some(uc => uc.r === r && uc.c === c);

                if (cellType === 0) {
                    cell.classList.add('void');
                    cell.style.visibility = "hidden";
                } else if (isUnlocked) {
                    cell.classList.add('unlocked');
                    cell.ondragover = (e) => e.preventDefault();
                } else {
                    cell.classList.add('locked');
                    cell.innerText = "+";

                    const hasNeighbor = data.unlockedCells.some(uc => Math.abs(uc.r - r) + Math.abs(uc.c - c) === 1);
                    if (hasNeighbor) {
                        cell.style.cursor = "pointer";
                        cell.title = `解放コスト: $${GridManager.CELL_UNLOCK_PRICE}`;
                        cell.onclick = () => {
                            console.log("[ShipEditor] Locked Cell Clicked");
                            SoundManager.play('CLICK');
                            this.buyCell(r, c);
                        };
                        cell.style.opacity = "1.0";
                        cell.style.backgroundColor = "#444";
                    } else {
                        cell.style.opacity = "0.3";
                        cell.innerText = "";
                    }
                }
                this.gridEl.appendChild(cell);
            }
        }

        this.setupGridDrop();
        this.drawParts();
    }

    setupGridDrop() {
        const data = this.data.gridData;
        const CELL_SIZE = 36;
        const GAP = 2;

        this.gridEl.ondrop = (e) => {
            e.preventDefault();
            const partId = e.dataTransfer.getData('partId');
            const fromWarehouse = e.dataTransfer.getData('fromWarehouse');
            const rect = this.gridEl.getBoundingClientRect();
            const c = Math.floor((e.clientX - rect.left) / (CELL_SIZE + GAP));
            const r = Math.floor((e.clientY - rect.top) / (CELL_SIZE + GAP));

            if (!partId) return;

            console.log(`[ShipEditor] Drop at ${r},${c}. ID: ${partId}, Warehouse: ${fromWarehouse}`);

            if (fromWarehouse) {
                const idx = data.warehouse.findIndex(p => p.id === partId);
                if (idx === -1) return;
                const p = data.warehouse[idx];
                if (GridManager.isValidPlacement(data, p.type, r, c)) {
                    data.warehouse.splice(idx, 1);
                    p.r = r; p.c = c;
                    data.equippedParts.push(p);
                    SaveManager.save(this.data);
                    this.engine.renderGridUI(); // Call back to engine to update stats etc
                    SoundManager.play('PLACE'); // Place Sound
                } else {
                    console.warn("[ShipEditor] Placement Invalid");
                    SoundManager.play('ERROR');
                }
            } else {
                const p = data.equippedParts.find(p => p.id === partId);
                if (!p) return;
                if (GridManager.isValidPlacement(data, p.type, r, c, partId)) {
                    p.r = r; p.c = c;
                    SaveManager.save(this.data);
                    this.engine.renderGridUI();
                    SoundManager.play('PLACE');
                } else {
                    console.warn("[ShipEditor] Placement Invalid");
                    SoundManager.play('ERROR');
                }
            }
        };
    }

    drawParts() {
        const data = this.data.gridData;
        const CELL_SIZE = 36;
        const GAP = 2;

        data.equippedParts.forEach((p) => {
            const t = GridManager.PART_TEMPLATES[p.type];
            if (!t) return;

            const partEl = this.createPartVisual(t, p.level);
            partEl.classList.add('equipped');
            partEl.style.left = `${p.c * (CELL_SIZE + GAP)}px`;
            partEl.style.top = `${p.r * (CELL_SIZE + GAP)}px`;
            partEl.draggable = true;

            partEl.ondragstart = (e) => {
                console.log("[ShipEditor] Drag Start (Equipped)");
                e.dataTransfer.setData('partId', p.id);
                partEl.classList.add('dragging');
            };
            partEl.ondragend = () => partEl.classList.remove('dragging');

            partEl.onclick = () => {
                console.log("[ShipEditor] Part Clicked (Upgrade)");
                SoundManager.play('CLICK');
                const upgradeTable = GAME_SETTINGS.PART_UPGRADE_TABLE[p.type];
                const nextLevel = p.level + 1;
                const nextRow = upgradeTable ? upgradeTable[nextLevel] : null;
                const upCost = nextRow ? nextRow.Cost : (t.UpgradeCost || t.price || 1000) * p.level * 1.5;

                if (nextLevel > 100) {
                    alert("Max Level Reached");
                    return;
                }

                const currentRow = upgradeTable ? upgradeTable[p.level] : null;
                const curVal = currentRow ? currentRow.ValueTotal : 0;
                const nextVal = nextRow ? nextRow.ValueTotal : '???';
                // Normalize Name
                const name = t.Name || t.name;

                this.engine.checkConfirm("強化確認", `${name} を強化しますか？ (Lv.${nextLevel})\nコスト: $${upCost}\n効果: ${curVal} → ${nextVal}`, () => {
                    if (this.data.money >= upCost) {
                        SoundManager.play('UPGRADE');
                        this.data.money -= upCost;
                        p.level++;
                        SaveManager.save(this.data);
                        this.engine.renderGridUI();
                    } else alert("資金が不足しています。");
                });
            };

            this.gridEl.appendChild(partEl);
        });
    }

    createPartVisual(t, level) {
        const CELL_SIZE = 36;
        const GAP = 2;
        const w = t.w || t.W || 1;
        const h = t.h || t.H || 1;
        const shape = t.shape || t.Shape || null;
        const name = t.Name || t.name;

        const container = document.createElement('div');
        container.className = "grid-part";
        container.style.width = `${w * CELL_SIZE + (w - 1) * GAP}px`;
        container.style.height = `${h * CELL_SIZE + (h - 1) * GAP}px`;
        container.style.backgroundColor = "transparent";
        container.style.border = "none";

        const text = document.createElement('div');
        text.innerHTML = `<span>${name}<br>Lv.${level}</span>`;
        text.style.position = "absolute";
        text.style.width = "100%";
        text.style.height = "100%";
        text.style.display = "flex";
        text.style.justifyContent = "center";
        text.style.alignItems = "center";
        text.style.zIndex = "11";
        text.style.pointerEvents = "none";
        text.style.textShadow = "0 0 2px #000";
        container.appendChild(text);

        for (let r = 0; r < h; r++) {
            for (let c = 0; c < w; c++) {
                if (shape && shape[r] && shape[r][c] === 0) continue;

                const block = document.createElement('div');
                block.className = "grid-block";
                block.style.left = `${c * (CELL_SIZE + GAP)}px`;
                block.style.top = `${r * (CELL_SIZE + GAP)}px`;
                block.style.backgroundColor = t.color || "#888";
                container.appendChild(block);
            }
        }
        return container;
    }

    setDragImage(e, type, level) {
        const t = GridManager.PART_TEMPLATES[type];
        if (!t) return;
        const ghost = this.createPartVisual(t, level);
        ghost.style.position = "absolute";
        ghost.style.top = "-9999px";
        document.body.appendChild(ghost);
        e.dataTransfer.setDragImage(ghost, 0, 0);
        setTimeout(() => document.body.removeChild(ghost), 0);
    }

    // --- Warehouse ---
    renderWarehouse() {
        if (!this.warehouseEl) return;
        this.warehouseEl.innerHTML = "";
        const data = this.data.gridData;
        if (!data.warehouse) data.warehouse = [];

        console.log(`[ShipEditor] Warehouse Items: ${data.warehouse.length}`);

        data.warehouse.forEach((p) => {
            const t = GridManager.PART_TEMPLATES[p.type];
            if (!t) return;
            const name = t.Name || t.name;
            const desc = t.Desc || t.desc || "";

            const div = document.createElement('div');
            div.className = "part-item";
            div.draggable = true;
            div.innerHTML = `<strong>${name} (Lv.${p.level})</strong><br><small>${desc}</small>`;

            div.ondragstart = (e) => {
                console.log("[ShipEditor] Drag Start (Warehouse)");
                e.dataTransfer.setData('partId', p.id);
                e.dataTransfer.setData('fromWarehouse', 'true');
                this.setDragImage(e, p.type, p.level);
            };
            this.warehouseEl.appendChild(div);
        });
    }

    // --- Shop ---
    renderPartShop() {
        if (!this.shopEl) {
            console.error("[ShipEditor] Shop Element #part-list not found!");
            return;
        }
        this.shopEl.innerHTML = "";
        const shopItems = Object.keys(GridManager.PART_TEMPLATES);

        console.log("[ShipEditor] Shop Templates:", shopItems);

        if (shopItems.length === 0) {
            this.shopEl.innerHTML = "<div style='padding:10px;'>No parts available</div>";
            return;
        }

        shopItems.forEach(type => {
            const t = GridManager.PART_TEMPLATES[type];
            if (!t) {
                console.warn(`[ShipEditor] Template missing for ${type}`);
                return;
            }
            console.log(`[ShipEditor] Rendering Shop Item: ${type}`);
            const name = t.Name || t.name || type;
            const price = t.UpgradeCost || t.price || 1000;
            const desc = t.Desc || t.desc || "";
            const isEquipped = GridManager.isTypeEquipped(this.data.gridData, type);

            const div = document.createElement('div');
            div.className = "part-item" + (isEquipped ? " equipped" : "");
            div.innerHTML = `<strong>${name}</strong> $${price}<br><small>${desc}</small>`;

            if (isEquipped) {
                div.title = "所持済み";
                div.onclick = () => {
                    SoundManager.play('ERROR'); // Error sound
                    alert("既に所持しています。");
                };
            } else {
                div.draggable = true;
                div.ondragstart = (e) => {
                    // Visual drag
                    this.setDragImage(e, type, 1);
                };

                div.onclick = () => {
                    SoundManager.play('CLICK');
                    this.engine.checkConfirm("パーツ購入", `${name}を購入しますか？\n価格: $${price}`, () => {
                        const res = GridManager.buyPart(this.data, type);
                        if (res.success) {
                            SoundManager.play('BUY'); // Buy sound
                            SaveManager.save(this.data);
                            this.engine.renderGridUI();
                        } else {
                            SoundManager.play('ERROR');
                            alert(res.reason);
                        }
                    });
                };
            }
            this.shopEl.appendChild(div);
        });
    }

    initSellZone() {
        const zone = document.getElementById('sell-zone');
        if (!zone) return;
        zone.ondragover = (e) => { e.preventDefault(); zone.classList.add('drag-over'); };
        zone.ondragleave = () => zone.classList.remove('drag-over');
        zone.ondrop = (e) => {
            e.preventDefault();
            zone.classList.remove('drag-over');
            const partId = e.dataTransfer.getData('partId');
            if (!partId) return;

            SoundManager.play('CLICK');
            this.engine.checkConfirm("売却", "パーツを売却しますか？ (50%返金)", () => {
                const res = GridManager.sellPart(this.data, partId);
                if (res.success) {
                    this.data.money += res.refund;
                    SoundManager.play('SELL');
                    SaveManager.save(this.data);
                    this.engine.renderGridUI();
                }
            });
        };
    }

    buyCell(r, c) {
        this.engine.checkConfirm("エリア解放", `このエリアを解放しますか？\nコスト: $${GridManager.CELL_UNLOCK_PRICE}`, () => {
            const res = GridManager.unlockCell(this.data.gridData, this.data.money, r, c);
            if (res.success) {
                this.data.money -= res.cost;
                SoundManager.play('UPGRADE');
                SaveManager.save(this.data);
                this.engine.renderGridUI();
            } else alert(res.reason);
        });
    }

    resetGrid() {
        this.engine.checkConfirm("全リセット", 'グリッドを初期状態に戻しますか？\n装備品はすべて倉庫に戻り、拡張コストの50%が返金されます。', () => {
            const res = GridManager.resetGrid(this.data.gridData);
            this.data.money += res.refund;
            SoundManager.play('SELL');
            SaveManager.save(this.data);
            this.engine.renderGridUI();
        });
    }
}
