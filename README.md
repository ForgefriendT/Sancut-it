# 🪁 Sancut-it

A fast-paced multiplayer kite fighting arcade game built with vanilla JavaScript and pixel art aesthetics. Cut your opponents' strings, dodge attacks, and prove you're the last kite standing!

## 🎮 Game Concept

Sancut-it is inspired by the traditional kite flying festival of **Makar Sankranti/Uttarayan**, where participants engage in kite fights by cutting each other's strings. This digital arcade version brings that thrill to your browser with retro pixel graphics and real-time multiplayer action.

## ✨ Features

### Gameplay Modes
- **Singleplayer**: Battle against AI kites, survive as long as possible, and rack up your high score
- **Multiplayer**: Create or join rooms with friends using simple 6-character codes
  - Timed matches (60s, 120s, or 5 minutes)
  - Real-time P2P gameplay using PeerJS
  - Winner declared by kills or "Last Man Standing" rule

### Game Mechanics
- **String Cutting**: Position your kite's string over opponents to cut them down
- **Secret Messages**: Enter a secret message before playing - it reveals when you're defeated!
- **Dynamic Scoring**: Earn points for every kite you cut
- **Trophy System**: Winner screen displays triumph and reveals all fallen players' secrets

### Visual & Audio
- **Pixel Art Style**: Retro 8-bit graphics with:
  - Animated clouds
  - Parallax city skyline
  - Pixelated kites and characters
  - Particle explosions
- **Generative Audio**: 8-bit sound effects created with Web Audio API
  - Cut sounds
  - Death sounds
  - Victory fanfare

## 🎯 How to Play

### Controls
- **Arrow Keys** or **WASD**: Move your kite
- Maneuver your kite's string over opponents to cut them
- Avoid getting cut yourself!

### Multiplayer Setup
1. Click **MULTIPLAYER** → **CREATE ROOM**
2. Share the displayed 6-character code or URL with friends
3. Friends join by clicking the URL or entering the code
4. Host selects match duration and starts the game
5. Winner is determined by:
   - Most kills when timer expires
   - Last player standing if others are eliminated

## 🛠️ Technology Stack

- **Frontend**: Vanilla JavaScript (ES6 modules)
- **Graphics**: HTML5 Canvas with custom pixel rendering engine
- **Networking**: PeerJS for peer-to-peer multiplayer
- **Audio**: Web Audio API for generative 8-bit sounds
- **Styling**: CSS3 with pixel art design patterns

## 🚀 Local Development

```bash
# Clone the repository
git clone https://github.com/yourusername/sancut-it.git
cd sancut-it

# Start a local server (Python example)
python -m http.server 8000

# Or use Node.js http-server
npx http-server -p 8000

# Open browser
open http://localhost:8000
```

## 📦 Deployment

The game is built with vanilla JavaScript and has no build step. Simply:

1. Upload all files to any static hosting service:
   - GitHub Pages
   - Netlify
   - Vercel
   - Firebase Hosting

2. Ensure the server serves the correct MIME types for `.js` files

## 🎨 Credits

**Developed by**: Fauzan Baig

Inspired by the traditional Indian kite festival of Makar Sankranti/Uttarayan.

## 📝 License

MIT License - Feel free to fork and modify!

---

**Thank you for playing!** 🪁✨

*May your string be sharp and your sky be clear.*
