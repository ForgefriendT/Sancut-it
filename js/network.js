export class NetworkManager {
    constructor() {
        this.peer = null;
        this.connections = []; // Changed from single conn to array
        this.isHost = false;
        this.myId = null;

        // Events
        this.onConnected = null;
        this.onData = null;
        this.onPeerError = null;
        this.onPeerJoin = null; // New callback for when peer joins
        this.onPeerLeave = null; // New callback for when peer leaves
    }

    init(id = null) {
        // Create Peer (auto-generate ID if null)
        this.peer = new Peer(id, {
            debug: 2
        });

        this.peer.on('open', (id) => {
            console.log('My peer ID is: ' + id);
            this.myId = id;
            if (this.onConnected) this.onConnected(id);
        });

        this.peer.on('connection', (conn) => {
            // Incoming connection (I am Host)
            console.log('Incoming connection from:', conn.peer);
            this.handleConnection(conn);
        });

        this.peer.on('error', (err) => {
            console.error(err);
            if (this.onPeerError) this.onPeerError(err);
        });
    }

    connectTo(hostId) {
        this.isHost = false;
        const conn = this.peer.connect(hostId);
        this.handleConnection(conn);
    }

    handleConnection(conn) {
        conn.on('open', () => {
            console.log('Connected to peer:', conn.peer);
            // Add to connections array
            this.connections.push(conn);

            // Notify about new peer
            if (this.onPeerJoin) this.onPeerJoin(conn.peer);

            // Send Hello
            conn.send({ type: 'HELLO', from: this.myId });
        });

        conn.on('data', (data) => {
            if (this.onData) this.onData(data, conn.peer);
        });

        conn.on('close', () => {
            console.log('Peer disconnected:', conn.peer);
            // Remove from connections
            this.connections = this.connections.filter(c => c.peer !== conn.peer);
            if (this.onPeerLeave) this.onPeerLeave(conn.peer);
        });
    }

    // Broadcast to all connected peers
    broadcast(data) {
        this.connections.forEach(conn => {
            if (conn.open) {
                conn.send(data);
            }
        });
    }

    // Send to specific peer
    sendTo(peerId, data) {
        const conn = this.connections.find(c => c.peer === peerId);
        if (conn && conn.open) {
            conn.send(data);
        }
    }

    // Legacy send (broadcasts for backward compatibility)
    send(data) {
        this.broadcast(data);
    }
}
