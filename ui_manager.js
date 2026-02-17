// ui_manager.js - Sin cambios mayores, pero ajustado para historia más larga

const UIManager = {
    updateWealthUI(equity) {
        const eq = document.getElementById('equity-value');
        if (eq) {
            eq.innerText = `$${equity.toFixed(2)}`;
            eq.style.color = equity >= 1000 ? "var(--n-green)" : "var(--n-gold)";
        }
    },

    addLog(msg, color) {
        const log = document.getElementById('wealth-log');
        if (log) {
            const d = new Date();
            const ts = d.getHours().toString().padStart(2,'0') + ":" + d.getMinutes().toString().padStart(2,'0') + ":" + d.getSeconds().toString().padStart(2,'0');
            log.innerHTML = `<div style="color:${color}">${ts} -> ${msg}</div>` + log.innerHTML;
        }
    },

    updateVisualTrack(sequence) {
        const track = document.getElementById('visual-dna-track');
        if (track) {
            track.innerHTML = sequence.slice(-100).map(v => // Extendido a 100 (Step 1)
                `<div class="dot" style="background:${v.val==='A'?'var(--n-green)':'var(--n-red)'};"></div>`
            ).join('');
        }
    },

    updateStretchUI(msg, color, animate = false) {
        const stretch = document.getElementById('stretch-warning');
        if (!stretch) return;
        stretch.innerHTML = animate ? `<span style="animation: pulse-warn 0.4s infinite; color: ${color};">${msg}</span>` : msg;
        stretch.style.color = color;
    }
};