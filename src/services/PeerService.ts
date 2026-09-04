import Peer, { type DataConnection } from 'peerjs';

export type MessageType = 
  | 'SESSION_INIT' 
  | 'REVEAL_PAGE' 
  | 'SYNC_STATE' 
  | 'TIMER_SYNC' 
  | 'SESSION_END' 
  | 'PEER_INFO'
  | 'PING'
  | 'PONG';

export interface PeerMessage {
  type: MessageType;
  payload: any;
  senderPeerId?: string;
}

export type DetailedConnectionState = 
  | 'idle'
  | 'connecting_signaling'
  | 'signaling_ready'
  | 'discovering_route'
  | 'connecting_peer'
  | 'connected'
  | 'reconnecting'
  | 'failed';

export interface DiagnosticEvent {
  timestamp: number;
  timeStr: string;
  category: 'signaling' | 'ice' | 'data' | 'latency' | 'error';
  message: string;
  details?: any;
}

export interface DiagnosticsSnapshot {
  role: 'host' | 'client' | 'idle';
  peerId: string | null;
  remotePeerIds: string[];
  detailedState: DetailedConnectionState;
  iceConnectionState: string;
  connectionState: string;
  pingMs: number | null;
  localCandidates: string[];
  bufferedAmount: number;
  events: DiagnosticEvent[];
}

export class PeerService {
  private peer: Peer | null = null;
  private connections: DataConnection[] = [];
  private onMessageCallback: ((message: PeerMessage) => void) | null = null;
  private onConnectionChangeCallback: ((count: number, activePeerIds?: string[]) => void) | null = null;
  private onDetailedStateChangeCallback: ((state: DetailedConnectionState) => void) | null = null;
  private onPingChangeCallback: ((pingMs: number) => void) | null = null;
  private onOpenCallback: ((id: string) => void) | null = null;
  private onErrorCallback: ((err: string) => void) | null = null;
  private lastSessionInit: any = null;
  private currentRevealedPages: any[] = [];
  private lastTimerSync: any = null;
  private destroyed: boolean = false;
  private currentRole: 'host' | 'client' | 'idle' = 'idle';

  private detailedState: DetailedConnectionState = 'idle';
  private currentPing: number | null = null;
  private localCandidates: string[] = [];
  private diagnosticEvents: DiagnosticEvent[] = [];
  private heartbeatInterval: any = null;
  private disconnectGraceTimer: any = null;

  private logEvent(category: DiagnosticEvent['category'], message: string, details?: any) {
    const now = new Date();
    const timeStr = `${now.toTimeString().split(' ')[0]}.${now.getMilliseconds().toString().padStart(3, '0')}`;
    const event: DiagnosticEvent = {
      timestamp: Date.now(),
      timeStr,
      category,
      message,
      details,
    };
    this.diagnosticEvents.push(event);
    if (this.diagnosticEvents.length > 50) {
      this.diagnosticEvents.shift();
    }
  }

  private setDetailedState(state: DetailedConnectionState) {
    if (this.detailedState !== state) {
      this.detailedState = state;
      this.logEvent('ice', `State transition -> ${state}`);
      this.onDetailedStateChangeCallback?.(state);
    }
  }

  public init(id?: string) {
    this.destroy();
    this.destroyed = false;
    this.setDetailedState('connecting_signaling');
    this.logEvent('signaling', id ? `Initializing peer with requested ID: ${id}` : 'Initializing peer with random ID');

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
        this.logEvent('signaling', `Connected to signaling server with ID: ${peerId}`);
        this.setDetailedState('signaling_ready');
        this.onOpenCallback?.(peerId);
      });

      this.peer.on('error', (err) => {
        this.logEvent('error', `PeerJS signaling error: ${err.type} - ${err.message}`);
        if (err.type === 'peer-unavailable') {
          this.setDetailedState('failed');
          this.onErrorCallback?.('peer-unavailable');
        } else {
          this.onErrorCallback?.(err.type);
        }
      });

      this.peer.on('disconnected', () => {
        this.logEvent('signaling', 'Disconnected from signaling server. Reconnecting...');
        if (!this.destroyed) this.peer?.reconnect();
      });
    } catch (e: any) {
      this.logEvent('error', `Initialization failed: ${e?.message || e}`);
      this.setDetailedState('failed');
      this.onErrorCallback?.('initialization-failed');
    }
    return this.peer;
  }

  public onOpen(callback: (id: string) => void) { this.onOpenCallback = callback; if (this.peer?.id && this.peer.open) callback(this.peer.id); }
  public onError(callback: (err: string) => void) { this.onErrorCallback = callback; }
  public onMessage(callback: (message: PeerMessage) => void) { this.onMessageCallback = callback; }
  public onConnectionCountChange(callback: (count: number, activePeerIds?: string[]) => void) { this.onConnectionChangeCallback = callback; }
  public onDetailedStateChange(callback: (state: DetailedConnectionState) => void) { this.onDetailedStateChangeCallback = callback; }
  public onPingChange(callback: (pingMs: number) => void) { this.onPingChangeCallback = callback; }

  private startHeartbeat(conn: DataConnection) {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    this.heartbeatInterval = setInterval(() => {
      if (!this.destroyed && conn.open) {
        conn.send({ type: 'PING', payload: { pingTime: Date.now() } });
      }
    }, 2000);
  }

  private hookConnectionDiagnostics(conn: DataConnection, cleanup: (reason?: string) => void) {
    const pc = (conn as any).peerConnection as RTCPeerConnection | undefined;

    if (pc) {
      pc.addEventListener('icecandidate', (e) => {
        if (e.candidate) {
          const type = e.candidate.type || 'unknown';
          const proto = e.candidate.protocol || 'udp';
          this.localCandidates.push(`${type} (${proto})`);
          this.logEvent('ice', `Local ICE candidate gathered: ${type} (${proto})`);
          if (this.detailedState === 'signaling_ready') {
            this.setDetailedState('discovering_route');
          }
        }
      });

      pc.addEventListener('iceconnectionstatechange', () => {
        this.logEvent('ice', `ICE Connection State: ${pc.iceConnectionState}`);
        if (pc.iceConnectionState === 'checking') {
          this.setDetailedState('connecting_peer');
        } else if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
          if (this.disconnectGraceTimer) {
            clearTimeout(this.disconnectGraceTimer);
            this.disconnectGraceTimer = null;
            this.logEvent('ice', 'Connection recovered from temporary drop.');
          }
          this.setDetailedState('connected');
        } else if (pc.iceConnectionState === 'failed') {
          this.logEvent('error', 'ICE connection failed: Direct peer-to-peer route blocked by router/firewall (Symmetric NAT).');
          cleanup('nat-firewall-blocked');
        } else if (pc.iceConnectionState === 'disconnected') {
          this.setDetailedState('reconnecting');
          this.logEvent('ice', 'Connection interrupted (packet loss/jitter). Grace period 6s started...');
          if (!this.disconnectGraceTimer) {
            this.disconnectGraceTimer = setTimeout(() => {
              this.logEvent('error', 'Disconnect grace period expired (6s).');
              cleanup('connection-lost');
            }, 6000);
          }
        }
      });

      pc.addEventListener('connectionstatechange', () => {
        this.logEvent('ice', `Peer Connection State: ${pc.connectionState}`);
        if (pc.connectionState === 'connected') {
          if (this.disconnectGraceTimer) {
            clearTimeout(this.disconnectGraceTimer);
            this.disconnectGraceTimer = null;
          }
          this.setDetailedState('connected');
        } else if (pc.connectionState === 'failed') {
          cleanup('nat-firewall-blocked');
        }
      });
    }
  }

  public host() {
    this.currentRole = 'host';
    if (!this.peer) this.init();
    this.peer?.on('connection', (conn) => {
      this.logEvent('signaling', `Incoming peer connection request from: ${conn.peer}`);
      if (this.connections.length >= 5) {
        this.logEvent('error', 'Max connections reached. Rejecting incoming peer.');
        conn.close();
        return;
      }

      const cleanup = (reason?: string) => {
        if (this.disconnectGraceTimer) {
          clearTimeout(this.disconnectGraceTimer);
          this.disconnectGraceTimer = null;
        }
        const initialLength = this.connections.length;
        this.connections = this.connections.filter(c => c.peer !== conn.peer);
        this.logEvent('ice', `Peer disconnected: ${conn.peer}. Remaining: ${this.connections.length} (Reason: ${reason || 'normal'})`);
        if (this.connections.length !== initialLength) {
          this.onConnectionChangeCallback?.(this.connections.length, this.connections.map(c => c.peer));
        }
        if (this.connections.length === 0) {
          this.setDetailedState('signaling_ready');
          this.currentPing = null;
        }
      };

      this.hookConnectionDiagnostics(conn, cleanup);

      conn.on('open', () => {
        this.logEvent('data', `DataChannel opened with partner: ${conn.peer}`);
        this.connections.push(conn);
        this.setDetailedState('connected');
        this.onConnectionChangeCallback?.(this.connections.length, this.connections.map(c => c.peer));
        this.startHeartbeat(conn);

        // Catch up the new peer immediately
        if (this.lastSessionInit) {
          conn.send(this.lastSessionInit);
          this.currentRevealedPages.forEach(msg => conn.send(msg));
          if (this.lastTimerSync) conn.send(this.lastTimerSync);
        }
      });

      conn.on('data', (data: any) => {
        if (data?.type === 'PING') {
          conn.send({ type: 'PONG', payload: { pingTime: data.payload.pingTime } });
          return;
        }
        if (data?.type === 'PONG') {
          const rtt = Math.max(1, Date.now() - (data.payload?.pingTime || 0));
          this.currentPing = rtt;
          this.onPingChangeCallback?.(rtt);
          return;
        }

        if (data && typeof data === 'object') {
          data.senderPeerId = conn.peer;
        }
        this.onMessageCallback?.(data as PeerMessage);
      });

      conn.on('close', () => cleanup('closed'));
      conn.on('error', (err) => cleanup(`error: ${err?.message || err}`));
    });
  }

  public join(hostId: string) {
    this.currentRole = 'client';
    if (this.destroyed) return;
    if (!this.peer || !this.peer.open) {
      this.setDetailedState('connecting_signaling');
      this.peer?.once('open', () => this.join(hostId));
      if (!this.peer) this.init();
      return;
    }

    this.setDetailedState('discovering_route');
    this.logEvent('signaling', `Initiating peer connection to host: ${hostId}`);
    const conn = this.peer.connect(hostId, { reliable: true });

    const cleanup = (reason?: string) => {
      if (this.disconnectGraceTimer) {
        clearTimeout(this.disconnectGraceTimer);
        this.disconnectGraceTimer = null;
      }
      this.connections = [];
      this.currentPing = null;
      this.logEvent('ice', `Connection to host terminated. (Reason: ${reason || 'closed'})`);
      this.onConnectionChangeCallback?.(0);
      if (reason === 'nat-firewall-blocked') {
        this.setDetailedState('failed');
        this.onErrorCallback?.('nat-firewall-blocked');
      } else {
        this.setDetailedState('idle');
      }
    };

    this.hookConnectionDiagnostics(conn, cleanup);

    conn.on('open', () => {
      this.logEvent('data', `DataChannel opened to host: ${hostId}`);
      this.connections = [conn];
      this.setDetailedState('connected');
      this.onConnectionChangeCallback?.(1);
      this.startHeartbeat(conn);
    });

    conn.on('data', (data: any) => {
      if (data?.type === 'PING') {
        conn.send({ type: 'PONG', payload: { pingTime: data.payload.pingTime } });
        return;
      }
      if (data?.type === 'PONG') {
        const rtt = Math.max(1, Date.now() - (data.payload?.pingTime || 0));
        this.currentPing = rtt;
        this.onPingChangeCallback?.(rtt);
        return;
      }
      this.onMessageCallback?.(data as PeerMessage);
    });

    conn.on('close', () => cleanup('closed'));
    conn.on('error', (err) => cleanup(`error: ${err?.message || err}`));
  }

  public send(type: MessageType, payload: any) {
    const msg = { type, payload };

    if (type === 'SESSION_INIT') {
      this.lastSessionInit = msg;
      this.currentRevealedPages = [];
      const bufferSize = payload.pdfBuffer?.byteLength || 0;
      this.logEvent('data', `Transmitting SESSION_INIT (PDF payload: ${(bufferSize / 1024 / 1024).toFixed(2)} MB)`);
    } else if (type === 'REVEAL_PAGE') {
      if (payload.isRevealed) {
        this.currentRevealedPages.push(msg);
        this.logEvent('data', `Revealed exhibit: Page ${payload.pageNumber} (${payload.title})`);
      } else {
        this.currentRevealedPages = this.currentRevealedPages.filter(m => m.payload.pageNumber !== payload.pageNumber);
        this.logEvent('data', `Hid exhibit: Page ${payload.pageNumber}`);
      }
    } else if (type === 'TIMER_SYNC') {
      this.lastTimerSync = msg;
    }

    this.connections.forEach(conn => {
      if (conn.open) {
        try {
          conn.send(msg);
        } catch (err: any) {
          this.logEvent('error', `Send failed for ${type}: ${err?.message || err}`);
        }
      }
    });
  }

  public getDiagnostics(): DiagnosticsSnapshot {
    const activeConn = this.connections[0];
    const pc = (activeConn as any)?.peerConnection as RTCPeerConnection | undefined;
    const dc = (activeConn as any)?.dataChannel as RTCDataChannel | undefined;

    return {
      role: this.currentRole,
      peerId: this.peer?.id || null,
      remotePeerIds: this.connections.map(c => c.peer),
      detailedState: this.detailedState,
      iceConnectionState: pc?.iceConnectionState || 'none',
      connectionState: pc?.connectionState || 'none',
      pingMs: this.currentPing,
      localCandidates: Array.from(new Set(this.localCandidates)),
      bufferedAmount: dc?.bufferedAmount || 0,
      events: [...this.diagnosticEvents],
    };
  }

  public getDiagnosticLogText(): string {
    const diag = this.getDiagnostics();
    const dateStr = new Date().toLocaleString();
    const lines = [
      '==========================================',
      '      PROCASE NETWORK DIAGNOSTIC LOG      ',
      '==========================================',
      `Generated: ${dateStr}`,
      `Role: ${diag.role.toUpperCase()}`,
      `Local Peer ID: ${diag.peerId || 'None'}`,
      `Connected Peers: ${diag.remotePeerIds.join(', ') || 'None'}`,
      `Detailed State: ${diag.detailedState}`,
      `ICE Connection State: ${diag.iceConnectionState}`,
      `Peer Connection State: ${diag.connectionState}`,
      `Current Latency (Ping): ${diag.pingMs !== null ? `${diag.pingMs} ms` : 'N/A'}`,
      `DataChannel Buffer: ${(diag.bufferedAmount / 1024).toFixed(1)} KB`,
      `Local ICE Candidates: ${diag.localCandidates.join(', ') || 'None gathered'}`,
      '',
      '--- RECENT TELEMETRY EVENTS ---',
      ...diag.events.map(e => `[${e.timeStr}] [${e.category.toUpperCase()}] ${e.message}`),
      '==========================================',
    ];
    return lines.join('\n');
  }

  public destroy() {
    this.destroyed = true;
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    if (this.disconnectGraceTimer) {
      clearTimeout(this.disconnectGraceTimer);
      this.disconnectGraceTimer = null;
    }
    this.onConnectionChangeCallback = null;
    this.onDetailedStateChangeCallback = null;
    this.onPingChangeCallback = null;
    this.onMessageCallback = null;
    this.onErrorCallback = null;
    this.onOpenCallback = null;
    this.connections.forEach(c => c.close());
    this.connections = [];
    if (this.peer) { this.peer.destroy(); this.peer = null; }
    this.lastSessionInit = null;
    this.currentRevealedPages = [];
    this.lastTimerSync = null;
    this.detailedState = 'idle';
    this.currentPing = null;
    this.localCandidates = [];
    this.logEvent('signaling', 'PeerService destroyed.');
  }
}

export const peerService = new PeerService();
