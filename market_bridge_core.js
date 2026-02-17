/**
 * MARKET BRIDGE CORE - V8.1 ULTIMATE UNIFIED + LSTM MEJORADO (2026)
 * Fusión completa de todas las fases con LSTM más predictivo
 * No se eliminó ni resumió nada – solo se agregaron mejoras en ML
 */

const MarketBridge = {
    predictions: {}, 
    stats: {},
    lastLeaderV: null,
    isLocked: false,
    equity: 1000.00,
    minBet: 10,
    currentStake: 10, // Nueva: rastrea la apuesta actual
    martingaleLevel: 0, // Nueva: nivel actual de recuperación
    payout: 0.85,
    
    // --- PROPIEDADES DE CONTROL Y MÉTRICAS (de todas las fases) ---
    consecutiveFails: {},           
    currentStreak: { val: null, count: 0 }, 
    currentPrice: 100.0,            
    priceHistory: [],               
    model: null,                    
    ssid: '42["auth",{"sessionToken":"b292b113a3933576deb3a3594fc5f3d9","uid":124499372,"lang":"en","isChart":1,"platform":2,"version":"1.0.0"}]',  // SSID alternativo de Fase 2
    lastTrainCount: 0,              
    socket: null,
    isPOConnected: false,
    manualDisconnect: false,  // Nueva: bandera para bloquear retry en disconnect manual

    // --- NUEVO: Configuración del modelo LSTM avanzado (ajustable) ---
    windowSize: 30,                 // ← más largo = mejor predicción (prueba 20-60)
    lstmUnits1: 64,
    lstmUnits2: 32,
    dropoutRate: 0.3,
    learningRate: 0.0005,
    minEpochs: 50,
    maxEpochs: 150,
    patienceEarlyStop: 10,

    init() {
        window.sequence = window.sequence || [];
        for(let i=3; i<=20; i++) {  // Ventanas extensas V3-V20 de Fase 1/2/Principal
            this.stats[i] = { hits: 0, total: 0, timeline: [] }; 
            this.consecutiveFails[i] = 0;
        }
        this.priceHistory.push(this.currentPrice);
        this.setupInput();
        
        if(typeof UIManager !== 'undefined') UIManager.updateWealthUI(this.equity);

        if (window.sequence.length >= 30) this.trainModel();
        
        // Auto-conectar DESACTIVADO por defecto (usa toggle) - Descomenta si quieres automático
        // if (this.ssid && this.ssid.includes("session")) this.connectToPO();
    },

    setupInput() {
        // De Fase 2: Detección avanzada con logs
        document.addEventListener('mousedown', (e) => {
            if (e.target.tagName === 'BUTTON' || e.target.closest('button')) return;
            let side = null;
            if (e.button === 0) {
                console.log('[MOUSE] Botón izquierdo → BUY (A)');
                side = 'A';
            } else if (e.button === 2) {
                console.log('[MOUSE] Botón derecho → SELL (B)');
                side = 'B';
            }
            if (side) {
                e.preventDefault();
                this.injectManual(side);
            }
        });
        document.addEventListener('contextmenu', e => e.preventDefault());
    },

    injectManual(type) {
        console.log(`[INJECT] ${type === 'A' ? 'BUY' : 'SELL'}`);

        const priceChange = (type === 'A' ? 0.5 : -0.5) + (Math.random() * 0.2 - 0.1);
        this.currentPrice += priceChange;
        this.priceHistory.push(this.currentPrice);

        this.processWealth(type);
        this.verifyAccuracy(type);

        if (this.currentStreak.val === type) {
            this.currentStreak.count++;
        } else {
            this.currentStreak.val = type;
            this.currentStreak.count = 1;
        }

        window.sequence.push({ val: type, time: Date.now() });
        if (window.sequence.length > 400) window.sequence.shift();

        if(typeof UIManager !== 'undefined') UIManager.updateVisualTrack(window.sequence);
        
        this.runMultiAnalysis();
        if (this.calculateVolatility() >= 8 && !this.isLocked) this.activateSecurityLock();

        this.checkExtremeLimits();
        this.findGeneticMatch();
        this.updateMainSignal();

        if (window.sequence.length - this.lastTrainCount >= 50 && window.sequence.length >= 30) {
            this.trainModel();
            this.lastTrainCount = window.sequence.length;
        }
    },

    // --- ANALÍTICA (mejor de Fase 1/2/Principal) ---
    findGeneticMatch() {
        if (this.isLocked) return;
        let bestV = null; let maxWeight = -1;
        const history = window.sequence.map(v => v.val).join('');

        for (let v = 3; v <= 20; v++) {
            if (window.sequence.length < v) continue;
            const stats = this.stats[v];
            const accuracy = stats.total > 0 ? (stats.hits / stats.total) : 0;
            if (accuracy < 0.65 && stats.total > 15) continue;
            if (this.consecutiveFails[v] >= 2) continue;

            const pattern = history.slice(-v);
            const searchPool = history.slice(0, -1);
            const occurrences = (searchPool.match(new RegExp(pattern, 'g')) || []).length;
            const recentHits = stats.timeline.slice(-5).filter(s => s.success).length;

            const weight = (accuracy * 0.6) + (recentHits * 0.3) + (occurrences * 0.1);

            if (weight > maxWeight && this.predictions[v] !== "---") {
                maxWeight = weight;
                bestV = v;
            }
        }

        if (bestV) {
            this.lastLeaderV = bestV;
            this.updateLeaderUI(bestV, history);
        }
    },

    updateMainSignal() {
        if (this.isLocked) return;
        let groups = { short: [], mid: [], long: [] };
        let powerB = 0; let powerS = 0;

        for(let v=3; v<=20; v++) {
            const pred = this.predictions[v];
            const acc = this.stats[v].total > 0 ? (this.stats[v].hits / this.stats[v].total) : 0;
            if (pred === "---") continue;
            if (v <= 5) groups.short.push(pred);
            else if (v <= 9) groups.mid.push(pred);
            else groups.long.push(pred);
            if(pred === "BUY") powerB += acc;
            if(pred === "SELL") powerS += acc;
        }

        const globalAgreement = (groups.short.includes("BUY") && groups.mid.includes("BUY") && groups.long.includes("BUY")) ||
                                (groups.short.includes("SELL") && groups.mid.includes("SELL") && groups.long.includes("SELL"));

        const side = document.getElementById('signal-side');
        const header = document.getElementById('header-signal');
        const totalPower = powerB + powerS;
        let assertiveness = totalPower > 0 ? Math.round((Math.max(powerB, powerS) / totalPower) * 100) : 0;

        if (this.currentStreak.count >= 4) assertiveness -= (this.currentStreak.count * 5);

        const trend = this.calculateTrend();
        if (trend === 'STRONG BUY') assertiveness += 10;
        else if (trend === 'STRONG SELL') assertiveness -= 10;

        const rsi = this.calculateRSIWilder();
        const mlPred = this.predictNext();
        if (mlPred === 'BUY') powerB += 0.35; else if (mlPred === 'SELL') powerS += 0.35;

        if (globalAgreement && assertiveness > 75) {
            const finalDir = powerB > powerS ? "MASTER BUY" : "MASTER SELL";
            side.innerText = `🛡️ ${finalDir}`;
            side.style.color = powerB > powerS ? "#00ff88" : "#ff2e63";
            header.style.background = powerB > powerS ? "rgba(0, 255, 136, 0.25)" : "rgba(255, 46, 99, 0.25)";
        } else {
            const p = this.predictions[this.lastLeaderV] || "ESPERANDO";
            side.innerText = p;
            side.style.color = p === "BUY" ? "#00ff88" : (p === "SELL" ? "#ff2e63" : "#ffb400");
            header.style.background = "#000";
        }
        document.getElementById('v-label').innerText = `ASERTIVIDAD: ${assertiveness}% | RSI: ${Math.round(rsi)} | RACHA: ${this.currentStreak.count}`;
    },

    checkExtremeLimits() {
        if (window.sequence.length < 10) return;
        const history = window.sequence.map(v => v.val).join('').slice(-10);
        const countA = (history.match(/A/g) || []).length;
        const countB = (history.match(/B/g) || []).length;
        
        if (countA >= 8) UIManager.updateStretchUI("⚠️ AGOTAMIENTO ALCISTA", "#ff2e63", true);
        else if (countB >= 8) UIManager.updateStretchUI("⚠️ AGOTAMIENTO BAJISTA", "#00ff88", true);
        else this.checkPriceStretch();

        // Lógica de reversión forzada del original
        if (countA >= 6 && this.lastLeaderV) this.predictions[this.lastLeaderV] = "SELL";
        else if (countB >= 6 && this.lastLeaderV) this.predictions[this.lastLeaderV] = "BUY";
    },

    checkPriceStretch() {
        const lastData = window.sequence.slice(-6).map(v => v.val);
        if (lastData.length < 3) return;
        let count = 1;
        const lastVal = lastData[lastData.length - 1];
        for (let i = lastData.length - 2; i >= 0; i--) {
            if (lastData[i] === lastVal) count++; else break;
        }
        if (count >= 3) UIManager.updateStretchUI(`ALERTA GIRO: ${count} VELAS`, "#ffb400");
        else UIManager.updateStretchUI("ESTADO: ESTABLE", "#666");
    },

    calculateTrend() {
        if (window.sequence.length < 10) return 'NEUTRAL';
        const last10 = window.sequence.slice(-10).map(v => v.val === 'A' ? 1 : -1);
        const sum = last10.reduce((a, b) => a + b, 0);
        return sum > 5 ? 'STRONG BUY' : sum < -5 ? 'STRONG SELL' : 'NEUTRAL';
    },

    isMarketSafe() {
        const now = new Date();
        const min = now.getMinutes();
        const sec = now.getSeconds();
        
        // Bloqueo: 1 minuto antes y 1 minuto después del cambio de hora (Ej: 10:59:00 a 11:01:00)
        if (min === 59 || min === 0) {
            return false; 
        }
        return true;
    },

    calculateRSIWilder(period = 14) {
        if (this.priceHistory.length < period + 1) return 50;
        let avgGain = 0, avgLoss = 0;
        for (let i = 1; i <= period; i++) {
            const change = this.priceHistory[this.priceHistory.length - i] - this.priceHistory[this.priceHistory.length - i - 1];
            if (change > 0) avgGain += change;
            else avgLoss -= change;
        }
        avgGain /= period;
        avgLoss /= period;

        if (this.priceHistory.length > period + 1) {
            for (let i = period + 1; i < this.priceHistory.length; i++) {
                const change = this.priceHistory[i] - this.priceHistory[i - 1];
                avgGain = ((avgGain * (period - 1)) + (change > 0 ? change : 0)) / period;
                avgLoss = ((avgLoss * (period - 1)) + (change < 0 ? -change : 0)) / period;
            }
        }

        if (avgLoss === 0) return 100;
        const rs = avgGain / avgLoss;
        return 100 - (100 / (1 + rs));
    },

    verifyAccuracy(actualType) {
        const actualLabel = actualType === 'A' ? 'BUY' : 'SELL';
        for (let v in this.predictions) {
            if (this.predictions[v] !== "---") {
                this.stats[v].total++;
                const isHit = this.predictions[v] === actualLabel;
                if (isHit) { this.stats[v].hits++; this.consecutiveFails[v] = 0; }
                else { this.consecutiveFails[v]++; }
                this.stats[v].timeline.push({ success: isHit });
                if (this.consecutiveFails[v] >= 3) this.predictions[v] = "---";
            }
        }
    },

    processWealth(actualType) {
        const actualLabel = actualType === 'A' ? 'BUY' : 'SELL';
        
        // Solo procesamos si hay un líder y si el mercado es seguro
        if (this.lastLeaderV && this.predictions[this.lastLeaderV] && this.predictions[this.lastLeaderV] !== "---") {
            
            if (!this.isMarketSafe()) {
                UIManager.addLog("PAUSA: Cambio de hora (Manipulación)", "#ffb400");
                return; 
            }

            const pred = this.predictions[this.lastLeaderV];
            
            if (pred === actualLabel) {
                // --- CASO: HIT (GANAMOS) ---
                this.equity += (this.currentStake * this.payout);
                UIManager.addLog(`HIT +$${(this.currentStake * this.payout).toFixed(2)}`, "#00ff88");
                
                // Reset de Martingala
                this.currentStake = this.minBet;
                this.martingaleLevel = 0;
            } else {
                // --- CASO: MISS (PERDEMOS) ---
                this.equity -= this.currentStake;
                UIManager.addLog(`MISS -$${this.currentStake.toFixed(2)}`, "#ff2e63");

                // Aplicar Martingala Inteligente (Máximo 2 niveles)
                if (this.martingaleLevel < 2) {
                    this.martingaleLevel++;
                    // Multiplicador 2.2 para recuperar pérdida + pequeña ganancia
                    this.currentStake = Math.ceil(this.currentStake * 2.2);
                    UIManager.addLog(`MARTINGALA N${this.martingaleLevel}: $${this.currentStake}`, "#ffb400");
                } else {
                    // Reset tras fallar el Nivel 2 (Stop Loss de racha)
                    this.currentStake = this.minBet;
                    this.martingaleLevel = 0;
                    UIManager.addLog("STOP LOSS: Reset de seguridad", "#ffffff");
                }
            }
            UIManager.updateWealthUI(this.equity);
        }
    },

    calculateVolatility() {
        if (window.sequence.length < 10) return 0;
        const last10 = window.sequence.slice(-10).map(v => v.val === 'A' ? 1 : 0);
        const mean = last10.reduce((a,b)=>a+b,0)/10;
        const variance = last10.reduce((a,b)=>a + Math.pow(b-mean,2),0)/10;
        return Math.sqrt(variance) * 10;
    },

    activateSecurityLock() {
        this.isLocked = true;
        const side = document.getElementById('signal-side');
        if(side) side.innerText = "BLOQUEO VOLATILIDAD";
        setTimeout(() => { this.isLocked = false; }, 20000);
    },

    // --- FUNCIONES EXTRA DE FASE 3 ---
    reset() {
        window.sequence = []; this.equity = 1000.00;
        this.currentStreak = { val: null, count: 0 };
        this.priceHistory = [100.0];
        this.lastLeaderV = null;
        this.predictions = {};
        for(let i=3; i<=20; i++) { 
            this.stats[i] = { hits: 0, total: 0, timeline: [] }; 
            this.consecutiveFails[i] = 0;
        }
        if(typeof UIManager !== 'undefined') {
            UIManager.updateWealthUI(this.equity);
            UIManager.addLog("SISTEMA REINICIADO", "#0088ff");
        }
        this.runMultiAnalysis();
        this.updateMainSignal();
    },

    exportData() {
        let csv = "data:text/csv;charset=utf-8,REPORTE QUANTUM V8.0\nCapital:," + this.equity.toFixed(2) + "\n\nVENTANA,TOTAL,ACIERTOS,%\n";
        for (let v = 3; v <= 20; v++) {
            const s = this.stats[v];
            csv += `V${v},${s.total},${s.hits},${(s.total>0?(s.hits/s.total*100):0).toFixed(2)}%\n`;
        }
        const link = document.createElement("a");
        link.setAttribute("href", encodeURI(csv));
        link.setAttribute("download", "Reporte_Quantum.csv");
        document.body.appendChild(link); link.click();
    },

    // --- LSTM MEJORADO (reemplaza tu versión anterior) ---
    async trainModel() {
        if (!window.tf) {
            console.warn("TensorFlow.js no está cargado");
            return;
        }

        const seq = window.sequence.map(v => v.val === 'A' ? 1 : 0);
        const ws = this.windowSize;

        if (seq.length < ws * 2) {
            console.log(`Datos insuficientes para entrenar (${seq.length} < ${ws * 2})`);
            return;
        }

        // Preparar datos
        const xs = [];
        const ys = [];
        for (let i = 0; i < seq.length - ws; i++) {
            xs.push(seq.slice(i, i + ws));
            ys.push(seq[i + ws]);
        }

        const xsTensor = tf.tensor3d(xs, [xs.length, ws, 1]);
        const ysTensor = tf.tensor2d(ys, [ys.length, 1]);

        // Limpiar modelo anterior
        if (this.model) this.model.dispose();

        // Modelo avanzado: Bidirectional + Dropout + Dense
        this.model = tf.sequential();

        this.model.add(tf.layers.bidirectional(
            tf.layers.lstm({units: this.lstmUnits1, returnSequences: true}),
            {inputShape: [ws, 1]}
        ));

        this.model.add(tf.layers.dropout({rate: this.dropoutRate}));

        this.model.add(tf.layers.lstm({units: this.lstmUnits2, returnSequences: false}));

        this.model.add(tf.layers.dropout({rate: this.dropoutRate}));

        this.model.add(tf.layers.dense({units: 16, activation: 'relu'}));
        this.model.add(tf.layers.dense({units: 1, activation: 'sigmoid'}));

        this.model.compile({
            optimizer: tf.train.adam(this.learningRate),
            loss: 'binaryCrossentropy',
            metrics: ['accuracy']
        });

        // Entrenamiento con validación y early stopping
        await this.model.fit(xsTensor, ysTensor, {
            epochs: this.maxEpochs,
            verbose: 0,
            validationSplit: 0.25,
            shuffle: true,
            callbacks: [
                tf.callbacks.earlyStopping({
                    monitor: 'val_loss',
                    patience: this.patienceEarlyStop,
                    restoreBestWeights: true,
                    verbose: 0
                }),
                {
                    onEpochEnd: (epoch, logs) => {
                        if (epoch % 10 === 0 && typeof UIManager !== 'undefined') {
                            UIManager.addLog(`Epoch ${epoch}: loss=${logs.loss?.toFixed(4) || 'N/A'}, acc=${(logs.acc*100 || 0).toFixed(1)}%`, "#8888ff");
                        }
                    }
                }
            ]
        });

        if (typeof UIManager !== 'undefined') {
            UIManager.addLog(`LSTM actualizado: ${xs.length} ejemplos, window=${ws}`, "#00ff88");
        }

        xsTensor.dispose();
        ysTensor.dispose();
    },

    predictNext() {
        if (typeof tf === 'undefined' || !this.model || window.sequence.length < this.windowSize) {
            return '---';
        }

        return tf.tidy(() => {
            let seq = window.sequence.slice(-this.windowSize).map(v => v.val === 'A' ? 1 : 0);

            // Normalización min-max (reforzada)
            const min = Math.min(...seq);
            const max = Math.max(...seq);
            const range = max - min || 1;
            seq = seq.map(v => (v - min) / range);

            const input = tf.tensor3d([seq], [1, this.windowSize, 1]);
            const prob = this.model.predict(input).dataSync()[0];
            input.dispose();

            // Decisión con confianza visible
            if (prob > 0.68) {
                return `BUY (${(prob * 100).toFixed(0)}%)`;
            } else if (prob < 0.32) {
                return `SELL (${((1 - prob) * 100).toFixed(0)}%)`;
            } else {
                return `--- (${(prob * 100).toFixed(0)}%)`;
            }
        });
    },

    // --- BACKTEST DE FASE 1/2 ---
    testHistorical(data) {
        data.forEach(type => this.injectManual(type));
        const globalAcc = Object.values(this.stats).reduce((a, s) => a + (s.hits / s.total || 0), 0) / Object.keys(this.stats).length;
        console.log(`Precisión Global: ${globalAcc * 100}%`);
        if (typeof UIManager !== 'undefined') UIManager.addLog(`Backtest: ${globalAcc * 100}% precisión`, "#00aaff");
    },

    // --- CONEXIÓN PO (de Fase 2 + toggle de Principal) ---
   connectToPO() {
    if (this.socket) this.socket.close();
    if (typeof UIManager !== 'undefined') UIManager.addLog("Iniciando conexión a Pocket Option...", "#0088ff");
    
    // Conexión al servidor WebSocket
    this.socket = new WebSocket("wss://demo-api-eu.po.market/socket.io/?EIO=4&transport=websocket");

    this.socket.onopen = () => {
        // Handshake inicial requerido por Socket.io (Protocolo EIO=4)
        this.socket.send("40");
        
        // Mantenemos la conexión activa con un pequeño delay
        setTimeout(() => { 
            if(this.socket && this.socket.readyState === 1) this.socket.send("2probe"); 
        }, 1000);
    };

    this.socket.onmessage = (event) => {
        const msg = event.data;

        // 1. GESTIÓN DE AUTENTICACIÓN
        if (msg.startsWith("40")) {
            // Enviamos tus credenciales exactas
            const initMsg = `42["user_init",{"id":124499372,"secret":"b292b113a3933576deb3a3594fc5f3d9"}]`;
            this.socket.send(initMsg);
            
            if (typeof UIManager !== 'undefined') {
                UIManager.addLog("AUTH: Enviando User Init (ID: 124499372)...", "#00ff88");
            }
        } 
        
        // 2. MANTENIMIENTO (PING-PONG)
        else if (msg === "2") {
            this.socket.send("3"); // Responde al ping para que no te desconecten
        } 
        
        // 3. RECEPCIÓN DE DATOS (CANDLES)
        else if (msg.startsWith("42")) {
            try {
                // Quitamos el prefijo '42' y parseamos el JSON
                const parsed = JSON.parse(msg.slice(2));
                
                // Verificamos si es un evento de vela
                if (parsed[0] === "candle-generated" || parsed[0] === "candle") {
                    const d = parsed[1];
                    // 'A' para vela verde (Close > Open), 'B' para vela roja
                    this.injectManual(d.close > d.open ? 'A' : 'B');
                }
            } catch(e) {
                // Error silencioso en parseo si el mensaje no es JSON válido
            }
        }
    };

    this.socket.onclose = () => {
        this.isPOConnected = false;
        this.updateConnectionUI(false);
        if (typeof UIManager !== 'undefined') UIManager.addLog("Conexión cerrada. Reintentando...", "#ff5555");
        
        // Reconexión automática cada 5 segundos si no fue un cierre manual
        if (!this.manualDisconnect) {
            setTimeout(() => this.connectToPO(), 5000);
        }
    };

    this.socket.onerror = (err) => {
        console.error("WebSocket error:", err);
        if (typeof UIManager !== 'undefined') UIManager.addLog("Error crítico en conexión PO", "#ff2e63");
    };
},

    // Toggle funciones (integradas)
    togglePOConnection() {
        if (this.isPOConnected) {
            this.disconnectPO();
        } else {
            this.manualDisconnect = false;
            this.connectToPO();
            this.isPOConnected = true;
            this.updateConnectionUI(true);
        }
    },

    disconnectPO() {
        this.manualDisconnect = true;
        if (this.socket) {
            this.socket.close();
            this.socket = null;
        }
        this.isPOConnected = false;
        this.updateConnectionUI(false);
        if (typeof UIManager !== 'undefined') UIManager.addLog("Desconectado manualmente", "#ff9f43");
    },

    updateConnectionUI(connected) {
        const btn = document.getElementById('toggle-po-connection');
        if (!btn) return;

        const mainText = btn.querySelector('.btn-main');
        const subText = btn.querySelector('.btn-sub');

        if (connected) {
            btn.classList.add('active');
            if (mainText) mainText.textContent = "DESCONECTAR PO";
            if (subText) subText.textContent = "CONECTADO";
        } else {
            btn.classList.remove('active');
            if (mainText) mainText.textContent = "CONECTAR PO";
            if (subText) subText.textContent = "OFFLINE";
        }
    },

    runMultiAnalysis() {
        const containers = { low: document.getElementById('col-low'), mid: document.getElementById('col-mid'), high: document.getElementById('col-high') };
        Object.values(containers).forEach(c => { if(c) c.innerHTML = ''; });
        const history = window.sequence.map(v => v.val).join('');
        for (let v = 3; v <= 20; v++) {
            if (window.sequence.length < v) continue;
            const pattern = history.slice(-v);
            const searchPool = history.slice(0, -1);
            const mA = (searchPool.match(new RegExp(pattern + 'A', 'g')) || []).length;
            const mB = (searchPool.match(new RegExp(pattern + 'B', 'g')) || []).length;
            let pred = mA > mB ? "BUY" : (mB > mA ? "SELL" : "---");
            this.predictions[v] = pred;
            const acc = this.stats[v].total > 0 ? Math.round((this.stats[v].hits / this.stats[v].total) * 100) : 0;
            const card = `<div class="window-card" style="border-right:3px solid ${pred==="BUY"?"#00ff88":"#ff2e63"}">V${v} ${pred} (${acc}%)</div>`;
            if (acc >= 75) containers.high.innerHTML += card;
            else if (acc >= 55) containers.mid.innerHTML += card;
            else if (containers.low) containers.low.innerHTML += card;
        }
    },

    updateLeaderUI(bestV, history) {
        const pred = this.predictions[bestV];
        const acc = Math.round((this.stats[bestV].hits / this.stats[bestV].total) * 100) || 0;
        document.getElementById('ai-best-match').innerHTML = `LÍDER: <b style="color:#0088ff">V${bestV}</b> [Fails: ${this.consecutiveFails[bestV]}]`;
        document.getElementById('ai-signal-value').innerText = pred;
        document.getElementById('ai-signal-value').style.color = pred === "BUY" ? "#00ff88" : "#ff2e63";
        document.getElementById('ai-confidence').innerText = `${acc}% PRECISIÓN`;
    }
};

MarketBridge.init();