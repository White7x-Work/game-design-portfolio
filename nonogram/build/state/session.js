import { deriveRuns } from '../core/clues.js';
export class Session {
    constructor(level, practice = false) {
        this.tool = 'fill';
        this.color = 1;
        /** 累计失误次数（一旦发生，零失误星永久失去，§4） */
        this.mistakeCount = 0;
        this.won = false;
        this.startedMs = 0;
        this.accumulatedMs = 0;
        this.running = false;
        this.level = level;
        this.w = level.width;
        this.h = level.height;
        this.values = new Uint8Array(this.w * this.h);
        this.marks = new Uint8Array(this.w * this.h);
        this.practice = practice;
        this.color = level.colors?.[0] ?? 1;
    }
    // ---------- 计时（首次操作起算；暂停/隐藏不计） ----------
    ensureStarted() {
        if (!this.startedMs) {
            this.startedMs = performance.now();
            this.running = true;
        }
    }
    pause() {
        if (this.running) {
            this.accumulatedMs += performance.now() - this.startedMs;
            this.running = false;
        }
    }
    resume() {
        if (!this.won) {
            this.startedMs = performance.now();
            this.running = true;
        }
    }
    timeSec() {
        let ms = this.accumulatedMs;
        if (this.running)
            ms += performance.now() - this.startedMs;
        return Math.floor(ms / 1000);
    }
    // ---------- 格子操作 ----------
    idx(x, y) {
        return y * this.w + x;
    }
    sol(i) {
        const { solution, width } = this.level;
        return solution[Math.floor(i / width)][i % width];
    }
    /** 失误红标显示条件（§4）：填了与 solution 不符的确定性颜色 */
    isMistakeAt(i) {
        return this.values[i] !== 0 && this.values[i] !== this.sol(i);
    }
    /** 按当前工具应用（点按/拖动连续应用） */
    applyTool(i, tool = this.tool, color = this.color) {
        if (this.won)
            return { mistake: false, won: true, changed: false };
        this.ensureStarted();
        let changed = false;
        let mistake = false;
        if (tool === 'fill') {
            const c = this.level.colors && this.level.colors.length > 1 ? color : 1;
            if (this.values[i] !== c || this.marks[i]) {
                this.marks[i] = 0;
                if (this.values[i] !== c) {
                    this.values[i] = c;
                    if (c !== this.sol(i)) {
                        mistake = true;
                        this.mistakeCount++;
                    }
                }
                changed = true;
            }
        }
        else if (tool === 'mark') {
            this.toggleMarkTool(i);
            changed = true;
        }
        else {
            // erase：清空填色与 X
            if (this.values[i] !== 0 || this.marks[i]) {
                this.values[i] = 0;
                this.marks[i] = 0;
                changed = true;
            }
        }
        const won = this.checkWin();
        if (won && !this.won) {
            this.won = true;
            this.pause();
        }
        return { mistake, won: this.won, changed };
    }
    /** 切换 X 标记（长按/右键/标记工具）。X 永不计失误（§4）。 */
    toggleMark(i, force) {
        if (this.won)
            return;
        this.ensureStarted();
        if (force === true) {
            this.marks[i] = 1;
            this.values[i] = 0;
        }
        else if (this.marks[i]) {
            this.marks[i] = 0;
        }
        else {
            this.marks[i] = 1;
            this.values[i] = 0;
        }
    }
    /** mark 工具的点按行为 = 切换 */
    toggleMarkTool(i) {
        if (this.marks[i])
            this.marks[i] = 0;
        else {
            this.marks[i] = 1;
            this.values[i] = 0;
        }
    }
    checkWin() {
        const { solution, width } = this.level;
        for (let y = 0; y < this.h; y++) {
            const row = solution[y];
            for (let x = 0; x < width; x++) {
                if (this.values[y * width + x] !== row[x])
                    return false;
            }
        }
        return true;
    }
    // ---------- 线索完成态（渲染变灰用，纯 QoL，不改规则） ----------
    runsEqual(a, b) {
        if (a.length !== b.length)
            return false;
        for (let i = 0; i < a.length; i++)
            if (a[i].color !== b[i].color || a[i].len !== b[i].len)
                return false;
        return true;
    }
    rowDone(y) {
        const vals = [];
        for (let x = 0; x < this.w; x++)
            vals.push(this.values[y * this.w + x]);
        return this.runsEqual(deriveRuns(vals), this.level.clues.rows[y]);
    }
    colDone(x) {
        const vals = [];
        for (let y = 0; y < this.h; y++)
            vals.push(this.values[y * this.w + x]);
        return this.runsEqual(deriveRuns(vals), this.level.clues.cols[x]);
    }
    /** 对角线（含"未显示=全空"约束）完成态 */
    diagDone(cells, clue) {
        const vals = cells.map(([x, y]) => this.values[y * this.w + x]);
        return this.runsEqual(deriveRuns(vals), clue ?? []);
    }
}
