import Peer, { type DataConnection } from 'peerjs';

export type MessageType = 'SESSION_INIT' | 'REVEAL_PAGE' | 'SYNC_STATE' | 'TIMER_SYNC' | 'SESSION_END' | 'PEER_INFO';

export interface PeerMessage {
  type: MessageType;
  payload: any;
}

export class PeerService {
  private peer: Peer | null = null;
  private connections: DataConnection[] = [];
  private onMessageCallback: ((message: PeerMessage) => void) | null = null;
  private onConnectionChangeCallback: ((count: number) => void) | null = null;
  private onOpenCallback: ((id: string) => void) | null = null;
  private onErrorCallback: ((err: string) => void) | null = null;
  private lastSessionInit: any = null;
  private currentRevealedPages: any[] = [];
  private lastTimerSync: any = null;
  private destroyed: boolean = false;

  public init(id?: string) {
    this.destroy();
    this.destroyed = false;
    try {
      const options = { 
        debug: 1,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
          ]
        }
      };

      this.peer = id ? new Peer(id, options) : new Peer(options);

      this.peer.on('open', (peerId) => {
        this.onOpenCallback?.(peerId);
      });

      this.peer.on('error', (err) => {
        console.error('PeerJS Error:', err.type);
        this.onErrorCallback?.(err.type);
      });

      this.peer.on('disconnected', () => {
        if (!this.destroyed) this.peer?.reconnect();
      });
    } catch (e: any) {
      this.onErrorCallback?.('initialization-failed');
    }
    return this.peer;
  }

  public onOpen(callback: (id: string) => void) { this.onOpenCallback = callback; if (this.peer?.id && this.peer.open) callback(this.peer.id); }
  public onError(callback: (err: string) => void) { this.onErrorCallback = callback; }
  public onMessage(callback: (message: PeerMessage) => void) { this.onMessageCallback = callback; }
  public onConnectionCountChange(callback: (count: number) => void) { this.onConnectionChangeCallback = callback; }

  public host() {
    if (!this.peer) this.init();
    this.peer?.on('connection', (conn) => {
      if (this.connections.length >= 5) {
        console.warn('Max connections reached. Rejecting peer.');
        conn.close();
        return;
      }

      conn.on('open', () => {
        this.connections.push(conn);
        this.onConnectionChangeCallback?.(this.connections.length);

        // Catch up the new peer immediately
        if (this.lastSessionInit) {
          conn.send(this.lastSessionInit);
          this.currentRevealedPages.forEach(msg => conn.send(msg));
          if (this.lastTimerSync) conn.send(this.lastTimerSync);
        }
      });

      conn.on('data', (data: any) => this.onMessageCallback?.(data as PeerMessage));

      const cleanup = () => {
        const initialLength = this.connections.length;
        this.connections = this.connections.filter(c => c.peer !== conn.peer);
        if (this.connections.length !== initialLength) {
          this.onConnectionChangeCallback?.(this.connections.length);
        }
      };

      conn.on('close', cleanup);
      conn.on('error', cleanup);
      (conn as any).peerConnection?.addEventListener('connectionstatechange', () => {
        const state = (conn as any).peerConnection?.connectionState;
        if (state === 'disconnected' || state === 'failed' || state === 'closed') {
          cleanup();
        }
      });
    });
  }

  public join(hostId: string) {
    if (this.destroyed) return;
    if (!this.peer || !this.peer.open) {
      this.peer?.once('open', () => this.join(hostId));
      if (!this.peer) this.init();
      return;
    }
    const conn = this.peer.connect(hostId);

    const cleanup = () => {
      this.connections = [];
      this.onConnectionChangeCallback?.(0);
    };

    conn.on('open', () => {
      this.connections = [conn];
      this.onConnectionChangeCallback?.(1);
    });
    conn.on('data', (data: any) => this.onMessageCallback?.(data as PeerMessage));
    conn.on('close', cleanup);
    conn.on('error', cleanup);

    (conn as any).peerConnection?.addEventListener('connectionstatechange', () => {
      const state = (conn as any).peerConnection?.connectionState;
      if (state === 'disconnected' || state === 'failed' || state === 'closed') {
        cleanup();
      }
    });
  }

  public send(type: MessageType, payload: any) {
    const msg = { type, payload };

    if (type === 'SESSION_INIT') {
      this.lastSessionInit = msg;
      this.currentRevealedPages = [];
    } else if (type === 'REVEAL_PAGE') {
      if (payload.isRevealed) this.currentRevealedPages.push(msg);
      else this.currentRevealedPages = this.currentRevealedPages.filter(m => m.payload.pageNumber !== payload.pageNumber);
    } else if (type === 'TIMER_SYNC') {
      this.lastTimerSync = msg;
    }

    this.connections.forEach(conn => {
      if (conn.open) conn.send(msg);
    });
  }

  public destroy() {
    this.destroyed = true;
    this.onConnectionChangeCallback = null;
    this.onMessageCallback = null;
    this.onErrorCallback = null;
    this.onOpenCallback = null;
    this.connections.forEach(c => c.close());
    this.connections = [];
    if (this.peer) { this.peer.destroy(); this.peer = null; }
    this.lastSessionInit = null;
    this.currentRevealedPages = [];
    this.lastTimerSync = null;
  }
}

export const peerService = new PeerService();
