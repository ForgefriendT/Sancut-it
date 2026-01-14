export class InputManager {
    constructor() {
        this.keys = {
            ArrowUp: false,
            ArrowDown: false,
            ArrowLeft: false,
            ArrowRight: false,
            w: false,
            a: false,
            s: false,
            d: false
        };

        window.addEventListener('keydown', (e) => this.keys[e.key] = true);
        window.addEventListener('keyup', (e) => this.keys[e.key] = false);
    }

    get thrust() {
        return this.keys.ArrowUp || this.keys.w;
    }

    get reel() {
        return this.keys.ArrowDown || this.keys.s;
    }

    get left() {
        return this.keys.ArrowLeft || this.keys.a;
    }

    get right() {
        return this.keys.ArrowRight || this.keys.d;
    }
}
