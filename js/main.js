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
    let connectedPlayers = {}; // id -> {name, color, secret, ready}
    let isGameStarted = false;
    let hostGameRunning = false; // Track if host has already started

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
                        secret: playerKite.secret,
                        lives: playerKite.lives // Sync lives
                    });
                }

                // Early Win Check (Host Only)
                if (gameMode === 'MULTI_HOST' && isGameStarted) {
                    // Check lives instead of dead status (because dead=true during respawn)
                    const activePeers = Object.values(peers).filter(p => (p.lives === undefined || p.lives > 0)).length;
                    const hostAlive = playerKite.lives > 0;
                    const totalSurvivors = activePeers + (hostAlive ? 1 : 0);

                    // If only 1 survivor (and more than 1 player joined), end game
                    if (totalSurvivors <= 1 && Object.keys(connectedPlayers).length > 0) {
                        // Grace period to realize you won
                        if (!gameTimer) gameTimer = setTimeout(() => endMatchTimeUp(), 2000);
                    }
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

        playerKite.lives--;
        updateHUD();

        ParticleSystem.spawnExplosion(engine, playerKite.x, playerKite.y, playerKite.color, 30);
        engine.triggerShake(20);
        audio.playDie(); // SFX

        // Broadcast Hit/Death
        if (gameMode !== 'SINGLE') {
            // Send update immediately so others see life lost
            network.send({
                type: 'UPDATE',
                id: network.myId,
                x: playerKite.x,
                y: playerKite.y,
                dead: playerKite.lives <= 0, // Only mark dead if 0 lives
                score: playerKite.score,
                secret: playerKite.secret,
                lives: playerKite.lives
            });
        }

        if (playerKite.lives > 0) {
            // Respawn
            playerKite.dead = true; // Temporarily hide
            // Respawn after 3s
            setTimeout(() => {
                if (gameState !== 'PLAYING') return;
                playerKite.dead = false;
                playerKite.x = 30 + Math.random() * (engine.width - 60);
                playerKite.y = 40 + Math.random() * 60;
                playerKite.invulnerable = 120; // 2 seconds safety

                // Reset tail?
                playerKite.tailNodes.forEach(n => { n.x = playerKite.x; n.y = playerKite.y; });
            }, 3000);

            showNotification(`RESPAWNING... (${playerKite.lives} LIVES LEFT)`);
        } else {
            // Perma-death
            playerKite.dead = true;
            if (gameMode !== 'SINGLE') {
                network.send({ type: 'DIED', id: network.myId, secret: playerKite.secret });
            }
            if (gameMode === 'SINGLE') endGame();
            // In multiplayer, we just spectate now
            showNotification("YOU ARE OUT! SPECTATING...");
        }
    }

    // 5. Network Events
    network.onConnected = (id) => {
        console.log('Net Ready:', id);
        if (gameMode === 'MULTI_HOST') {
            // The ID itself is now the short, shareable code!
            displayRoomCode = id;
            document.getElementById('display-room-code').innerText = displayRoomCode;

            // Update URL for sharing
            const url = new URL(window.location);
            url.searchParams.set('room', id);
            window.history.pushState({}, '', url);

            // Show shareable info
            const shareHint = document.createElement('p');
            shareHint.style.fontSize = '0.8rem';
            shareHint.style.marginTop = '10px';
            shareHint.innerHTML = `Share code <strong>${displayRoomCode}</strong> or this URL!`;
            document.getElementById('step-waiting').appendChild(shareHint);
        } else if (gameMode === 'MULTI_GUEST') {
            // Connected to own ID, now connect to Host
            // Wait for manual 'Join' or auto?
        }
    };

    // New: Handle peer joins
    network.onPeerJoin = (peerId) => {
        console.log('Peer joined:', peerId);

        if (gameMode === 'MULTI_HOST') {
            // Host: Send current player list to new joiner
            // Include Host in the list
            const fullList = { ...connectedPlayers };
            fullList[network.myId] = {
                name: playerData.name,
                color: playerData.color,
                secret: playerData.secret,
                ready: true
            };

            network.sendTo(peerId, {
                type: 'PLAYER_LIST',
                players: fullList,
                gameStarted: isGameStarted
            });

            // Broadcast new player count
            updatePlayerList();
        } else if (gameMode === 'MULTI_GUEST') {
            // Guest: Send my player info to host
            network.send({
                type: 'PLAYER_INFO',
                name: playerData.name,
                color: playerData.color,
                secret: playerData.secret
            });
        }
    };

    // New: Handle peer disconnects
    network.onPeerLeave = (peerId) => {
        console.log('Peer left:', peerId);
        delete connectedPlayers[peerId];

        // Remove their kite if in game
        if (peers[peerId]) {
            peers[peerId].dead = true;
            delete peers[peerId];
        }

        updatePlayerList();
    };

    network.onData = (data, senderId) => {
        if (data.type === 'UPDATE') {
            let peer = peers[data.id];
            if (!peer) {
                // Look up color from lobby info
                const pInfo = connectedPlayers[data.id];
                const pColor = pInfo ? pInfo.color : '#ffffff';
                peer = new PixelKite(data.x, data.y, pColor);
                peer.peerId = data.id;
                peer.isPlayer = false;
                peers[data.id] = peer;
                engine.addEntity('action', peer);
            }
            peer.x = data.x;
            peer.y = data.y;
            if (data.dead) peer.dead = true;
            if (data.dead) peer.dead = true;
            if (data.score !== undefined) peer.score = data.score;
            if (data.secret !== undefined) peer.secret = data.secret;
            if (data.lives !== undefined) peer.lives = data.lives;
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
        } else if (data.type === 'PLAYER_INFO') {
            // Store player info
            connectedPlayers[senderId] = {
                name: data.name,
                color: data.color,
                secret: data.secret,
                ready: true
            };
            updatePlayerList();

            // If host, broadcast updated player list to all
            if (gameMode === 'MULTI_HOST') {
                // Include Host in the list
                const fullList = { ...connectedPlayers };
                fullList[network.myId] = {
                    name: playerData.name,
                    color: playerData.color,
                    secret: playerData.secret,
                    ready: true
                };

                network.broadcast({
                    type: 'PLAYER_LIST',
                    players: fullList,
                    gameStarted: isGameStarted
                });
            }

        } else if (data.type === 'PLAYER_LIST') {
            // Update local player list
            connectedPlayers = data.players;
            updatePlayerList();

            // If game already started, join immediately
            if (data.gameStarted && gameState !== 'PLAYING') {
                gameDuration = 0; // No time limit for late joiners
                startGame();
            }

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
        // Generate a short, custom Peer ID that users can type
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let customId = '';
        for (let i = 0; i < 8; i++) {
            customId += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        network.init(customId); // Use custom ID instead of auto-generated UUID
        step(ui.steps[1]); // Setup Profile before waiting
    };

    document.getElementById('btn-join-room').onclick = () => {
        gameMode = 'MULTI_GUEST';
        const code = document.getElementById('input-room-code').value.trim().toUpperCase();
        if (!code) return;

        // The code should be an 8-character room code like "K3H9W2NK"
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
            // Update list so my color/name is reflected immediately if I go back or forward
            updatePlayerList();
            step(ui.steps[3]);
        };
    });

    document.getElementById('btn-start-game').onclick = () => {
        playerData.secret = document.getElementById('input-secret').value;

        if (gameMode === 'MULTI_HOST') {
            step(ui.steps.waiting);
        } else if (gameMode === 'MULTI_GUEST') {
            if (hostGameRunning) {
                // Late join implementation
                gameDuration = 0;
                startGame();
            } else {
                showNotification("WAITING FOR HOST...");
                step(ui.steps.waiting);
                document.getElementById('btn-start-multi').classList.add('hidden');
            }
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
    if (roomId) {
        // Auto-join via shared URL
        console.log("Auto-joining room via shared link:", roomId);
        gameMode = 'MULTI_GUEST';
        displayRoomCode = roomId; // Store for HUD display
        joinGame(roomId);
    }

    function startGame() {
        audio.enable(); // Browser requires user gesture
        audio.playStart();

        ui.views.setup.classList.add('hidden');
        ui.views.hud.classList.remove('hidden');

        gameState = 'PLAYING';
        isGameStarted = true; // Mark game as started for late joiners
        startTime = Date.now();

        // Randomize spawn position for multiplayer (avoid clustering)
        const spawnX = 30 + Math.random() * (engine.width - 60);
        const spawnY = 40 + Math.random() * 60; // Upper-mid area
        playerKite = new PlayerKite(spawnX, spawnY, playerData);
        engine.addEntity('action', playerKite);

        if (gameMode !== 'SINGLE') {
            document.getElementById('lobby-info').classList.remove('hidden');
            document.getElementById('room-code').innerText = displayRoomCode || network.myId?.substring(0, 6) || "????";
            if (gameDuration > 0) document.getElementById('hud-timer').classList.remove('hidden');
        }

        updateHUD();
    }

    function resetGameForRematch() {
        gameState = 'WAITING';
        isGameStarted = false;
        gameDuration = 120; // Reset default or keep last?
        gameTimer = 0;

        // Clear entities
        engine.layers.action = []; // Clear all kites/birds
        peers = {}; // Rebuild peers locally? No, connection stays open.
        // Wait, if connection stays open, we don't need to clear connectedPlayers.

        // Just reset views
        ui.views.gameover.classList.add('hidden');
        document.getElementById('view-winner').classList.add('hidden');
        ui.views.hud.classList.add('hidden'); // Hide HUD
        ui.views.setup.classList.remove('hidden'); // Show Setup/Lobby

        step(ui.steps.waiting);

        showNotification("REMATCH INITIATED!");
    }

    function updateHUD() {
        if (!playerKite) return;
        document.getElementById('hud-name').innerText = playerKite.name;
        document.getElementById('hud-score').innerText = playerKite.score;

        // Update Lives with Pixel Hearts
        const livesContainer = document.getElementById('hud-lives');
        livesContainer.innerHTML = '';
        const safeLives = Math.max(0, playerKite.lives);
        for (let i = 0; i < safeLives; i++) {
            const heart = document.createElement('span');
            heart.className = 'pixel-heart';
            livesContainer.appendChild(heart);
        }

        // Singleplayer Highscore
        if (gameMode === 'SINGLE') {
            const best = localStorage.getItem('sankranti_best') || 0;
            if (playerKite.score > best) {
                localStorage.setItem('sankranti_best', playerKite.score);
            }
        }
    }

    function updatePlayerList() {
        const list = document.getElementById('player-list');
        list.innerHTML = '';

        // Add Self
        const selfLi = document.createElement('li');
        selfLi.style.color = playerData.color;
        selfLi.innerText = `> ${playerData.name || "YOU"} (YOU)`;
        list.appendChild(selfLi);

        // Add Connected Peers (Filter out self)
        Object.entries(connectedPlayers).forEach(([id, p]) => {
            if (id === network.myId) return; // Skip self (already added above)
            const li = document.createElement('li');
            li.style.color = p.color;
            li.innerText = `- ${p.name || "Unknown"}`;
            list.appendChild(li);
        });
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
            Object.entries(peers).forEach(([id, p]) => {
                const info = connectedPlayers[id] || {};
                allPlayers.push({
                    name: info.name || "Guest",
                    secret: info.secret || p.secret || "???",
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

        if (gameMode === 'MULTI_HOST') {
            const btn = document.getElementById('btn-rematch');
            btn.classList.remove('hidden');
            btn.onclick = () => {
                network.send({ type: 'REMATCH' });
                resetGameForRematch();
            };
        } else {
            document.getElementById('btn-rematch').classList.add('hidden');
        }
    }

});
