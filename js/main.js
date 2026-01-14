import { PixelEngine } from './pixel_engine.js';
import { Skyline, Rooftop, PixelCloud } from './entities_city.js';
import { PixelBird, PixelKite, PlayerKite } from './entities_actors.js';
import { ParticleSystem } from './particles.js';
import { InputManager } from './input.js';
import { NetworkManager } from './network.js';
import { AudioManager } from './audio.js';

document.addEventListener('DOMContentLoaded', () => {
    // 1. Core Systems
    const engine = new PixelEngine('skyCanvas', 240, 135);
    const input = new InputManager();
    const network = new NetworkManager();
    const audio = new AudioManager();

    // 2. State
    let gameState = 'MENU'; // MENU, SETUP, WAITING, PLAYING, GAME_OVER, WINNER
    let gameMode = 'SINGLE'; // SINGLE, MULTI_HOST, MULTI_GUEST
    let playerKite = null;
    let startTime = 0;
    let gameDuration = 0;
    let gameTimer = 0;
    let displayRoomCode = ''; // Simple 6-char code for display

    // Multiplayer State
    let peers = {}; // id -> Kite Entity

    // 3. World Setup
    // Clouds
    for (let i = 0; i < 5; i++) {
        engine.addEntity('sky', new PixelCloud(Math.random() * 240, Math.random() * 80));
    }

    engine.addEntity('farCity', new Skyline('#a66d5b', 0.5));
    engine.addEntity('midCity', new Skyline('#854d3d', 1.0));
    let rx = 0;
    while (rx < engine.width) {
        const rw = 40 + Math.random() * 40;
        engine.addEntity('foreground', new Rooftop(rx, rw));
        rx += rw - 5;
    }

    // Ambient Spawns
    setInterval(() => {
        if (engine.layers.action.filter(e => e instanceof PixelBird).length < 30) {
            engine.addEntity('action', new PixelBird(-10, 20 + Math.random() * 60));
        }
    }, 1000);

    // AI Spawner (Singleplayer Only)
    setInterval(() => {
        if (gameState !== 'PLAYING' || gameMode !== 'SINGLE') return;
        if (engine.layers.action.filter(e => e instanceof PixelKite && !e.dead && !e.isPlayer).length < 5) {
            const colors = ['#ff9900', '#d41c6c', '#76c61d', '#008b8b'];
            const k = new PixelKite(Math.random() * engine.width, 100 + Math.random() * 50, colors[Math.floor(Math.random() * 4)]);
            k.isAi = true;
            engine.addEntity('action', k);
        }
    }, 2000);

    // 4. Input & Network Loop
    setInterval(() => {
        if (gameState === 'PLAYING') {

            // Timer Logic
            if (gameDuration > 0) {
                const elapsed = (Date.now() - startTime) / 1000;
                const remaining = Math.max(0, gameDuration - elapsed);
                document.getElementById('hud-timer').innerText = "TIME: " + Math.floor(remaining);

                if (remaining <= 0 && playerKite) {
                    endMatchTimeUp();
                }
            }

            if (playerKite && !playerKite.dead) {
                playerKite.update(engine, input);
                // ... broadcast ...
                if (gameMode !== 'SINGLE' && network.myId) {
                    network.send({
                        type: 'UPDATE',
                        id: network.myId,
                        x: playerKite.x,
                        y: playerKite.y,
                        dead: playerKite.dead,
                        score: playerKite.score,
                        secret: playerKite.secret
                    });
                }

                // Collisions
                const enemies = engine.layers.action.filter(e => e instanceof PixelKite && e !== playerKite && !e.dead);
                enemies.forEach(enemy => {
                    const result = playerKite.checkCollision(enemy);

                    // If I cut them
                    if (result === 'I_CUT_THEM') {
                        // Local effect
                        enemy.dead = true;
                        enemy.vy = 2;
                        ParticleSystem.spawnExplosion(engine, enemy.x, enemy.y, enemy.color, 15);
                        engine.triggerShake(5);
                        audio.playCut(); // SFX
                        playerKite.score++;
                        updateHUD();

                        if (enemy.secret) showNotification(`CUT! SECRET: "${enemy.secret}"`);

                        // Net Sync
                        if (gameMode !== 'SINGLE' && enemy.peerId) {
                            network.send({ type: 'KILL', targetId: enemy.peerId });
                        }

                    } else if (result === 'THEY_CUT_ME') {
                        die();
                    }
                });
            }
        }
    }, 16);

    function die() {
        if (playerKite.dead) return;
        playerKite.dead = true;
        ParticleSystem.spawnExplosion(engine, playerKite.x, playerKite.y, playerKite.color, 30);
        engine.triggerShake(20);
        audio.playDie(); // SFX

        // Broadcast Death
        if (gameMode !== 'SINGLE') {
            network.send({ type: 'DIED', id: network.myId, secret: playerKite.secret });
        }

        endGame();
    }

    // 5. Network Events
    network.onConnected = (id) => {
        console.log('Net Ready:', id);
        if (gameMode === 'MULTI_HOST') {
            // Generate simple 6-character alphanumeric code
            const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude confusing chars
            let simpleCode = '';
            for (let i = 0; i < 6; i++) {
                simpleCode += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            displayRoomCode = simpleCode; // Store for HUD display
            document.getElementById('display-room-code').innerText = simpleCode;

            // Update URL with full ID for sharing
            const url = new URL(window.location);
            url.searchParams.set('room', id);
            url.searchParams.set('code', simpleCode);
            window.history.pushState({}, '', url);

            // Show shareable link hint
            const shareHint = document.createElement('p');
            shareHint.style.fontSize = '0.8rem';
            shareHint.style.marginTop = '10px';
            shareHint.innerHTML = 'Share this URL with friends to join!';
            document.getElementById('step-waiting').appendChild(shareHint);
        } else if (gameMode === 'MULTI_GUEST') {
            // Connected to own ID, now connect to Host
            // Wait for manual 'Join' or auto?
        }
    };

    network.onData = (data) => {
        if (data.type === 'UPDATE') {
            let peer = peers[data.id];
            if (!peer) {
                peer = new PixelKite(data.x, data.y, '#ffffff');
                peer.peerId = data.id;
                peer.isPlayer = false;
                peers[data.id] = peer;
                engine.addEntity('action', peer);
            }
            peer.x = data.x;
            peer.y = data.y;
            if (data.dead) peer.dead = true;
            if (data.dead) peer.dead = true;
            // Also sync score/secret if present
            if (data.score !== undefined) peer.score = data.score;
            if (data.secret !== undefined) peer.secret = data.secret;

        } else if (data.type === 'KILL') {
            if (data.targetId === network.myId) die();
        } else if (data.type === 'DIED') {
            showNotification(`PLAYER DIED! SECRET: "${data.secret}"`);
        } else if (data.type === 'START') {
            gameDuration = data.duration || 0;
            startGame();
        } else if (data.type === 'START') {
            gameDuration = data.duration || 0;
            startGame();
        } else if (data.type === 'MATCH_RESULTS') {
            showMatchResults(data.results);
        }
    };

    // 6. UI Manager
    const ui = {
        views: {
            setup: document.getElementById('view-setup'),
            gameover: document.getElementById('view-gameover'),
            hud: document.getElementById('game-hud')
        },
        steps: {
            mode: document.getElementById('step-mode'),
            lobby: document.getElementById('step-lobby'),
            waiting: document.getElementById('step-waiting'),
            1: document.getElementById('step-1'),
            2: document.getElementById('step-2'),
            3: document.getElementById('step-3')
        }
    };

    let playerData = { name: '', color: '#ff9900', secret: '' };

    function step(s) {
        // Hide all steps
        Object.values(ui.steps).forEach(v => { if (v) v.classList.add('hidden'); });
        if (s) s.classList.remove('hidden');
    }

    // --- BUTTON HANDLERS ---

    // Mode Selection
    document.getElementById('btn-mode-single').onclick = () => {
        gameMode = 'SINGLE';
        step(ui.steps[1]); // Go to Name Input
    };

    document.getElementById('btn-mode-multi').onclick = () => {
        step(ui.steps.lobby); // Go to Lobby
    };

    // Lobby Actions
    document.getElementById('btn-create-room').onclick = () => {
        gameMode = 'MULTI_HOST';
        network.init();
        step(ui.steps[1]); // Setup Profile before waiting
    };

    document.getElementById('btn-join-room').onclick = () => {
        gameMode = 'MULTI_GUEST';
        const code = document.getElementById('input-room-code').value;
        if (!code) return;
        // For now, treat input as full ID (we'll need a mapping service for real 4-digit codes)
        joinGame(code);
    };

    document.getElementById('btn-back-mode').onclick = () => {
        step(ui.steps.mode);
    };

    function joinGame(hostId) {
        network.init();
        // Give PeerJS a moment to init before connecting
        setTimeout(() => network.connectTo(hostId), 1000);
        step(ui.steps[1]); // Setup Profile
    }

    // Profile Wizard
    document.getElementById('btn-next-1').onclick = () => {
        const val = document.getElementById('input-name').value;
        if (val) playerData.name = val;
        step(ui.steps[2]);
    };

    document.querySelectorAll('.color-btn').forEach(btn => {
        btn.onclick = (e) => {
            playerData.color = e.target.dataset.color;
            step(ui.steps[3]);
        };
    });

    document.getElementById('btn-start-game').onclick = () => {
        playerData.secret = document.getElementById('input-secret').value;

        if (gameMode === 'MULTI_HOST') {
            step(ui.steps.waiting);
        } else if (gameMode === 'MULTI_GUEST') {
            showNotification("WAITING FOR HOST...");
            step(ui.steps.waiting);
            document.getElementById('btn-start-multi').classList.add('hidden');
        } else {
            startGame();
        }
    };

    document.getElementById('btn-start-multi').onclick = () => {
        const duration = parseInt(document.getElementById('select-duration').value);
        gameDuration = duration;
        network.send({ type: 'START', duration: duration });
        startGame();
    };

    document.getElementById('btn-lobby').onclick = () => {
        location.href = location.pathname;
    };

    document.getElementById('btn-retry').onclick = () => {
        location.href = location.pathname; // Hard reload
    };

    document.getElementById('btn-exit').onclick = () => {
        // Disconnect logic
        if (network.peer) network.peer.destroy(); // Hard refresh safer
        location.href = location.pathname;
    };

    // Init Leaderboard Display
    document.getElementById('local-best').innerText = localStorage.getItem('sankranti_best') || 0;

    // --- LOGIC ---

    // Check URL for Room Code (Auto-Join via shared link)
    const urlParams = new URLSearchParams(window.location.search);
    const roomId = urlParams.get('room');
    const displayCode = urlParams.get('code');
    if (roomId) {
        // Auto-join via shared URL
        console.log("Auto-joining room via shared link:", displayCode || roomId);
        gameMode = 'MULTI_GUEST';
        if (displayCode) displayRoomCode = displayCode; // Store guest code for display
        joinGame(roomId);
    }

    function startGame() {
        audio.enable(); // Browser requires user gesture
        audio.playStart();

        ui.views.setup.classList.add('hidden');
        ui.views.hud.classList.remove('hidden');

        gameState = 'PLAYING';
        startTime = Date.now();

        playerKite = new PlayerKite(engine.width / 2, engine.height - 50, playerData);
        engine.addEntity('action', playerKite);

        if (gameMode !== 'SINGLE') {
            document.getElementById('lobby-info').classList.remove('hidden');
            document.getElementById('room-code').innerText = displayRoomCode || network.myId?.substring(0, 6) || "????";
            if (gameDuration > 0) document.getElementById('hud-timer').classList.remove('hidden');
        }

        updateHUD();
    }

    function updateHUD() {
        if (!playerKite) return;
        document.getElementById('hud-name').innerText = playerKite.name;
        document.getElementById('hud-score').innerText = playerKite.score;

        // Singleplayer Highscore
        if (gameMode === 'SINGLE') {
            const best = localStorage.getItem('sankranti_best') || 0;
            if (playerKite.score > best) {
                localStorage.setItem('sankranti_best', playerKite.score);
            }
        }
    }

    function showNotification(msg) {
        const el = document.getElementById('notification-banner');
        const text = document.getElementById('notify-text');
        text.innerText = msg;
        el.classList.remove('hidden');
        setTimeout(() => el.classList.add('hidden'), 4000);
    }

    function endGame() {
        gameState = 'GAME_OVER';
        setTimeout(() => {
            ui.views.hud.classList.add('hidden');
            ui.views.gameover.classList.remove('hidden');
            ui.views.gameover.classList.add('active');

            const duration = Math.floor((Date.now() - startTime) / 1000);
            document.getElementById('final-time').innerText = duration + 's';
            document.getElementById('final-score').innerText = playerKite.score;

            // Show Best
            const best = localStorage.getItem('sankranti_best') || 0;
            if (playerKite.score > best) {
                localStorage.setItem('sankranti_best', playerKite.score);
                document.getElementById('final-score').innerText += " (NEW RECORD!)";
            } else {
                document.getElementById('final-score').innerText += ` (BEST: ${best})`;
            }

        }, 1500);
    }

    function endMatchTimeUp() {
        if (gameState !== 'PLAYING') return;
        gameState = 'GAME_OVER'; // Stop updates

        if (gameMode === 'MULTI_HOST') {
            // Gather all players
            let allPlayers = [];

            // Add Self (Host)
            allPlayers.push({
                name: playerKite.name,
                secret: playerKite.secret,
                score: playerKite.score,
                dead: playerKite.dead
            });

            // Add Peers
            Object.values(peers).forEach(p => {
                allPlayers.push({
                    name: p.name || "Guest",
                    secret: p.secret || "???",
                    score: p.score || 0,
                    dead: p.dead || false
                });
            });

            // Logic: Last Man Standing Wins, otherwise highest score
            const survivors = allPlayers.filter(p => !p.dead);
            if (survivors.length === 1) {
                const winner = survivors[0];
                allPlayers = allPlayers.filter(p => p !== winner);
                allPlayers.unshift(winner);
            } else {
                allPlayers.sort((a, b) => b.score - a.score);
            }

            // Broadcast
            network.send({
                type: 'MATCH_RESULTS',
                results: allPlayers
            });
            showMatchResults(allPlayers);

        } else if (gameMode === 'SINGLE') {
            endGame();
        }
    }

    function showMatchResults(results) {
        gameState = 'WINNER';
        ui.views.hud.classList.add('hidden');
        document.getElementById('view-winner').classList.remove('hidden');
        document.getElementById('view-winner').classList.add('active');

        const winner = results[0];
        document.getElementById('winner-name').innerText = winner.name; // Note: Names need to be synced!
        document.getElementById('winner-secret').innerText = `"${winner.secret}"`;

        // Render Losers
        const list = document.getElementById('winner-losers');
        list.innerHTML = '';
        results.slice(1).forEach(p => {
            const li = document.createElement('li');
            li.innerText = `${p.score} Kills - "${p.secret}"`;
            list.appendChild(li);
        });

        audio.playWin(); // Victory sound
    }

});
