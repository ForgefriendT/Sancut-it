export class PixelBird {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.vx = 0.5 + Math.random() * 1.0;
        this.vy = (Math.random() - 0.5) * 0.2;
        this.frame = 0;
        this.color = '#333'; // Silhouette
    }

    update(engine) {
        this.x += this.vx;
        this.y += this.vy + Math.sin(engine.time * 0.2) * 0.1;

        // Wrap around
        if (this.x > engine.width) this.x = -10;

        // Flap animation
        if (Math.floor(engine.time * 2) % 4 === 0) {
            this.frame = (this.frame + 1) % 2;
        }
    }

    draw(ctx) {
        ctx.fillStyle = this.color;
        // Simple "V" shape logic
        // Frame 0: V (Wing up)
        // Frame 1: - (Wing flat)
        if (this.frame === 0) {
            ctx.fillRect(Math.floor(this.x), Math.floor(this.y), 1, 1);
            ctx.fillRect(Math.floor(this.x) - 1, Math.floor(this.y) - 1, 1, 1);
            ctx.fillRect(Math.floor(this.x) + 1, Math.floor(this.y) - 1, 1, 1);
        } else {
            ctx.fillRect(Math.floor(this.x) - 1, Math.floor(this.y), 3, 1);
        }
    }
}

export class PixelKite {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.color = color; // Expects array [main, accent] or hex
        this.vx = (Math.random() - 0.5) * 0.5;
        this.vy = -0.5 - Math.random() * 0.5; // Rise

        this.swayOffset = Math.random() * 100;
        this.tailNodes = [];
        // Initialize tail
        for (let i = 0; i < 5; i++) {
            this.tailNodes.push({ x: x, y: y + i * 2 });
        }

        this.dead = false;
        this.isAi = false; // Is this a background AI kite?
    }

    update(engine) {
        // Physics
        // Apply wind
        this.vx += (engine.wind.x * 0.05);
        this.vx *= 0.95; // Drag

        this.x += this.vx;
        this.y += this.vy;

        // Sway sine wave
        this.x += Math.sin(engine.time * 0.2 + this.swayOffset) * 0.3;

        // Tail Physics (Inverse Kinematics / Follow)
        let targetX = this.x;
        let targetY = this.y + 4; // Bottom of kite

        this.tailNodes.forEach((node, i) => {
            // Lerp towards target
            node.x += (targetX - node.x) * 0.2;
            node.y += (targetY - node.y) * 0.2;

            // Drag
            node.x -= engine.wind.x * (0.5 + i * 0.1);

            // Set new target for next node
            targetX = node.x;
            targetY = node.y;
        });

        // Bounds check (Kill if too high)
        if (this.y < -50) this.dead = true;
    }

    draw(ctx) {
        if (this.dead) return;

        const kx = Math.floor(this.x);
        const ky = Math.floor(this.y);

        ctx.fillStyle = this.color;

        // Diamond 5x5
        /*
           . # .
           # # #
           . # .
           . # .
        */
        ctx.fillRect(kx, ky - 2, 1, 5); // Spine
        ctx.fillRect(kx - 1, ky - 1, 3, 3); // Body

        // Different color interaction?
        // ctx.fillStyle = 'rgba(255,255,255,0.3)';
        // ctx.fillRect(kx, ky-1, 1, 1); // Highlight

        // Draw Tail
        ctx.fillStyle = '#fff';
        this.tailNodes.forEach(node => {
            ctx.fillRect(Math.floor(node.x), Math.floor(node.y), 1, 1);
        });
    }
    // ... (PixelKite methods) ...
}

export class PlayerKite extends PixelKite {
    constructor(x, y, data) {
        super(x, y, data.color);
        this.name = data.name;
        this.secret = data.secret;
        this.vx = 0;
        this.vy = -1;
        this.score = 0;
        this.lives = 3; // Start with 3 lives
        this.invulnerable = 60; // Frames
    }

    update(engine, input) {
        if (this.invulnerable > 0) this.invulnerable--;
        if (!input) return; // Prevent crash when called by Engine renderer without input

        // 1. Controls
        if (input.thrust) {
            this.vy -= 0.15; // Boost Up
        }
        if (input.reel) {
            this.vy += 0.1; // Pull Down
        }
        if (input.left) {
            this.vx -= 0.15; // Swing Left
        }
        if (input.right) {
            this.vx += 0.15; // Swing Right
        }

        // 2. Physics & Damping
        this.vx *= 0.96;
        this.vy *= 0.96;

        // Gravity/Wind
        this.vx += (engine.wind.x * 0.02);
        this.vy += 0.02; // Gravity

        // 3. Movement
        this.x += this.vx;
        this.y += this.vy;

        // 4. Bounds Check
        // Keep within screen horizontally
        if (this.x < 10) { this.x = 10; this.vx *= -0.5; }
        if (this.x > engine.width - 10) { this.x = engine.width - 10; this.vx *= -0.5; }
        // Don't hit ground
        if (this.y > engine.height - 20) { this.y = engine.height - 20; this.vy = -1; }
        // Ceiling
        if (this.y < 10) { this.y = 10; this.vy = 0.5; }

        // 5. Tail Logic (Copied from parent but smoother)
        let targetX = this.x;
        let targetY = this.y + 4;

        this.tailNodes.forEach((node, i) => {
            node.x += (targetX - node.x) * 0.4; // Tighter follow for player
            node.y += (targetY - node.y) * 0.4;
            node.x -= engine.wind.x * (0.2 + i * 0.05);
            targetX = node.x;
            targetY = node.y;
        });
    }

    draw(ctx) {
        // Draw Label
        ctx.fillStyle = '#fff';
        ctx.font = '10px VT323';
        ctx.textAlign = 'center';
        ctx.fillText(this.name, Math.floor(this.x), Math.floor(this.y) - 10);

        ctx.textAlign = 'center';
        ctx.fillText(this.name, Math.floor(this.x), Math.floor(this.y) - 10);

        // Blink if invulnerable
        if (this.invulnerable > 0 && Math.floor(Date.now() / 100) % 2 === 0) return;

        super.draw(ctx);

        // Draw hitbox debug?
        // ctx.strokeStyle = 'red';
        // ctx.strokeRect(this.x - 5, this.y - 5, 10, 10);
    }

    checkCollision(enemy) {
        if (this.invulnerable > 0 || enemy.dead) return false;

        // Simple String Crossing Logic
        // We define "cutting" as: My kite body hits their string.
        // OR: Line segment intersection (more complex).

        // Let's use simple body-vs-string collision for arcade fun.
        // If my body touches their string nodes -> I cut them.
        // If their body touches my string nodes -> They cut me.

        // 1. Am I cutting them?
        for (let i = 0; i < enemy.tailNodes.length - 1; i++) {
            const p1 = enemy.tailNodes[i];
            // Distance check
            const dx = this.x - p1.x;
            const dy = this.y - p1.y;
            if (dx * dx + dy * dy < 64) { // 8px radius
                return 'I_CUT_THEM';
            }
        }

        // 2. Are they cutting me?
        for (let i = 0; i < this.tailNodes.length - 1; i++) {
            const p1 = this.tailNodes[i];
            const dx = enemy.x - p1.x;
            const dy = enemy.y - p1.y;
            if (dx * dx + dy * dy < 64) {
                return 'THEY_CUT_ME';
            }
        }

        return false;
    }
}
