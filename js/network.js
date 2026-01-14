export class NetworkManager {
    constructor() {
        this.peer = null;
        this.conn = null;
        this.isHost = false;
        this.myId = null;

        // Events
        this.onConnected = null;
        this.onData = null;
        this.onPeerError = null;
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
            // Incoming connection (I am Host?)
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
        this.conn = conn;

        conn.on('open', () => {
            console.log('Connected to peer!');
            // Send Hello?
            conn.send({ type: 'HELLO', from: this.myId });
        });

        conn.on('data', (data) => {
            if (this.onData) this.onData(data);
        });
    }

    send(data) {
        if (this.conn && this.conn.open) {
            this.conn.send(data);
        }
    }
}
