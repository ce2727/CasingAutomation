import React, { useState, useEffect, useRef } from 'react';
import { libraryService, type CasePackage, type HistoryEntry, type HistoryOutcome, type ImportResult } from './services/LibraryService';
import { peerService } from './services/PeerService';
import { pdfService } from './services/PdfService';
import { CaseSlicer } from './components/CaseSlicer';
import { PDFViewer } from './components/PDFViewer';
import { AppLogo } from './components/AppLogo';
import { Play, BookOpen, Share2, Check, Laptop, Users, Loader2, Info, ArrowLeft, RotateCcw, Trash2, Scissors, Download, Pause, ChevronLeft, ChevronRight, ChevronDown, Plus, Search, Star, Wrench, Copy, MoreVertical, CheckCircle2, Upload, Clock, X, History, User, Settings, ArrowRight, FileSpreadsheet } from 'lucide-react';
import './App.css';

// --- Environment Detection ---
const isElectron = /electron/i.test(navigator.userAgent);
const VERCEL_URL = 'https://casingautomation.vercel.app';

// --- User Profile (localStorage, Electron only) ---
const PROFILE_KEY = 'procase_user_name';
const getUserName = () => localStorage.getItem(PROFILE_KEY) || '';
const setUserName = (name: string) => localStorage.setItem(PROFILE_KEY, name.trim());

// --- Helpers ---

const formatTime = (s: number) => {
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const getDifficultyClass = (diff: number) => `diff-${diff}`;

const getDifficultyColor = (diff: number) => {
  switch (diff) {
    case 1: return '#22c55e'; // Green
    case 2: return '#84cc16'; // Lime
    case 3: return '#eab308'; // Yellow
    case 4: return '#f97316'; // Orange
    case 5: return '#ef4444'; // Red
    default: return '#cbd5e1';
  }
};

const getTypeColorClass = (type: string) => {
  switch (type) {
    case 'M&A': return 'm-a';
    case 'Profitability': return 'profitability';
    case 'Market Entry': return 'market-entry';
    case 'Opportunity Assessment': return 'opportunity-assessment';
    case 'Industry Analysis': return 'industry-analysis';
    case 'Growth Strategy': return 'growth-strategy';
    case 'Pricing': return 'pricing';
    default: return 'other';
  }
};

// --- Components ---

const LandingPage: React.FC<{
  onRoleSelect: (role: 'caser' | 'casee') => void,
  onHistoryClick: () => void,
  joinId: string,
  setJoinId: (id: string) => void,
  userName: string,
  onSettingsClick: () => void
}> = ({ onRoleSelect, onHistoryClick, joinId, setJoinId, userName, onSettingsClick }) => {
  const [error, setError] = useState<string | null>(null);

  const validateId = (id: string) => {
    if (!id) return false;
    const cleanId = id.trim().toUpperCase();
    return /^[A-Z0-9]{5}$/.test(cleanId);
  };
  const handleJoinInputChange = (val: string) => {
    setError(null);
    let idToSet = val.trim().toUpperCase();
    try { 
      if (val.includes('?id=')) { 
        const url = new URL(val); 
        const extracted = url.searchParams.get('id'); 
        if (extracted) idToSet = extracted.toUpperCase(); 
      } 
    } catch (e) {}
    setJoinId(idToSet);
    if (idToSet && !validateId(idToSet)) setError('Join ID must be 5 characters');
  };
  const canJoin = validateId(joinId);
  return (
    <div className="landing-container">
      <div style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', display: 'flex', gap: '0.75rem' }}>
        <button className="btn btn-ghost btn-sm" onClick={onSettingsClick} title={`Account Settings (User: ${userName || 'Not Set'})`} style={{ padding: '0.5rem' }}>
          <User size={20} />
        </button>
      </div>
      <div className="hero">
        <div className="brand-wrapper-hero">
          <AppLogo size={64} className="hero-logo" />
          <h1>ProCase</h1>
        </div>
        <p>Professional toolkit for MBA casing preparation.</p>
      </div>
      <div className={`card-selection ${!isElectron ? 'single-card' : ''}`}>
        {isElectron && (
          <div className="card role-card featured">
            <div className="icon-wrapper bg-blue"><Laptop size={32} /></div>
            <h2>Give Case</h2><p>Host a casing session.</p>
            <div className="flex-spacer" />
            <button className="btn btn-primary" onClick={() => onRoleSelect('caser')}>Open Library</button>
          </div>
        )}
        <div className="card role-card featured">
          <div className="icon-wrapper bg-green"><Users size={32} /></div>
          <h2>Join Case</h2><p>Connect to a partner.</p>
          <div className="join-input-group">
            <div className="error-container">{error && <p className="error-text-mini">{error}</p>}</div>
            <input type="text" className={`join-input-home ${error ? 'input-error' : ''}`} placeholder="Enter 5-character ID..." value={joinId} onChange={e => handleJoinInputChange(e.target.value)} onKeyPress={e => e.key === 'Enter' && canJoin && onRoleSelect('casee')} />
            <button className="btn btn-secondary btn-block" onClick={() => onRoleSelect('casee')} disabled={!canJoin}>Join Session</button>
          </div>
        </div>
      </div>

      {isElectron && (
        <button 
          className="main-menu-history-bar"
          onClick={onHistoryClick}
        >
          <div className="history-bar-left">
            <div className="history-bar-icon-wrap">
              <History size={20} />
            </div>
            <div className="history-bar-text">
              <span className="history-bar-title">Case History</span>
              <span className="history-bar-desc">View past practice sessions, notes, and performance</span>
            </div>
          </div>
          <div className="history-bar-right">
            <span>Open</span>
            <ChevronRight size={18} className="history-bar-arrow" />
          </div>
        </button>
      )}
    </div>
  );
};

// --- First-launch name prompt (Electron only) ---
const NameSetupModal: React.FC<{ onSave: (name: string) => void }> = ({ onSave }) => {
  const [name, setName] = useState('');
  return (
    <div className="modal" style={{ background: 'white' }}>
      <div className="import-form" style={{ maxWidth: '400px', gap: '1.25rem' }}>
        <div style={{ textAlign: 'center' }}>
          <AppLogo size={48} style={{ margin: '0 auto 1rem' }} />
          <h2>Welcome to ProCase</h2>
          <p className="hint-xs" style={{ marginTop: '0.5rem' }}>Enter your name so partners know who they're connected to.</p>
        </div>
        <div className="form-group">
          <label className="label-sm">Your Name</label>
          <input
            type="text"
            placeholder="e.g. Alex Johnson"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyPress={e => e.key === 'Enter' && name.trim() && onSave(name)}
            autoFocus
            style={{ padding: '0.6rem 0.75rem', border: '1px solid var(--border)', borderRadius: '0.5rem', fontSize: '0.95rem', width: '100%', boxSizing: 'border-box' }}
          />
        </div>
        <button className="btn btn-primary" style={{ justifyContent: 'center' }} onClick={() => onSave(name)} disabled={!name.trim()}>
          Get Started
        </button>
      </div>
    </div>
  );
};

// --- Caser Session ---
const CaserSession: React.FC<{ caseFile: CasePackage, userName: string, onBack: (updatedCase?: CasePackage) => void }> = ({ caseFile, userName, onBack }) => {
  const [peerId, setPeerId] = useState('');
  const [connectionCount, setConnectionCount] = useState(0);
  const [copied, setCopied] = useState(false);
  const [revealedPages, setRevealedPages] = useState<number[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [timerActive, setTimerActive] = useState(false);
  const startTimeRef = useRef<number | null>(null);
  const accumulatedTimeRef = useRef<number>(0);
  const sessionInitializedRef = useRef(false);
  const hadPeerRef = useRef(false);
  const caseeNameFromPeerRef = useRef<string>('');
  const allSessionUsersRef = useRef<Set<string>>(new Set());
  const activePeersMapRef = useRef<Map<string, string>>(new Map());
  const [peerCaseeName, setPeerCaseeName] = useState<string | null>(null);
  const [connectedNames, setConnectedNames] = useState<string[]>([]);

  useEffect(() => {
    const load = async () => { const doc = await pdfService.loadDocument(caseFile.pdfBlob, caseFile.id); setTotalPages(doc.numPages); };
    load();
    
    // Generate simple 5-character ID
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No O, I, 0, 1 for readability
    const generatedId = Array.from({ length: 5 }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
    
    peerService.init(generatedId);
    peerService.onOpen(setPeerId);
    peerService.host();
    peerService.onConnectionCountChange((count, activePeerIds) => {
      setConnectionCount(count);
      if (count > 0) {
        hadPeerRef.current = true;
      }
      if (activePeerIds) {
        const currentPeerIdSet = new Set(activePeerIds);
        for (const peerId of activePeersMapRef.current.keys()) {
          if (!currentPeerIdSet.has(peerId)) {
            activePeersMapRef.current.delete(peerId);
          }
        }
        const activeNames = Array.from(new Set(Array.from(activePeersMapRef.current.values())));
        setConnectedNames(activeNames);
      } else if (count === 0) {
        activePeersMapRef.current.clear();
        setConnectedNames([]);
      }
    });
    peerService.onMessage(msg => {
      if (msg.type === 'PEER_INFO' && msg.payload?.name) {
        const name = String(msg.payload.name).trim();
        if (name) {
          caseeNameFromPeerRef.current = name;
          setPeerCaseeName(name);
          allSessionUsersRef.current.add(name);
          if (msg.senderPeerId) {
            activePeersMapRef.current.set(msg.senderPeerId, name);
          }
          const activeNames = activePeersMapRef.current.size > 0
            ? Array.from(new Set(Array.from(activePeersMapRef.current.values())))
            : Array.from(allSessionUsersRef.current);
          setConnectedNames(activeNames);
        }
      }
    });
    sessionInitializedRef.current = false;
    return () => peerService.destroy();
  }, [caseFile]);

  useEffect(() => {
    let interval: any = null;
    if (timerActive) {
      startTimeRef.current = Date.now();
      interval = setInterval(() => {
        if (startTimeRef.current) {
          const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
          const total = accumulatedTimeRef.current + elapsed;
          setSeconds(total);
          peerService.send('TIMER_SYNC', { seconds: total, isActive: true });
        }
      }, 500);
    } else {
      if (startTimeRef.current) { accumulatedTimeRef.current += Math.floor((Date.now() - startTimeRef.current) / 1000); startTimeRef.current = null; }
      if (interval) clearInterval(interval);
      peerService.send('TIMER_SYNC', { seconds, isActive: false });
    }
    return () => { if (interval) clearInterval(interval); };
  }, [timerActive]);

  useEffect(() => {
    if (connectionCount > 0 && !sessionInitializedRef.current) {
      caseFile.pdfBlob.arrayBuffer().then(buffer => {
        peerService.send('SESSION_INIT', {
          metadata: caseFile,
          pdfBuffer: buffer,
          revealedExhibits: revealedPages.map(pageNum => ({ number: pageNum, title: caseFile.pages[pageNum - 1].title })),
          caserName: userName,
        });
        sessionInitializedRef.current = true;
      });
    }
  }, [connectionCount, caseFile, userName]);

  const toggleReveal = (pageIndex: number) => {
    const pageNum = pageIndex + 1;
    const pageMetadata = caseFile.pages[pageIndex];
    const isRevealed = revealedPages.includes(pageNum);
    const newRevealed = isRevealed ? revealedPages.filter(p => p !== pageNum) : [...revealedPages, pageNum];
    setRevealedPages(newRevealed);
    peerService.send('REVEAL_PAGE', { pageNumber: pageNum, title: pageMetadata.title, isRevealed: !isRevealed });
  };

  const copyInviteLink = () => {
    navigator.clipboard.writeText(`${VERCEL_URL}/?id=${peerId}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  const resetTimer = () => { startTimeRef.current = null; accumulatedTimeRef.current = 0; setSeconds(0); setTimerActive(false); peerService.send('TIMER_SYNC', { seconds: 0, isActive: false }); };
  const scrollToPage = (pageNum: number) => { setCurrentPage(pageNum); document.getElementById(`caser-page-${pageNum}`)?.scrollIntoView({ behavior: 'smooth' }); };

  const getPartnerString = () => {
    const allUniqueUsers = Array.from(allSessionUsersRef.current);
    return allUniqueUsers.length > 0
      ? allUniqueUsers.join(', ')
      : (connectedNames.length > 0 ? connectedNames.join(', ') : (peerCaseeName || undefined));
  };

  const handleExitClick = async () => {
    if (timerActive) setTimerActive(false);

    // If we had a peer, automatically save the session before exiting
    if (hadPeerRef.current) {
      peerService.send('SESSION_END', {});
      const partnerString = getPartnerString();

      await libraryService.addHistoryEntry({
        role: 'caser',
        date: Date.now(),
        caseId: caseFile.id,
        caseTitle: caseFile.title,
        casebook: caseFile.source || undefined,
        partnerName: partnerString,
        durationSeconds: seconds,
        outcome: 'given',
      });
      const updated = await libraryService.getCaseById(caseFile.id);
      peerService.destroy();
      onBack(updated as CasePackage | undefined);
    } else {
      // No peer, just exit
      peerService.destroy();
      onBack();
    }
  };

  return (
    <div className="session-layout">
      <header className="session-top-bar">
        <div className="left-section" style={{ gap: '12px' }}>
          <div className="header-brand-group" onClick={handleExitClick}>
            <AppLogo size={32} className="header-logo" />
            <h2 className="brand-name">ProCase</h2>
          </div>
          <div className="header-divider" />
          <button className="btn btn-ghost btn-sm" onClick={handleExitClick}><ArrowLeft size={18} /> Exit</button>
        </div>
        <div className="center-section"><h2 className="case-name">{caseFile.title}</h2></div>
        <div className="right-section">
          <div className="timer-section">
            <span className="timer-val">{formatTime(seconds)}</span>
            <div className="timer-actions">
              {!timerActive
                ? <button className="btn btn-begin" onClick={() => setTimerActive(true)}><Play size={14} fill="currentColor" /> Begin</button>
                : <button className="btn btn-pause" onClick={() => setTimerActive(false)}><Pause size={14} fill="currentColor" /> Pause</button>}
              <button className="btn btn-ghost btn-icon-sm" onClick={resetTimer}><RotateCcw size={14} /></button>
            </div>
          </div>
        </div>
      </header>

      <div className="session-container-split">
        <div className="sidebar">
          <div style={{ padding: '0.75rem', background: '#f8fafc', borderRadius: '0.5rem', border: '1px solid var(--border)', marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <p className="label-sm" style={{ marginBottom: '0' }}>Join Code</p>
                <div style={{ fontSize: '1.5rem', fontWeight: 900, letterSpacing: '0.05em', color: '#000', fontFamily: 'JetBrains Mono, monospace' }}>
                  {peerId || '...'}
                </div>
              </div>
              <div className={`status-pill-mini ${connectionCount > 0 ? 'active' : 'waiting'}`} style={{ fontSize: '0.6rem', padding: '0.15rem 0.5rem' }}>
                {connectionCount} Connected
              </div>
            </div>
            <div className="url-box-sm" style={{ marginTop: '0' }}>
              <span style={{ fontSize: '0.65rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', opacity: 0.7 }}>
                {peerId ? `${VERCEL_URL}/?id=${peerId}` : 'Generating...'}
              </span>
              <button
                className="btn-icon-mini"
                onClick={copyInviteLink}
                title="Copy Link"
                style={{ marginLeft: '0.5rem', color: copied ? '#10b981' : '#94a3b8' }}
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </div>
            <div className={`connection-peers-box ${connectionCount > 0 ? 'active' : 'waiting'}`}>
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: connectionCount > 0 ? '#22c55e' : '#cbd5e1',
                  display: 'inline-block',
                  flexShrink: 0
                }}
              />
              <span style={{ fontWeight: 600, fontSize: '0.72rem', whiteSpace: 'nowrap' }}>
                {connectionCount > 0 ? 'Connected:' : 'Waiting:'}
              </span>
              <span style={{ fontSize: '0.75rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {connectionCount > 0
                  ? (connectedNames.length > 0 ? connectedNames.join(', ') : (peerCaseeName || 'Partner'))
                  : 'No partner yet'}
              </span>
            </div>
          </div>
          <div className="exhibit-controls">
            <div className="section-header-compact">
              <h4>Case Flow</h4>
              <div className="compact-page-nav">
                <button className="btn-icon-mini" onClick={() => scrollToPage(Math.max(1, currentPage - 1))} disabled={currentPage === 1}><ChevronLeft size={16} /></button>
                <span className="mini-indicator">{currentPage}/{totalPages}</span>
                <button className="btn-icon-mini" onClick={() => scrollToPage(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages}><ChevronRight size={16} /></button>
              </div>
            </div>
            <div className="page-list scrollable">
              {caseFile.pages?.map((page, i) => (
                <div key={i} className={`page-item-compact ${currentPage === page.pageIndex + 1 ? 'active' : ''}`} onClick={() => scrollToPage(page.pageIndex + 1)}>
                  <div className="page-item-info"><span className="page-title-text">{page.title}</span></div>
                  {page.isExhibit && (
                    <button className={`btn-reveal-action ${revealedPages.includes(page.pageIndex + 1) ? 'active' : ''}`} onClick={(e) => { e.stopPropagation(); toggleReveal(page.pageIndex); }}>
                      {revealedPages.includes(page.pageIndex + 1) ? <Check size={14} /> : <Share2 size={14} />}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="main-content" onScroll={(e) => { const scrollPos = e.currentTarget.scrollTop + 100; caseFile.pages.forEach((_, i) => { const el = document.getElementById(`caser-page-${i + 1}`); if (el && el.offsetTop <= scrollPos) setCurrentPage(i + 1); }); }}>
          <div className="pdf-container-vertical">
            {caseFile.pages.map((_, i) => (
              <div key={i} id={`caser-page-${i + 1}`} className="caser-page-wrapper">
                <PDFViewer key={`${caseFile.id}-${i + 1}`} blob={caseFile.pdfBlob} pageNumber={i + 1} id={caseFile.id} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Casee Session ---
const CaseeSession: React.FC<{
  initialJoinId: string;
  userName: string;
  onBack: () => void;
  onNameUpdate?: (name: string) => void;
}> = ({ initialJoinId, userName: initialUserName, onBack, onNameUpdate }) => {
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [sessionData, setSessionData] = useState<{ metadata: any, pdfBuffer: ArrayBuffer, caserName?: string } | null>(null);
  const [revealedPages, setRevealedPages] = useState<{ number: number, title: string }[]>([]);
  const [lastRevealedPage, setLastRevealedPage] = useState<number | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [showTimer, setShowTimer] = useState(false);
  const [showPostSession, setShowPostSession] = useState(false);
  const [postRating, setPostRating] = useState(0);
  const [postNotes, setPostNotes] = useState('');

  // Casee name management
  const [caseeName, setCaseeName] = useState(() => initialUserName || getUserName() || '');
  const [showNamePrompt, setShowNamePrompt] = useState(() => !initialUserName && !getUserName());
  const [nameInput, setNameInput] = useState('');
  const caseeNameRef = useRef(caseeName);
  caseeNameRef.current = caseeName;

  const hadSessionRef = useRef(false);
  const hasExitedRef = useRef(false);
  const joinIdRef = useRef(initialJoinId);
  const wakeLockRef = useRef<any>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const handleSaveCaseeName = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setUserName(trimmed);
    setCaseeName(trimmed);
    caseeNameRef.current = trimmed;
    if (onNameUpdate) onNameUpdate(trimmed);
    setShowNamePrompt(false);
    peerService.send('PEER_INFO', { name: trimmed });
  };

  // Auto-scroll to latest exhibit
  useEffect(() => {
    if (lastRevealedPage) {
      let attempts = 0;
      const tryScroll = () => {
        const el = document.getElementById(`exhibit-${lastRevealedPage}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          setLastRevealedPage(null);
        } else if (attempts < 10) {
          attempts++;
          setTimeout(tryScroll, 100);
        }
      };
      setTimeout(tryScroll, 100);
    }
  }, [lastRevealedPage]);

  // Wake lock
  useEffect(() => {
    if (status !== 'connected') return;
    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
        }
      } catch (err) {
        console.error('Wake Lock error:', err);
      }
    };
    requestWakeLock();
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !wakeLockRef.current) requestWakeLock();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      wakeLockRef.current?.release().then(() => { wakeLockRef.current = null; });
    };
  }, [status]);

  useEffect(() => {
    peerService.init();
    const timeout = setTimeout(() => {
      if (status !== 'connected') { setStatus('error'); setErrorMessage('Connection timed out. Ensure your partner has started their session.'); }
    }, 20000);

    peerService.onConnectionCountChange(count => {
      if (hasExitedRef.current) return;
      if (count > 0) {
        setStatus('connected');
        clearTimeout(timeout);
        if (caseeNameRef.current) {
          peerService.send('PEER_INFO', { name: caseeNameRef.current });
        }
      } else {
        setStatus('idle');
      }
    });

    peerService.onError(err => { setStatus('error'); setErrorMessage(err === 'peer-unavailable' ? 'Partner not found.' : `Error: ${err}`); clearTimeout(timeout); });

    peerService.onMessage(msg => {
      if (msg.type === 'SESSION_INIT') {
        hadSessionRef.current = true;
        setRevealedPages(msg.payload.revealedExhibits || []);
        setSessionData({ metadata: msg.payload.metadata, pdfBuffer: msg.payload.pdfBuffer, caserName: msg.payload.caserName });
        if (caseeNameRef.current) {
          peerService.send('PEER_INFO', { name: caseeNameRef.current });
        }
      } else if (msg.type === 'REVEAL_PAGE') {
        const { pageNumber, title, isRevealed } = msg.payload;
        if (isRevealed) setLastRevealedPage(pageNumber);
        setRevealedPages(prev => isRevealed ? [...prev, { number: pageNumber, title }] : prev.filter(p => p.number !== pageNumber));
      } else if (msg.type === 'TIMER_SYNC') {
        setSeconds(msg.payload.seconds);
      } else if (msg.type === 'SESSION_END') {
        if (!hasExitedRef.current) {
          hasExitedRef.current = true;
          peerService.destroy();
          if (isElectron) {
            setShowPostSession(true);
          } else {
            onBack();
          }
        }
      }
    });

    if (joinIdRef.current && !hasExitedRef.current) { setStatus('connecting'); peerService.join(joinIdRef.current); }
    return () => { peerService.destroy(); clearTimeout(timeout); };
  }, []);

  const handleExit = () => {
    if (hasExitedRef.current) return;
    hasExitedRef.current = true;
    window.history.replaceState({}, '', window.location.pathname);
    peerService.destroy();
    if (hadSessionRef.current && isElectron) {
      setShowPostSession(true);
    } else {
      onBack();
    }
  };

  const handleForceExit = () => {
    hasExitedRef.current = true;
    window.history.replaceState({}, '', window.location.pathname);
    peerService.destroy();
    onBack();
  };

  // Trigger post-session when caser disconnects mid-session
  useEffect(() => {
    if (status === 'idle' && hadSessionRef.current && !hasExitedRef.current) {
      handleExit();
    }
  }, [status]);

  const handleSaveAndExit = async (outcome: HistoryOutcome) => {
    if (hadSessionRef.current && sessionData) {
      const meta = sessionData.metadata;
      await libraryService.addHistoryEntry({
        role: 'casee',
        date: Date.now(),
        caseId: meta?.id || undefined,
        caseTitle: meta?.title || 'Unknown Case',
        casebook: meta?.source || undefined,
        partnerName: sessionData.caserName || undefined,
        durationSeconds: seconds,
        rating: postRating > 0 ? postRating : undefined,
        notes: postNotes.trim() || undefined,
        outcome,
      });
    }
    onBack();
  };

  if (showNamePrompt) {
    return (
      <div className="landing-container">
        <div className="loader-container" style={{ maxWidth: '400px', textAlign: 'center' }}>
          <div className="icon-wrapper bg-green" style={{ margin: '0 auto 1rem' }}>
            <User size={32} />
          </div>
          <h2 style={{ marginBottom: '0.25rem' }}>Join Casing Session</h2>
          <p className="hint-xs" style={{ marginBottom: '1.5rem' }}>
            Enter your name so your partner knows who they're casing with.
          </p>
          <div className="form-group" style={{ textAlign: 'left', marginBottom: '1.25rem', width: '100%' }}>
            <label className="label-sm">Your Name</label>
            <input
              type="text"
              placeholder="e.g. Alex Johnson"
              value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              onKeyPress={e => e.key === 'Enter' && nameInput.trim() && handleSaveCaseeName(nameInput)}
              autoFocus
              style={{ padding: '0.65rem 0.75rem', border: '1px solid var(--border)', borderRadius: '0.5rem', fontSize: '0.95rem', width: '100%', boxSizing: 'border-box', marginTop: '0.35rem' }}
            />
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', width: '100%' }}>
            <button className="btn btn-ghost" style={{ flex: 1, justifyContent: 'center' }} onClick={handleForceExit}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              style={{ flex: 2, justifyContent: 'center' }}
              onClick={() => handleSaveCaseeName(nameInput)}
              disabled={!nameInput.trim()}
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (showPostSession) {
    return (
      <div className="landing-container">
        <div className="loader-container" style={{ width: '100%', maxWidth: '520px' }}>
          <h2 style={{ marginBottom: '0.35rem', fontSize: '1.65rem' }}>{sessionData?.metadata?.title || 'Session Complete'}</h2>
          {sessionData?.caserName && (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginBottom: '0.75rem' }}>
              with <strong>{sessionData.caserName}</strong>
            </p>
          )}
          <p style={{ color: 'var(--text-muted)', marginBottom: '1rem', fontSize: '0.95rem', fontWeight: 600 }}>Difficulty</p>

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', marginBottom: '1.5rem' }}>
            {[1, 2, 3, 4, 5].map(s => {
              const isFilled = s <= postRating;
              const color = postRating > 0 ? getDifficultyColor(postRating) : '#cbd5e1';
              return (
                <button
                  key={s}
                  onClick={() => setPostRating(postRating === s ? 0 : s)}
                  className={`star-btn ${postRating >= s ? getDifficultyClass(postRating) : ''}`}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: isFilled ? color : '#cbd5e1' }}
                >
                  <Star size={30} fill={isFilled ? color : 'none'} style={{ color: isFilled ? color : '#cbd5e1' }} />
                </button>
              );
            })}
          </div>

          <textarea
            value={postNotes}
            onChange={e => setPostNotes(e.target.value)}
            placeholder="Things that went well, things that didn't go so well, notes for next time..."
            rows={4}
            style={{
              width: '100%',
              padding: '0.85rem 1rem',
              border: '1px solid var(--border)',
              borderRadius: '0.625rem',
              fontSize: '0.9rem',
              lineHeight: 1.5,
              boxSizing: 'border-box',
              fontFamily: 'inherit',
              resize: 'vertical',
              marginBottom: '1.5rem',
            }}
          />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem', width: '100%' }}>
            <button className="btn btn-primary" style={{ justifyContent: 'center', padding: '0.95rem 1.25rem', fontSize: '0.95rem' }} onClick={() => handleSaveAndExit('completed')}>
              <CheckCircle2 size={20} /> Completed
            </button>
            <button className="btn btn-secondary" style={{ justifyContent: 'center', padding: '0.95rem 1.25rem', fontSize: '0.95rem' }} onClick={() => handleSaveAndExit('observed')}>
              <BookOpen size={20} /> Observed
            </button>
            <button className="btn btn-ghost" style={{ justifyContent: 'center', marginTop: '0.25rem' }} onClick={() => onBack()}>
              Skip
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (status !== 'connected' && !hasExitedRef.current) {
    return (
      <div className="landing-container">
        <div className="loader-container">
          {status === 'error' ? (
            <>
              <div className="icon-wrapper" style={{ background: '#fee2e2', color: '#dc2626' }}><Info size={48} /></div>
              <h2>Connection Failed</h2>
              <p className="error-text" style={{ fontSize: '1.1rem', marginBottom: '1.5rem' }}>{errorMessage}</p>
              <button className="btn btn-primary" onClick={handleExit}>Try Again</button>
            </>
          ) : (
            <><Loader2 size={48} className="animate-spin" color="#2563eb" /><h2>Connecting to Partner...</h2></>
          )}
          <button className="btn btn-ghost" style={{ marginTop: '2rem' }} onClick={handleForceExit}>Back to Home</button>
        </div>
      </div>
    );
  }

  return (
    <div className="session-layout">
      <header className="session-top-bar">
        <div className="left-section" style={{ gap: '12px' }}>
          <div className="header-brand-group" onClick={hadSessionRef.current ? handleExit : handleForceExit}>
            <AppLogo size={32} className="header-logo" />
            <h2 className="brand-name">ProCase</h2>
          </div>
          <div className="header-divider" />
          <button className="btn btn-ghost btn-sm" onClick={hadSessionRef.current ? handleExit : handleForceExit}><ArrowLeft size={18} /> Exit</button>
        </div>
        <div className="center-section">
          <h2 className="case-name">{sessionData?.metadata?.title || 'Case Exhibits'}</h2>
        </div>
        <div className="right-section">
          <div className="timer-section interactive" onClick={() => setShowTimer(!showTimer)}>
            <span className="timer-val">{showTimer ? formatTime(seconds) : '--:--'}</span>
          </div>
        </div>
      </header>
      <div className="session-container-split">
        <div className="sidebar">
          <div style={{ padding: '0.75rem', background: '#f8fafc', borderRadius: '0.5rem', border: '1px solid var(--border)', marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <p className="label-sm" style={{ marginBottom: '0' }}>Cased By</p>
                <div style={{ fontSize: '1rem', fontWeight: 700, color: '#000', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {sessionData?.caserName || '...'}
                </div>
              </div>
              <div className={`status-pill-mini ${status === 'connected' ? 'active' : 'waiting'}`} style={{ fontSize: '0.6rem', padding: '0.15rem 0.5rem', flexShrink: 0, marginLeft: '0.5rem' }}>
                {status === 'connected' ? 'Connected' : 'Disconnected'}
              </div>
            </div>
          </div>
          <div className="exhibit-controls">
            <h4 style={{ marginBottom: '1rem' }}>Exhibits</h4>
            <div className="page-list scrollable">
              {revealedPages.sort((a, b) => a.number - b.number).map((p, i) => (
                <div key={i} className="page-item-compact" onClick={() => document.getElementById(`exhibit-${p.number}`)?.scrollIntoView({ behavior: 'smooth' })}>
                  <div className="page-item-info"><span className="page-title-text">{p.title}</span></div>
                </div>
              ))}
              {revealedPages.length === 0 && <p className="hint">Waiting for partner...</p>}
            </div>
          </div>
        </div>
        <div className="main-content-full" ref={scrollContainerRef}>
          <div className="exhibit-grid">
            {revealedPages.length > 0 && sessionData ? (
              revealedPages.sort((a, b) => a.number - b.number).map(p => (
                <div key={p.number} id={`exhibit-${p.number}`} className="exhibit-card-wrapper">
                  <div className="exhibit-label">{p.title}</div>
                  <div className="card exhibit-content">
                    <PDFViewer blob={sessionData.pdfBuffer} pageNumber={p.number} id={sessionData.metadata.id} />
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-state-large">
                {status === 'connected' ? (
                  <>
                    <BookOpen size={64} opacity={0.3} />
                    <div>
                      <p>Exhibits will appear here</p>
                      <span className="hint-xs" style={{ marginTop: '0.5rem', display: 'block' }}>
                        Waiting for {sessionData?.caserName || 'your partner'} to share a page...
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <Loader2 size={64} opacity={0.3} className="animate-spin" />
                    <div>
                      <p>{status === 'connecting' ? 'Connecting to partner...' : 'Waiting to connect'}</p>
                      <span className="hint-xs" style={{ marginTop: '0.5rem', display: 'block' }}>
                        Join ID: <strong>{joinIdRef.current}</strong>
                      </span>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Case History Page ---
const BLANK_MANUAL: Omit<HistoryEntry, 'id'> = {
  role: 'caser',
  date: 0,
  caseTitle: '',
  casebook: '',
  partnerName: '',
  durationSeconds: 0,
  notes: '',
  outcome: 'given',
};

const HistoryPage: React.FC<{ onBack: () => void, backLabel?: string, cases: CasePackage[], onHistoryReset?: () => void }> = ({ onBack, backLabel = 'Library', cases, onHistoryReset }) => {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [roleFilter, setRoleFilter] = useState<'all' | 'caser' | 'casee'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [manual, setManual] = useState<Omit<HistoryEntry, 'id'>>(() => ({ ...BLANK_MANUAL, date: Date.now() }));
  const [manualMins, setManualMins] = useState('');
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportReceived, setExportReceived] = useState(true);
  const [exportObserved, setExportObserved] = useState(true);
  const [exportGave, setExportGave] = useState(false);
  const [editingNoteEntry, setEditingNoteEntry] = useState<HistoryEntry | null>(null);
  const [noteText, setNoteText] = useState('');

  const handleOpenNoteEdit = (entry: HistoryEntry) => {
    setEditingNoteEntry(entry);
    setNoteText(entry.notes || '');
  };

  const handleSaveNote = async () => {
    if (!editingNoteEntry) return;
    const trimmed = noteText.trim();
    await libraryService.updateHistoryEntry(editingNoteEntry.id, { notes: trimmed || undefined });
    setEntries(prev => prev.map(e => e.id === editingNoteEntry.id ? { ...e, notes: trimmed || undefined } : e));
    setEditingNoteEntry(null);
  };

  const handleExportCsv = async () => {
    try {
      const csv = await libraryService.exportHistoryCsv({
        received: exportReceived,
        observed: exportObserved,
        gave: exportGave,
      });
      const dateStr = new Date().toISOString().split('T')[0];
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ProCase_Session_History_${dateStr}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setShowExportModal(false);
    } catch (err) {
      console.error('Failed to export history:', err);
      alert('Failed to generate CSV export.');
    }
  };

  useEffect(() => {
    libraryService.getAllHistory().then(setEntries);
  }, []);

  const reload = () => libraryService.getAllHistory().then(setEntries);

  const handleResetHistory = async () => {
    if (window.confirm('Wipe all session history? Your case library will not be affected.')) {
      await libraryService.clearHistory();
      reload();
      if (onHistoryReset) onHistoryReset();
    }
  };

  const handleSaveManual = async () => {
    if (!manual.caseTitle.trim()) return;
    // Try to match a case in the library by title
    const matched = cases.find(c => c.title.toLowerCase() === manual.caseTitle.trim().toLowerCase());
    await libraryService.addHistoryEntry({
      ...manual,
      caseTitle: manual.caseTitle.trim(),
      caseId: matched?.id,
      casebook: manual.casebook?.trim() || matched?.source || undefined,
      partnerName: manual.partnerName?.trim() || undefined,
      notes: manual.notes?.trim() || undefined,
      durationSeconds: manualMins ? Math.round(parseFloat(manualMins) * 60) : 0,
    });
    setShowManual(false);
    setManual({ ...BLANK_MANUAL, date: Date.now() });
    setManualMins('');
    reload();
  };

  const filtered = entries.filter(e => {
    if (roleFilter !== 'all' && e.role !== roleFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return e.caseTitle.toLowerCase().includes(q) || (e.partnerName || '').toLowerCase().includes(q) || (e.casebook || '').toLowerCase().includes(q);
    }
    return true;
  });

  const outcomeLabel = (outcome: HistoryOutcome) => {
    if (outcome === 'given') return { label: 'Given', bg: '#eff6ff', color: '#2563eb' };
    if (outcome === 'completed') return { label: 'Completed', bg: '#f0fdf4', color: '#16a34a' };
    return { label: 'Observed', bg: '#fefce8', color: '#ca8a04' };
  };

  // Outcome options depend on role
  const outcomeOptions: { value: HistoryOutcome, label: string }[] = manual.role === 'caser'
    ? [{ value: 'given', label: 'Given' }]
    : [{ value: 'completed', label: 'Completed' }, { value: 'observed', label: 'Observed' }];

  return (
    <div className="session-layout">
      {showManual && (
        <div className="modal">
          <div className="import-form" style={{ maxWidth: '440px' }}>
            <h2>Log Session Manually</h2>
            <div className="form-group">
              <label className="label-sm">Role</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {(['caser', 'casee'] as const).map(r => (
                  <button
                    key={r}
                    className={`filter-chip${manual.role === r ? ' active' : ''}`}
                    style={{ flex: 1 }}
                    onClick={() => setManual(m => ({ ...m, role: r, outcome: r === 'caser' ? 'given' : 'completed' }))}
                  >
                    {r === 'caser' ? 'I gave this case' : 'I received this case'}
                  </button>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label className="label-sm">Case Title *</label>
              <input
                type="text"
                placeholder="e.g. Solar Strategy"
                value={manual.caseTitle}
                onChange={e => {
                  const val = e.target.value;
                  const matched = cases.find(c => c.title.toLowerCase() === val.trim().toLowerCase());
                  setManual(m => ({ ...m, caseTitle: val, casebook: matched?.source || m.casebook }));
                }}
                list="case-title-suggestions"
                style={{ padding: '0.6rem 0.75rem', border: '1px solid var(--border)', borderRadius: '0.5rem', fontSize: '0.875rem', width: '100%', boxSizing: 'border-box' }}
              />
              <datalist id="case-title-suggestions">
                {cases.map(c => <option key={c.id} value={c.title} />)}
              </datalist>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="label-sm">Outcome</label>
                <select
                  value={manual.outcome}
                  onChange={e => setManual(m => ({ ...m, outcome: e.target.value as HistoryOutcome }))}
                  style={{ padding: '0.55rem 0.75rem', border: '1px solid var(--border)', borderRadius: '0.5rem', fontSize: '0.875rem', width: '100%', background: 'white' }}
                >
                  {outcomeOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="label-sm">Duration (mins)</label>
                <input
                  type="number"
                  placeholder="e.g. 45"
                  value={manualMins}
                  onChange={e => setManualMins(e.target.value)}
                  min="0"
                  style={{ padding: '0.6rem 0.75rem', border: '1px solid var(--border)', borderRadius: '0.5rem', fontSize: '0.875rem', width: '100%', boxSizing: 'border-box' }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="label-sm">Partner Name</label>
                <input
                  type="text"
                  placeholder={manual.role === 'caser' ? 'Casee name' : 'Caser name'}
                  value={manual.partnerName || ''}
                  onChange={e => setManual(m => ({ ...m, partnerName: e.target.value }))}
                  style={{ padding: '0.6rem 0.75rem', border: '1px solid var(--border)', borderRadius: '0.5rem', fontSize: '0.875rem', width: '100%', boxSizing: 'border-box' }}
                />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="label-sm">Date</label>
                <input
                  type="date"
                  value={new Date(manual.date).toISOString().split('T')[0]}
                  onChange={e => setManual(m => ({ ...m, date: new Date(e.target.value).getTime() }))}
                  style={{ padding: '0.6rem 0.75rem', border: '1px solid var(--border)', borderRadius: '0.5rem', fontSize: '0.875rem', width: '100%', boxSizing: 'border-box' }}
                />
              </div>
            </div>
            <div className="form-group">
              <label className="label-sm">Casebook (optional)</label>
              <input
                type="text"
                placeholder="e.g. Wharton Consulting Club 2024"
                value={manual.casebook || ''}
                onChange={e => setManual(m => ({ ...m, casebook: e.target.value }))}
                style={{ padding: '0.6rem 0.75rem', border: '1px solid var(--border)', borderRadius: '0.5rem', fontSize: '0.875rem', width: '100%', boxSizing: 'border-box' }}
              />
            </div>
            <div className="form-group">
              <label className="label-sm">Notes (optional)</label>
              <textarea
                value={manual.notes || ''}
                onChange={e => setManual(m => ({ ...m, notes: e.target.value }))}
                placeholder="Things that went well, things that didn't go so well, notes for next time..."
                rows={3}
                style={{ width: '100%', marginTop: '0.25rem' }}
              />
            </div>
            <div className="form-actions">
              <button className="btn btn-ghost" onClick={() => setShowManual(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSaveManual} disabled={!manual.caseTitle.trim()}>Save Entry</button>
            </div>
          </div>
        </div>
      )}

      {showExportModal && (
        <div className="modal">
          <div className="import-form" style={{ maxWidth: '440px', gap: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <FileSpreadsheet size={22} style={{ color: 'var(--primary)' }} />
                <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Export Session History</h2>
              </div>
              <button 
                className="btn btn-ghost btn-sm" 
                style={{ padding: '0.25rem', borderRadius: '50%' }} 
                onClick={() => setShowExportModal(false)}
              >
                <X size={18} />
              </button>
            </div>

            <p className="hint-xs" style={{ margin: 0, lineHeight: 1.5 }}>
              Export your casing history to a CSV spreadsheet formatted for consulting club trackers and leadership reporting.
            </p>

            <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '0.75rem', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Filter Sessions to Export:
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', fontSize: '0.95rem' }}>
                <input 
                  type="checkbox" 
                  checked={exportReceived} 
                  onChange={e => setExportReceived(e.target.checked)} 
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <span style={{ fontWeight: 500 }}>Cases Received</span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                  ({entries.filter(e => e.outcome === 'completed' || (e.role === 'casee' && e.outcome !== 'observed')).length} recorded)
                </span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', fontSize: '0.95rem' }}>
                <input 
                  type="checkbox" 
                  checked={exportObserved} 
                  onChange={e => setExportObserved(e.target.checked)} 
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <span style={{ fontWeight: 500 }}>Cases Observed</span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                  ({entries.filter(e => e.outcome === 'observed').length} recorded)
                </span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', fontSize: '0.95rem' }}>
                <input 
                  type="checkbox" 
                  checked={exportGave} 
                  onChange={e => setExportGave(e.target.checked)} 
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <span style={{ fontWeight: 500 }}>Cases Gave</span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                  ({entries.filter(e => e.outcome === 'given' || e.role === 'caser').length} recorded)
                </span>
              </label>
            </div>

            <div style={{ fontSize: '0.825rem', color: '#64748b', lineHeight: 1.5, background: '#f1f5f9', padding: '0.75rem', borderRadius: '0.5rem' }}>
              <div style={{ fontWeight: 600, color: '#334155', marginBottom: '0.25rem' }}>Columns Included in CSV:</div>
              Date, Session Type (Received / Observed / Gave), Case Title, Casebook, Partner Name, Duration (Mins), Outcome, Rating, Notes.
            </div>

            <div className="form-actions">
              <button className="btn btn-ghost" onClick={() => setShowExportModal(false)}>Cancel</button>
              <button 
                className="btn btn-primary" 
                onClick={handleExportCsv}
                disabled={!exportReceived && !exportObserved && !exportGave}
              >
                <Download size={16} /> Download CSV
              </button>
            </div>
          </div>
        </div>
      )}

      {editingNoteEntry && (
        <div className="modal">
          <div className="import-form" style={{ maxWidth: '460px', gap: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Session Notes</h2>
                <p className="hint-xs" style={{ marginTop: '0.25rem', marginBottom: 0 }}>
                  <strong>{editingNoteEntry.caseTitle}</strong>
                  {editingNoteEntry.partnerName && <span> · with {editingNoteEntry.partnerName}</span>}
                  <span> · {new Date(editingNoteEntry.date).toLocaleDateString()}</span>
                </p>
              </div>
              <button 
                className="btn btn-ghost btn-sm" 
                style={{ padding: '0.25rem', borderRadius: '50%' }} 
                onClick={() => setEditingNoteEntry(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="form-group" style={{ width: '100%' }}>
              <label className="label-sm" style={{ fontWeight: 600, color: '#334155' }}>
                Reflections & Performance Notes
              </label>
              <textarea
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
                placeholder="Things that went well, things that didn't go so well, notes for next time..."
                rows={5}
                autoFocus
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid var(--border)',
                  borderRadius: '0.5rem',
                  fontSize: '0.9rem',
                  boxSizing: 'border-box',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                  marginTop: '0.35rem',
                  lineHeight: 1.5,
                }}
              />
            </div>

            <div className="form-actions">
              <button className="btn btn-ghost" onClick={() => setEditingNoteEntry(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSaveNote}>Save Notes</button>
            </div>
          </div>
        </div>
      )}

      <header className="session-top-bar">
        <div className="left-section" style={{ gap: '12px' }}>
          <div className="header-brand-group" onClick={onBack}>
            <AppLogo size={32} className="header-logo" />
            <h2 className="brand-name">ProCase</h2>
          </div>
          <div className="header-divider" />
          <button className="btn btn-ghost btn-sm" onClick={onBack}><ArrowLeft size={18} /> {backLabel}</button>
        </div>
        <div className="center-section"><h2 className="case-name">Case History</h2></div>
        <div className="right-section" style={{ gap: '0.75rem' }}>
          <button className="btn btn-ghost btn-sm" style={{ color: '#ef4444' }} onClick={handleResetHistory}>
            <RotateCcw size={16} /> Reset History
          </button>
          <button 
            className="btn btn-secondary btn-sm" 
            style={{ width: 'auto', padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '6px' }} 
            onClick={() => setShowExportModal(true)}
            title="Export session history to CSV"
          >
            <Download size={16} /> Export History
          </button>
          <button className="btn btn-primary btn-sm" style={{ width: 'auto', padding: '0.5rem 1.25rem' }} onClick={() => { setManual({ ...BLANK_MANUAL, date: Date.now() }); setManualMins(''); setShowManual(true); }}>
            <Plus size={16} /> Log Session
          </button>
        </div>
      </header>

      <div className="session-container-split">
        <div className="sidebar">
          <div className="search-section">
            <p className="label-sm">Search</p>
            <div className="search-input-wrapper">
              <Search size={16} className="search-icon" />
              <input
                type="text"
                className="search-input-sidebar"
                placeholder="Case, partner, casebook..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="filter-group">
            <p className="label-sm">Role</p>
            <div className="filter-options">
              {(['all', 'caser', 'casee'] as const).map(r => (
                <label key={r} className="filter-option">
                  <input type="radio" name="role" checked={roleFilter === r} onChange={() => setRoleFilter(r)} />
                  <span style={{ textTransform: 'capitalize' }}>{r === 'all' ? 'All' : r === 'caser' ? 'Given (Caser)' : 'Received (Casee)'}</span>
                </label>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 'auto', padding: '0.5rem 0' }}>
            <div style={{ padding: '0.75rem', background: 'var(--bg-light)', borderRadius: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="hint-xs">Total sessions</span>
                <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>{entries.length}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="hint-xs">Given</span>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#2563eb' }}>{entries.filter(e => e.role === 'caser').length}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="hint-xs">Received</span>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#16a34a' }}>{entries.filter(e => e.role === 'casee').length}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="main-content">
          <div className="dashboard-toolbar">
            <span className="case-count">{filtered.length} {filtered.length === 1 ? 'entry' : 'entries'}</span>
          </div>
          <div className="dashboard-scroll-area">
            {filtered.length === 0 ? (
              <div className="empty-state-dash">
                <History size={48} opacity={0.3} />
                <p>{entries.length === 0 ? 'No history yet. Complete a session to get started.' : 'No entries match your filters.'}</p>
              </div>
            ) : (
              <div className="history-list">
                {filtered.map(entry => {
                  const oc = outcomeLabel(entry.outcome);
                  return (
                    <div key={entry.id} className="history-row">
                      <div className="history-row-main">
                        <div className="history-row-left">
                          <div className="history-col-status">
                            <span className="history-outcome-pill" style={{ background: oc.bg, color: oc.color }}>{oc.label}</span>
                          </div>
                          <div className="history-col-title">
                            <span className="history-case-title">{entry.caseTitle}</span>
                            {entry.casebook && <span className="history-casebook-text">· {entry.casebook}</span>}
                          </div>
                          <div className="history-col-partner">
                            {entry.partnerName ? (
                              <span className="meta-item-with-icon">
                                <User size={11} /> {entry.partnerName}
                              </span>
                            ) : <span className="text-muted">—</span>}
                          </div>
                          <div className="history-col-duration">
                            {entry.durationSeconds > 0 ? (
                              <span className="meta-item-with-icon">
                                <Clock size={11} /> {formatTime(entry.durationSeconds)}
                              </span>
                            ) : <span className="text-muted">—</span>}
                          </div>
                        </div>
                        <div className="history-row-right">
                          <span className="history-date-text">{new Date(entry.date).toLocaleDateString()}</span>
                        </div>
                      </div>

                      {entry.notes ? (
                        <div className="history-notes-banner" onClick={() => handleOpenNoteEdit(entry)} title="Click to edit notes">
                          <span className="history-notes-label">Notes:</span>
                          <span className="history-notes-text">{entry.notes}</span>
                        </div>
                      ) : (
                        <div className="history-notes-banner history-notes-empty" onClick={() => handleOpenNoteEdit(entry)} title="Add notes for this session">
                          <span className="history-notes-add-hint">+ Add session notes (what went well, areas to improve, next steps...)</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Build Case Hub ---
const BuildCaseHub: React.FC<{
  onBack: () => void;
  onOpenTool: (file: File) => void;
  onOpenBulkCsv: () => void;
  onImportJson: (file: File) => void;
  onExportJson: () => void;
  onResetLibrary?: () => void;
}> = ({ onBack, onOpenTool, onOpenBulkCsv, onImportJson, onExportJson, onResetLibrary }) => {
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);

  const handlePdfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onOpenTool(file);
      e.target.value = '';
    }
  };

  const handleJsonChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImportJson(file);
      e.target.value = '';
    }
  };

  return (
    <div className="session-layout">
      <input
        type="file"
        accept=".pdf"
        ref={pdfInputRef}
        style={{ display: 'none' }}
        onChange={handlePdfChange}
      />
      <input
        type="file"
        accept=".json"
        ref={jsonInputRef}
        style={{ display: 'none' }}
        onChange={handleJsonChange}
      />

      <header className="session-top-bar">
        <div className="left-section" style={{ gap: '12px' }}>
          <div className="header-brand-group" onClick={onBack}>
            <AppLogo size={32} className="header-logo" />
            <h2 className="brand-name">ProCase</h2>
          </div>
          <div className="header-divider" />
          <button className="btn btn-ghost btn-sm" onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <ArrowLeft size={18} /> Library
          </button>
        </div>
        <div className="center-section">
          <h2 className="case-name">Settings</h2>
        </div>
        <div className="right-section">
          <div className="breadcrumb-nav">
            <span className="breadcrumb-muted">Library</span>
            <span>/</span>
            <span className="breadcrumb-active">Settings</span>
          </div>
        </div>
      </header>

      <div className="build-hub-container">
        <div className="build-hub-header">
          <h1 className="build-hub-title">Add & Build Cases</h1>
          <p className="build-hub-subtitle">
            Choose a method below to create or import cases in your local ProCase library.
          </p>
        </div>

        <div className="build-hub-sections">
          {/* Section 1: Import */}
          <div className="build-hub-section-single">
            <h2 className="build-hub-section-title">Import</h2>
            <div className="build-hub-card">
              <div className="build-hub-card-title-row">
                <div className="build-hub-icon-inline purple">
                  <Upload size={22} />
                </div>
                <h3>Case Set</h3>
              </div>
              <p className="build-hub-card-desc">
                Import a pre-built case package from your club. Duplicate cases in your library will be replaced.
              </p>
              <div className="build-hub-card-action">
                <button
                  className="btn btn-purple btn-block"
                  onClick={() => jsonInputRef.current?.click()}
                  style={{ padding: '0.75rem 1rem', justifyContent: 'center' }}
                >
                  <Upload size={18} /> Select .json File
                </button>
              </div>
            </div>
          </div>

          {/* Vertical Divider */}
          <div className="build-hub-vertical-divider" />

          {/* Section 2: Build from PDF */}
          <div className="build-hub-section-duo">
            <h2 className="build-hub-section-title">Build from PDF</h2>
            <div className="build-hub-section-duo-grid">
              {/* Individual */}
              <div className="build-hub-card">
                <div className="build-hub-card-title-row">
                  <div className="build-hub-icon-inline blue">
                    <Scissors size={22} />
                  </div>
                  <h3>Individual</h3>
                </div>
                <p className="build-hub-card-desc">
                  Upload any case or casebook PDF. Interactively preview pages, select start and end page boundaries, configure details (type, difficulty, tags), and designate exhibits.
                </p>
                <div className="build-hub-card-action">
                  <button
                    className="btn btn-primary btn-block"
                    onClick={() => pdfInputRef.current?.click()}
                    style={{ padding: '0.75rem 1rem', justifyContent: 'center' }}
                  >
                    Open Tool <ArrowRight size={18} />
                  </button>
                </div>
              </div>

              {/* Multiple */}
              <div className="build-hub-card">
                <div className="build-hub-card-title-row">
                  <div className="build-hub-icon-inline green">
                    <FileSpreadsheet size={22} />
                  </div>
                  <h3>Multiple</h3>
                </div>
                <p className="build-hub-card-desc">
                  Guided process for importing an entire casebook at once. Provide a master casebook PDF alongside AI-generated data.
                </p>
                <div className="build-hub-card-action">
                  <button
                    className="btn btn-secondary btn-block"
                    onClick={onOpenBulkCsv}
                    style={{ padding: '0.75rem 1rem', justifyContent: 'center' }}
                  >
                    Open Tool <ArrowRight size={18} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Export Section */}
        <div className="build-hub-export-section">
          <h2 className="build-hub-section-title">Export</h2>
          <div className="build-hub-horizontal-divider" />

          <div className="build-hub-export-grid">
            {/* Card 1: Case Set */}
            <div className="build-hub-card">
              <div className="build-hub-card-title-row">
                <div className="build-hub-icon-inline blue">
                  <Download size={22} />
                </div>
                <h3>Case Set</h3>
              </div>
              <p className="build-hub-card-desc">
                Looking to export your entire library as a case set?
              </p>
              <div className="build-hub-card-action">
                <button
                  className="btn btn-primary btn-block"
                  onClick={onExportJson}
                  style={{ padding: '0.75rem 1rem', justifyContent: 'center' }}
                >
                  <Download size={18} /> Export Library
                </button>
              </div>
            </div>

            {/* Card 2: Individual Case Export (No Button) */}
            <div className="build-hub-card">
              <div className="build-hub-card-title-row">
                <div className="build-hub-icon-inline blue">
                  <Share2 size={22} />
                </div>
                <h3>Individual</h3>
              </div>
              <p className="build-hub-card-desc">
                To export an individual case as a standalone package, return to the Library screen, click the options menu (⋮) on any case card, and select <strong>Export Case</strong>.
              </p>
            </div>
          </div>
        </div>

        {/* Reset Library Option */}
        {onResetLibrary && (
          <div className="build-hub-reset-section">
            <div className="build-hub-reset-text">
              <h4>Reset Library</h4>
              <p>Permanently delete all cases and session history from your local library.</p>
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-sm btn-reset-library"
              onClick={onResetLibrary}
            >
              <RotateCcw size={16} /> Reset Library
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// --- Bulk CSV Importer ---
const LLM_METADATA_PROMPT = `Task: Act as a Consulting Case Metadata Specialist. Analyze the provided PDF Casebook content and generate a raw CSV string for bulk import into the ProCase app.

Output Requirement: Output ONLY the raw CSV text. No conversational filler, no markdown blocks, no bolding.

CSV Headers:
Title, Type, Difficulty, StartPage, EndPage, Tags, PageMetadata

Data Standards:
1. Title: Full case name. IMPORTANT: Wrap in double quotes (e.g., "Case Name").
2. Type: Exactly one of: M&A, Profitability, Market Entry, Opportunity Assessment, Industry Analysis, Growth Strategy, Pricing, or Other.
3. Difficulty: Integer 1-5. CRITICAL: Do not cluster all cases at 2-3. Distribute them logically based on the specific casebook's range (e.g., use 1 for the absolute easiest intro cases and 5 for the most complex final-round cases in this book).
4. Page Ranges: The inclusive PDF page numbers.
5. Tags: Semi-colon (;) separated list. Mandatory Tags to include:
   - School: Include "[School Name]" (e.g., "NYU Stern", "Darden", "Kellogg").
   - Market Sizing: Add "Market Sizing" if the case contains a sizing exercise.
   - Industry/Firm: (e.g., "Pharma", "BCG", "Math-Heavy").
   - Note: Do not include "Easy/Medium/Hard" as a tag; the Difficulty score handles this.
6. PageMetadata: Title|IsExhibit;Title|IsExhibit;... (Use 1 for partner-visible exhibits, 0 for interviewer guides/prompts).
   - Standard Names: Use terms like "Prompt", "Clarifying Info", "Exhibit 1: Revenue Chart", "Scoring Guide".

Example Row: “Logistics optimization", Profitability, 4, 12, 14, "Shipping; BCG", "Prompt|0;Exhibit 1: Map|1;Scoring Guide|0”

Format Rule: Wrap any field containing a comma in double quotes.`;

const SAMPLE_CSV = `Title, Type, Difficulty, StartPage, EndPage, Tags, PageMetadata
"Logistics Optimization", Profitability, 4, 12, 14, "Shipping; BCG; Darden", "Prompt|0;Exhibit 1: Map|1;Scoring Guide|0"
"Solar Strategy", Profitability, 4, 1, 10, "Energy; Sustainability; NYU Stern", "Prompt|0;Exhibit A|1;Exhibit B|1"
"Retail Expansion", Market Entry, 3, 11, 18, "Retail; Growth; Kellogg", "Prompt|0;Exhibit 1|1;Scoring Guide|0"`;

const ImportResultModal: React.FC<{
  result: ImportResult;
  onClose: () => void;
}> = ({ result, onClose }) => {
  return (
    <div className="modal" onClick={onClose}>
      <div className="import-form" style={{ maxWidth: '480px', gap: '1.25rem' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{ 
            background: '#dcfce7', 
            color: '#16a34a', 
            borderRadius: '50%', 
            width: 44, 
            height: 44, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <CheckCircle2 size={24} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>Import Complete</h2>
            <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem', color: '#64748b' }}>
              {result.total} {result.total === 1 ? 'case' : 'cases'} processed successfully.
            </p>
          </div>
        </div>

        {result.replaced.length > 0 ? (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Replaced Duplicates ({result.replaced.length})
              </span>
            </div>
            <div style={{ 
              maxHeight: '220px', 
              overflowY: 'auto', 
              border: '1px solid var(--border)', 
              borderRadius: '0.5rem', 
              background: '#f8fafc',
              padding: '0.35rem'
            }}>
              {result.replaced.map((title, idx) => (
                <div 
                  key={idx} 
                  style={{ 
                    padding: '0.45rem 0.65rem', 
                    fontSize: '0.85rem', 
                    fontWeight: 600, 
                    color: '#1e293b', 
                    borderBottom: idx < result.replaced.length - 1 ? '1px solid #e2e8f0' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                >
                  <span style={{ color: '#94a3b8', fontSize: '0.75rem', minWidth: '18px' }}>{idx + 1}.</span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
                </div>
              ))}
            </div>
            <p style={{ margin: '0.5rem 0 0', fontSize: '0.75rem', color: '#94a3b8' }}>
              Existing cases in your library were replaced with the imported content.
            </p>
          </div>
        ) : (
          <p style={{ margin: 0, fontSize: '0.875rem', color: '#64748b' }}>
            No existing duplicate cases were replaced.
          </p>
        )}

        <div className="form-actions" style={{ marginTop: '0.5rem' }}>
          <button className="btn btn-primary btn-block" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

const BulkCsvImporter: React.FC<{
  onBack: () => void;
  onSuccess: () => void;
}> = ({ onBack, onSuccess }) => {
  const [bulkPdfFile, setBulkPdfFile] = useState<File | null>(null);
  const [bulkCsvText, setBulkCsvText] = useState('');
  const [importStatus, setImportStatus] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPromptExpanded, setIsPromptExpanded] = useState(false);
  const [hasCopiedPrompt, setHasCopiedPrompt] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const csvFileInputRef = useRef<HTMLInputElement>(null);

  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(LLM_METADATA_PROMPT);
      setHasCopiedPrompt(true);
      setTimeout(() => setHasCopiedPrompt(false), 2000);
    } catch (err) {
      console.error('Failed to copy prompt', err);
    }
  };

  const handleCsvFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const text = await file.text();
      setBulkCsvText(text);
      e.target.value = '';
    }
  };

  const handleRunImport = async () => {
    if (!bulkPdfFile) {
      alert('Please select a Master Casebook PDF file.');
      return;
    }
    if (!bulkCsvText.trim()) {
      alert('Please provide CSV metadata text or upload a CSV file.');
      return;
    }

    setIsProcessing(true);
    setImportStatus('Starting bulk import...');
    try {
      const result = await libraryService.importFromCsv(bulkCsvText, bulkPdfFile, (msg) => setImportStatus(msg));
      setImportStatus('Import completed successfully!');
      setIsProcessing(false);
      setImportResult(result);
    } catch (err) {
      console.error('Bulk import error:', err);
      alert('Bulk import failed. Please verify that the start and end page numbers match your PDF.');
      setImportStatus('');
      setIsProcessing(false);
    }
  };

  return (
    <div className="session-layout">
      <input
        type="file"
        accept=".pdf"
        ref={pdfInputRef}
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) setBulkPdfFile(file);
        }}
      />
      <input
        type="file"
        accept=".csv"
        ref={csvFileInputRef}
        style={{ display: 'none' }}
        onChange={handleCsvFileUpload}
      />

      <header className="session-top-bar">
        <div className="left-section" style={{ gap: '12px' }}>
          <div className="header-brand-group" onClick={onBack}>
            <AppLogo size={32} className="header-logo" />
            <h2 className="brand-name">ProCase</h2>
          </div>
          <div className="header-divider" />
          <button className="btn btn-ghost btn-sm" onClick={onBack} disabled={isProcessing} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <ArrowLeft size={18} /> Back to Settings
          </button>
        </div>
        <div className="center-section">
          <h2 className="case-name">Bulk Import (CSV + PDF)</h2>
        </div>
        <div className="right-section">
          <div className="breadcrumb-nav">
            <span className="breadcrumb-muted">Library</span>
            <span>/</span>
            <span className="breadcrumb-muted">Settings</span>
            <span>/</span>
            <span className="breadcrumb-active">Bulk Import</span>
          </div>
        </div>
      </header>

      <div className="bulk-csv-container">
        <div className="bulk-header-intro">
          <h1 className="bulk-header-title">Bulk Casebook Importer</h1>
          <p className="bulk-header-subtitle">
            Easily import an entire casebook at once. Simply upload your master casebook PDF alongside AI-generated case metadata (CSV) to automatically slice, categorize, and build each case into your library.
          </p>
        </div>

        {/* Step 1: Select Master PDF */}
        <div className="bulk-step-card">
          <div className="bulk-step-header">
            <div className="step-num-pill">1</div>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>Select Master Casebook PDF</h3>
              <p className="hint-xs" style={{ margin: 0 }}>The multi-page casebook PDF containing all cases to slice.</p>
            </div>
          </div>

          <div
            className={`file-dropzone-box ${bulkPdfFile ? 'has-file' : ''}`}
            onClick={() => !isProcessing && pdfInputRef.current?.click()}
          >
            {bulkPdfFile ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                <CheckCircle2 size={20} color="#16a34a" />
                <span style={{ fontWeight: 700, color: '#166534' }}>{bulkPdfFile.name}</span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  ({(bulkPdfFile.size / (1024 * 1024)).toFixed(1)} MB)
                </span>
                <button
                  className="btn-link-sm"
                  style={{ marginLeft: '1rem', color: '#dc2626' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setBulkPdfFile(null);
                  }}
                >
                  Change
                </button>
              </div>
            ) : (
              <div style={{ color: 'var(--text-muted)' }}>
                <Upload size={28} style={{ margin: '0 auto 0.5rem', display: 'block', opacity: 0.6 }} />
                <span style={{ fontWeight: 600 }}>Click to browse and select master casebook PDF</span>
                <p className="hint-xs" style={{ marginTop: '0.25rem' }}>Supports .pdf</p>
              </div>
            )}
          </div>
        </div>

        {/* Step 2: CSV Metadata */}
        <div className="bulk-step-card">
          <div className="bulk-step-header" style={{ justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div className="step-num-pill">2</div>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>Provide Case Metadata (CSV)</h3>
                <p className="hint-xs" style={{ margin: 0 }}>Map start and end pages, case types, difficulty, and exhibits.</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => csvFileInputRef.current?.click()}
                disabled={isProcessing}
              >
                <Upload size={14} /> Upload .csv
              </button>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setBulkCsvText(SAMPLE_CSV)}
                disabled={isProcessing}
              >
                Insert Sample
              </button>
            </div>
          </div>

          {/* How to generate Metadata */}
          <div className="csv-metadata-guide-box">
            <div className="guide-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '240px' }}>
                <span style={{ fontWeight: 800, fontSize: '0.95rem', color: '#0f172a', display: 'block' }}>How to generate Metadata</span>
                <p style={{ fontSize: '0.83rem', color: 'var(--text-muted)', margin: '0.35rem 0 0 0', lineHeight: 1.45 }}>
                  In order to create Metadata, upload your casebook along with the following prompt to an LLM of your choosing, such as Claude. Then, paste the output below.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexShrink: 0 }}>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={handleCopyPrompt}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '0.45rem 0.75rem' }}
                  title="Copy Prompt to Clipboard"
                >
                  {hasCopiedPrompt ? <Check size={15} color="#16a34a" /> : <Copy size={15} />}
                  <span style={{ fontWeight: 600 }}>{hasCopiedPrompt ? 'Copied Prompt!' : 'Copy Prompt'}</span>
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setIsPromptExpanded(!isPromptExpanded)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '0.45rem 0.75rem' }}
                  title={isPromptExpanded ? 'Collapse Prompt' : 'Expand Prompt'}
                >
                  <span style={{ fontWeight: 600 }}>{isPromptExpanded ? 'Hide Prompt' : 'Expand Prompt'}</span>
                  <ChevronDown size={15} style={{ transform: isPromptExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                </button>
              </div>
            </div>

            {isPromptExpanded && (
              <div className="prompt-preview-container">
                <pre className="prompt-pre-text">{LLM_METADATA_PROMPT}</pre>
              </div>
            )}
          </div>

          <textarea
            value={bulkCsvText}
            onChange={(e) => setBulkCsvText(e.target.value)}
            placeholder="Paste your CSV metadata here or click 'Insert Sample'..."
            rows={8}
            disabled={isProcessing}
            style={{
              width: '100%',
              fontFamily: 'monospace',
              fontSize: '0.82rem',
              padding: '0.75rem',
              border: '1px solid var(--border)',
              borderRadius: '0.5rem',
              boxSizing: 'border-box',
              lineHeight: 1.4,
            }}
          />
        </div>

        {importStatus && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem', color: 'var(--primary)', fontWeight: 600 }}>
            {isProcessing && <Loader2 className="animate-spin" size={18} />}
            <span>{importStatus}</span>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
          <button className="btn btn-ghost" onClick={onBack} disabled={isProcessing}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleRunImport}
            disabled={!bulkPdfFile || !bulkCsvText.trim() || isProcessing}
            style={{ padding: '0.65rem 1.75rem' }}
          >
            {isProcessing ? 'Processing Cases...' : 'Run Bulk Import'}
          </button>
        </div>
      </div>
      {importResult && (
        <ImportResultModal
          result={importResult}
          onClose={() => {
            setImportResult(null);
            onSuccess();
          }}
        />
      )}
    </div>
  );
};

// --- Main App ---
function App() {
  const [role, setRole] = useState<'caser' | 'casee' | null>(null);
  const [view, setView] = useState<'library' | 'history' | 'build-hub' | 'bulk-csv'>('library');
  const [historyOrigin, setHistoryOrigin] = useState<'main-menu' | 'library'>('library');
  const [activeCase, setActiveCase] = useState<CasePackage | null>(null);
  const [cases, setCases] = useState<CasePackage[]>([]);
  const [slicingSource, setSlicingSource] = useState<Blob | null>(null);
  const [editingCase, setEditingCase] = useState<CasePackage | null>(null);
  const [joinId, setJoinId] = useState('');
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [historyCase, setHistoryCase] = useState<CasePackage | null>(null);
  const [historyCaseEntries, setHistoryCaseEntries] = useState<HistoryEntry[]>([]);
  const [importJsonResult, setImportJsonResult] = useState<ImportResult | null>(null);

  // User profile
  const [userName, setUserNameState] = useState(getUserName);
  const [showNameSetup, setShowNameSetup] = useState(isElectron && !getUserName());
  const [showNameEdit, setShowNameEdit] = useState(false);
  const [nameEditValue, setNameEditValue] = useState('');

  // Filtering state
  const [searchQuery, setSearchQuery] = useState('');
  const [tagSearchQuery, setTagSearchQuery] = useState('');
  const [typeFilters, setTypeFilters] = useState<string[]>([]);
  const [difficultyFilters, setDifficultyFilters] = useState<number[]>([]);
  const [tagFilters, setTagFilters] = useState<string[]>([]);
  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'difficulty-asc' | 'difficulty-desc' | 'alphabetical'>('alphabetical');

  const handleSaveName = (name: string) => {
    setUserName(name);
    setUserNameState(name.trim());
    setShowNameSetup(false);
    setShowNameEdit(false);
  };

  const filteredCases = cases.filter(c => {
    if (searchQuery && !c.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (typeFilters.length > 0 && !typeFilters.includes(c.caseType)) return false;
    if (difficultyFilters.length > 0 && !difficultyFilters.includes(c.difficulty)) return false;
    if (tagFilters.length > 0 && !tagFilters.some(t => c.tags.includes(t))) return false;
    
    // Status Filter Logic
    if (statusFilters.length > 0) {
      const isGiven = (c.timesGiven || 0) > 0;
      const isReceived = !!c.caseeOutcome;
      const isUntouched = !isGiven && !isReceived;
      
      const matchGiven = statusFilters.includes('given') && isGiven;
      const matchReceived = statusFilters.includes('received') && isReceived;
      const matchUntouched = statusFilters.includes('untouched') && isUntouched;
      
      if (!matchGiven && !matchReceived && !matchUntouched) return false;
    }

    return true;
  }).sort((a, b) => {
    if (sortBy === 'newest') return (b.createdAt || 0) - (a.createdAt || 0);
    if (sortBy === 'oldest') return (a.createdAt || 0) - (b.createdAt || 0);
    if (sortBy === 'difficulty-asc') return a.difficulty - b.difficulty;
    if (sortBy === 'difficulty-desc') return b.difficulty - a.difficulty;
    if (sortBy === 'alphabetical') return a.title.localeCompare(b.title);
    return 0;
  });

  const allTags = Array.from(new Set(cases.flatMap(c => c.tags))).sort();

  const normalizeCase = (c: any): CasePackage => ({
    ...c,
    title: c.title || 'Untitled Case',
    caseType: c.caseType || c.industry || 'Other',
    difficulty: Number(c.difficulty) || 0,
    tags: Array.isArray(c.tags) ? c.tags : [],
    completed: !!c.completed,
    pages: c.pages || c.exhibits || [],
    source: c.source || '',
    sourceYear: c.sourceYear || 0,
    timesGiven: c.timesGiven || 0,
    caseeOutcome: c.caseeOutcome || null,
  });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!(event.target as HTMLElement).closest('.menu-container')) {
        setActiveMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const all = await libraryService.getAllCases();
        setCases(all.map(normalizeCase));
      } catch (err) {
        console.error('Load error:', err);
        setCases([]);
      }
    };
    load();
    const params = new URLSearchParams(window.location.search);
    const inviteId = params.get('id');
    if (inviteId) { setJoinId(inviteId); setRole('casee'); }
  }, []);

  // Load per-case history when historyCase changes
  useEffect(() => {
    if (historyCase) {
      libraryService.getHistoryByCaseId(historyCase.id).then(setHistoryCaseEntries);
    } else {
      setHistoryCaseEntries([]);
    }
  }, [historyCase]);

  const CASE_TYPES: string[] = ['M&A', 'Profitability', 'Market Entry', 'Opportunity Assessment', 'Industry Analysis', 'Growth Strategy', 'Pricing', 'Other'];

  const handleDelete = async (id: string, e: React.MouseEvent) => { e.stopPropagation(); if (window.confirm('Delete case?')) { await libraryService.deleteCase(id); const all = await libraryService.getAllCases(); setCases(all); } };
  const handleExport = async (id: string) => {
    try {
      const json = await libraryService.exportCasePackage(id);
      const blob = new Blob([json], { type: 'application/json' });
      const a = document.createElement('a');
      const caseTitle = cases.find(c => c.id === id)?.title || 'case';
      a.href = URL.createObjectURL(blob);
      a.download = `${caseTitle.replace(/[^a-z0-9]/gi, '_')}.case.json`;
      a.click();
    } catch (err) { alert('Export failed'); }
  };

  const handleBulkExport = async () => {
    try {
      const json = await libraryService.exportLibrary();
      const blob = new Blob([json], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `ProCase_Library_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
    } catch (err) { alert('Bulk export failed'); }
  };

  const handleImportJsonFile = async (file: File) => {
    try {
      const text = await file.text();
      const result = await libraryService.importData(text);
      const all = await libraryService.getAllCases();
      setCases(all.map(normalizeCase));
      setImportJsonResult(result);
    } catch (err) {
      console.error('Import error:', err);
      alert('Import failed. Ensure the file is a valid ProCase JSON.');
    }
  };

  // --- Render gates ---
  if (showNameSetup) return <NameSetupModal onSave={handleSaveName} />;
  if (!role) return (
    <>
      <LandingPage 
        onRoleSelect={setRole} 
        onHistoryClick={() => {
          setHistoryOrigin('main-menu');
          setRole('caser');
          setView('history');
        }}
        joinId={joinId} 
        setJoinId={setJoinId} 
        userName={userName}
        onSettingsClick={() => { setNameEditValue(userName); setShowNameEdit(true); }}
      />      {showNameEdit && (
        <div className="modal">
          <div className="import-form" style={{ maxWidth: '360px', gap: '1rem' }}>
            <h2>Edit Profile</h2>
            <div className="form-group">
              <label className="label-sm">Your Name</label>
              <input
                type="text"
                value={nameEditValue}
                onChange={e => setNameEditValue(e.target.value)}
                onKeyPress={e => e.key === 'Enter' && nameEditValue.trim() && handleSaveName(nameEditValue)}
                autoFocus
                style={{ padding: '0.6rem 0.75rem', border: '1px solid var(--border)', borderRadius: '0.5rem', fontSize: '0.95rem', width: '100%', boxSizing: 'border-box' }}
              />
            </div>
            <div className="form-actions">
              <button className="btn btn-ghost" onClick={() => setShowNameEdit(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={() => handleSaveName(nameEditValue)} disabled={!nameEditValue.trim()}>Save</button>
            </div>
            {isElectron && (
              <div style={{ paddingTop: '0.75rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                <span className="hint-xs">Desktop App</span>
                <button
                  type="button"
                  className="btn btn-ghost btn-xs"
                  style={{ color: 'var(--primary)', fontWeight: 600 }}
                  onClick={() => {
                    try {
                      const { ipcRenderer } = (window as any).require('electron');
                      ipcRenderer.invoke('check-for-updates');
                    } catch (err) {
                      console.error('Failed to trigger update check:', err);
                    }
                  }}
                >
                  Check for Updates
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
  if (role === 'casee') return (
    <CaseeSession
      initialJoinId={joinId}
      userName={userName}
      onNameUpdate={(name) => setUserNameState(name)}
      onBack={() => {
        setRole(null);
        setJoinId('');
        window.history.replaceState({}, '', window.location.pathname);
      }}
    />
  );
  if (slicingSource || editingCase) return (
    <CaseSlicer
      sourceBlob={slicingSource || editingCase!.pdfBlob}
      existingCase={editingCase || undefined}
      backLabel={editingCase ? 'Back to Library' : 'Back to Build Case'}
      onComplete={async () => {
        setSlicingSource(null);
        setEditingCase(null);
        setView('library');
        const all = await libraryService.getAllCases();
        setCases(all.map(normalizeCase));
      }}
      onCancel={() => {
        setSlicingSource(null);
        if (editingCase) {
          setEditingCase(null);
          setView('library');
        }
      }}
    />
  );
  if (activeCase) return (
    <CaserSession
      caseFile={activeCase}
      userName={userName}
      onBack={(updatedCase) => {
        if (updatedCase) setCases(prev => prev.map(c => c.id === updatedCase.id ? updatedCase : c));
        setActiveCase(null);
        pdfService.clearCache();
      }}
    />
  );

  if (view === 'history') return (
    <HistoryPage 
      onBack={() => {
        if (historyOrigin === 'main-menu') {
          setRole(null);
        }
        setView('library');
      }} 
      backLabel={historyOrigin === 'main-menu' ? 'Menu' : 'Library'}
      cases={cases} 
      onHistoryReset={async () => {
        const all = await libraryService.getAllCases();
        setCases(all.map(normalizeCase));
      }}
    />
  );

  const handleResetLibrary = async () => {
    if (window.confirm('Wipe entire library and all history? This will permanently delete all cases and session records.')) {
      await libraryService.clearLibrary();
      setCases([]);
      setView('library');
    }
  };

  if (view === 'build-hub') return (
    <>
      <BuildCaseHub
        onBack={() => setView('library')}
        onOpenTool={(file) => setSlicingSource(file)}
        onOpenBulkCsv={() => setView('bulk-csv')}
        onImportJson={handleImportJsonFile}
        onExportJson={handleBulkExport}
        onResetLibrary={handleResetLibrary}
      />
      {importJsonResult && (
        <ImportResultModal
          result={importJsonResult}
          onClose={() => {
            setImportJsonResult(null);
            setView('library');
          }}
        />
      )}
    </>
  );

  if (view === 'bulk-csv') return (
    <BulkCsvImporter
      onBack={() => setView('build-hub')}
      onSuccess={async () => {
        const all = await libraryService.getAllCases();
        setCases(all.map(normalizeCase));
        setView('library');
      }}
    />
  );

  // --- Library Dashboard ---
  return (
    <div className="session-layout">
      {/* Name edit modal */}
      {showNameEdit && (
        <div className="modal">
          <div className="import-form" style={{ maxWidth: '360px', gap: '1rem' }}>
            <h2>Edit Profile</h2>
            <div className="form-group">
              <label className="label-sm">Your Name</label>
              <input
                type="text"
                value={nameEditValue}
                onChange={e => setNameEditValue(e.target.value)}
                onKeyPress={e => e.key === 'Enter' && nameEditValue.trim() && handleSaveName(nameEditValue)}
                autoFocus
                style={{ padding: '0.6rem 0.75rem', border: '1px solid var(--border)', borderRadius: '0.5rem', fontSize: '0.95rem', width: '100%', boxSizing: 'border-box' }}
              />
            </div>
            <div className="form-actions">
              <button className="btn btn-ghost" onClick={() => setShowNameEdit(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={() => handleSaveName(nameEditValue)} disabled={!nameEditValue.trim()}>Save</button>
            </div>
            {isElectron && (
              <div style={{ paddingTop: '0.75rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                <span className="hint-xs">Desktop App</span>
                <button
                  type="button"
                  className="btn btn-ghost btn-xs"
                  style={{ color: 'var(--primary)', fontWeight: 600 }}
                  onClick={() => {
                    try {
                      const { ipcRenderer } = (window as any).require('electron');
                      ipcRenderer.invoke('check-for-updates');
                    } catch (err) {
                      console.error('Failed to trigger update check:', err);
                    }
                  }}
                >
                  Check for Updates
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <header className="session-top-bar">
        <div className="left-section" style={{ gap: '12px' }}>
          <div className="header-brand-group" onClick={() => setRole(null)}>
            <AppLogo size={32} className="header-logo" />
            <h2 className="brand-name">ProCase</h2>
          </div>
          <div className="header-divider" />
          <button className="btn btn-ghost btn-sm" onClick={() => setRole(null)}><ArrowLeft size={18} /> Exit</button>
        </div>
        <div className="center-section"><h2 className="case-name">Case Library</h2></div>
        <div className="right-section" style={{ gap: '0.75rem' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => { setHistoryOrigin('library'); setView('history'); }} style={{ padding: '0.5rem 1.25rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <History size={18} /> <span style={{ fontWeight: 600 }}>View History</span>
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setView('build-hub')}
            style={{ padding: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            title="Settings"
          >
            <Settings size={20} />
          </button>
        </div>
      </header>

      <div className="session-container-split">
        <div className="sidebar">
          <div className="search-section">
            <p className="label-sm">Search Cases</p>
            <div className="search-input-wrapper">
              <Search size={16} className="search-icon" />
              <input
                type="text"
                className="search-input-sidebar"
                placeholder="Title search..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="filter-group">
            <p className="label-sm">Case Type</p>
            <div className="filter-options">
              {CASE_TYPES.map(type => (
                <label key={type} className="filter-option">
                  <input
                    type="checkbox"
                    checked={typeFilters.includes(type)}
                    onChange={() => setTypeFilters(prev => prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type])}
                  />
                  <span>{type}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="filter-group">
            <p className="label-sm">Difficulty</p>
            <div className="filter-options">
              {[5, 4, 3, 2, 1].map(stars => (
                <label key={stars} className="filter-option">
                  <input
                    type="checkbox"
                    checked={difficultyFilters.includes(stars)}
                    onChange={() => setDifficultyFilters(prev => prev.includes(stars) ? prev.filter(s => s !== stars) : [...prev, stars])}
                  />
                  <div className={`stars-mini ${getDifficultyClass(stars)}`}>
                    {Array.from({ length: stars }).map((_, i) => <Star key={i} size={10} fill="currentColor" className="star-active" />)}
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="filter-group">
            <p className="label-sm">Status</p>
            <div className="filter-options">
              <label className="filter-option">
                <input
                  type="checkbox"
                  checked={statusFilters.includes('given')}
                  onChange={() => setStatusFilters(prev => prev.includes('given') ? prev.filter(s => s !== 'given') : [...prev, 'given'])}
                />
                <span>Given</span>
              </label>
              <label className="filter-option">
                <input
                  type="checkbox"
                  checked={statusFilters.includes('received')}
                  onChange={() => setStatusFilters(prev => prev.includes('received') ? prev.filter(s => s !== 'received') : [...prev, 'received'])}
                />
                <span>Received</span>
              </label>
              <label className="filter-option">
                <input
                  type="checkbox"
                  checked={statusFilters.includes('untouched')}
                  onChange={() => setStatusFilters(prev => prev.includes('untouched') ? prev.filter(s => s !== 'untouched') : [...prev, 'untouched'])}
                />
                <span>Untouched</span>
              </label>
            </div>
          </div>

          {cases.length > 0 && (
            <div className="filter-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                <p className="label-sm">Tags</p>
                {tagFilters.length > 0 && <button className="btn-link-sm" onClick={() => setTagFilters([])}>Clear</button>}
              </div>
              <div className="search-input-wrapper-mini" style={{ marginBottom: '0.5rem' }}>
                <Search size={12} className="search-icon-mini" />
                <input
                  type="text"
                  className="search-input-mini"
                  placeholder="Filter tags..."
                  value={tagSearchQuery}
                  onChange={e => setTagSearchQuery(e.target.value)}
                />
              </div>
              <div className="filter-options scrollable-tags">
                {allTags
                  .filter(tag => tag.toLowerCase().includes(tagSearchQuery.toLowerCase()))
                  .map(tag => (
                    <label key={tag} className="filter-option">
                      <input
                        type="checkbox"
                        checked={tagFilters.includes(tag)}
                        onChange={() => setTagFilters(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])}
                      />
                      <span className="truncate">{tag}</span>
                    </label>
                  ))}
                {allTags.length === 0 && <p className="hint-xs">No tags yet</p>}
                {allTags.length > 0 && allTags.filter(tag => tag.toLowerCase().includes(tagSearchQuery.toLowerCase())).length === 0 && (
                  <p className="hint-xs">No matching tags</p>
                )}
              </div>
            </div>
          )}

          {(typeFilters.length > 0 || difficultyFilters.length > 0 || tagFilters.length > 0 || searchQuery || statusFilters.length > 0) && (
            <button className="btn btn-ghost btn-sm" style={{ marginTop: '1rem', color: '#ef4444', width: '100%', justifyContent: 'center' }} onClick={() => { setSearchQuery(''); setTagSearchQuery(''); setTypeFilters([]); setDifficultyFilters([]); setTagFilters([]); setStatusFilters([]); }}>
              Clear All Filters
            </button>
          )}
        </div>

        <div className="main-content">
          <div className="dashboard-toolbar">
            <div className="toolbar-info">
              <span className="case-count">{filteredCases.length} {filteredCases.length === 1 ? 'case' : 'cases'} found</span>
            </div>
            <div className="toolbar-actions">
              <div className="sort-group-horizontal">
                <span className="label-xs">Sort by</span>
                <select className="sort-select-mini" value={sortBy} onChange={e => setSortBy(e.target.value as any)}>
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                  <option value="difficulty-asc">Difficulty: Low to High</option>
                  <option value="difficulty-desc">Difficulty: High to Low</option>
                  <option value="alphabetical">Alphabetical (A-Z)</option>
                </select>
              </div>
            </div>
          </div>
          <div className="dashboard-scroll-area">
            {/* Per-case history modal (Statistics Only) */}
            {historyCase && (
              <div className="modal" onClick={() => { setHistoryCase(null); setHistoryCaseEntries([]); }}>
                <div className="import-form" style={{ maxWidth: '440px' }} onClick={e => e.stopPropagation()}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                    <div>
                      <h2 style={{ marginBottom: '0.25rem' }}>{historyCase.title}</h2>
                      <p className="hint-xs">Case Statistics</p>
                    </div>
                    <button className="btn btn-ghost btn-icon-sm" onClick={() => { setHistoryCase(null); setHistoryCaseEntries([]); }}><X size={18} /></button>
                  </div>
                  
                  {historyCaseEntries.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--text-muted)' }}>
                      <Clock size={42} opacity={0.2} style={{ margin: '0 auto 1rem' }} />
                      <p style={{ fontWeight: 600 }}>No history for this case.</p>
                      <p className="hint-xs">Stats appear here once you complete this case as Caser or Casee.</p>
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '1rem', border: '1px solid var(--border)', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Total Sessions</div>
                        <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#0f172a' }}>{historyCaseEntries.length}</div>
                      </div>
                      <div style={{ padding: '1rem', background: '#eff6ff', borderRadius: '1rem', border: '1px solid #dbeafe', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#2563eb', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Times Given</div>
                        <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#1e40af' }}>{historyCaseEntries.filter(e => e.role === 'caser').length}</div>
                      </div>
                      <div style={{ padding: '1rem', background: '#f0fdf4', borderRadius: '1rem', border: '1px solid #dcfce7', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#16a34a', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Times Received</div>
                        <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#166534' }}>{historyCaseEntries.filter(e => e.role === 'casee').length}</div>
                      </div>
                      <div style={{ padding: '1rem', background: '#fffbeb', borderRadius: '1rem', border: '1px solid #fef3c7', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#ca8a04', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Avg. Duration</div>
                        <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#854d0e' }}>
                          {historyCaseEntries.some(e => e.durationSeconds > 0) 
                            ? formatTime(Math.round(historyCaseEntries.filter(e => e.durationSeconds > 0).reduce((s, r) => s + r.durationSeconds, 0) / historyCaseEntries.filter(e => e.durationSeconds > 0).length))
                            : '—'}
                        </div>
                      </div>
                      {historyCaseEntries.some(e => e.durationSeconds > 0) && (
                        <div style={{ gridColumn: 'span 2', padding: '0.75rem 1rem', background: 'white', borderRadius: '0.75rem', border: '1px dashed var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span className="hint-xs" style={{ fontWeight: 600 }}>Fastest Completion</span>
                          <span style={{ fontWeight: 700, color: 'var(--primary)' }}>
                            {formatTime(Math.min(...historyCaseEntries.filter(e => e.durationSeconds > 0).map(e => e.durationSeconds)))}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="form-actions" style={{ marginTop: '1.5rem' }}>
                    <button className="btn btn-primary btn-block" onClick={() => { setHistoryCase(null); setHistoryCaseEntries([]); }}>Close</button>
                  </div>
                </div>
              </div>
            )}
            <div className="case-grid">
              {filteredCases.map(c => {
                const pageCount = c.pages.length;
                return (
                  <div key={c.id} className="card case-card">
                    <div className="case-header-info">
                      <div className={`case-type-badge ${getTypeColorClass(c.caseType)}`}>{c.caseType}</div>
                      <div className={`case-difficulty-stars ${getDifficultyClass(c.difficulty)}`}>
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            size={12}
                            className={star <= c.difficulty ? 'star-active' : 'star-muted'}
                            fill={star <= c.difficulty ? "currentColor" : "none"}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="case-info">
                      <h3>{c.title}</h3>
                      <p>{pageCount} Pages • {new Date(c.createdAt).toLocaleDateString()}</p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.4rem' }}>
                        {c.caseeOutcome === 'completed' && (
                          <span className="tag-pill-mini" style={{ background: '#f0fdf4', color: '#16a34a' }}>
                            <CheckCircle2 size={10} style={{ display: 'inline', marginRight: '3px' }} />
                            Completed
                          </span>
                        )}
                        {c.caseeOutcome === 'observed' && (
                          <span className="tag-pill-mini" style={{ background: '#fefce8', color: '#ca8a04' }}>
                            <BookOpen size={10} style={{ display: 'inline', marginRight: '3px' }} />
                            Observed
                          </span>
                        )}
                      </div>
                      {c.tags && c.tags.length > 0 && (
                        <div className="case-tags-mini">
                          {c.tags.map(t => <span key={t} className="tag-pill-mini">{t}</span>)}
                        </div>
                      )}
                    </div>
                    <div className="case-actions-row">
                      <button className="btn btn-primary btn-grow" onClick={() => setActiveCase(c)}>
                        <Play size={18} /> Start Case
                      </button>
                      <div className="menu-container">
                        <button
                          className="btn btn-ghost btn-icon-sm"
                          onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === c.id ? null : c.id); }}
                        >
                          <MoreVertical size={20} />
                        </button>
                        {activeMenu === c.id && (
                          <div className="card-dropdown-menu">
                            <button className="menu-item" onClick={(e) => { e.stopPropagation(); setHistoryCase(c); setActiveMenu(null); }}>
                              <Clock size={16} /> View History
                            </button>
                            <button className="menu-item" onClick={(e) => { e.stopPropagation(); handleExport(c.id); setActiveMenu(null); }}>
                              <Download size={16} /> Export Case
                            </button>
                            <button className="menu-item" onClick={(e) => { e.stopPropagation(); setEditingCase(c); setActiveMenu(null); }}>
                              <Wrench size={16} /> Edit Case
                            </button>
                            <div className="menu-divider" />
                            <button className="menu-item text-danger" onClick={(e) => { e.stopPropagation(); handleDelete(c.id, e); setActiveMenu(null); }}>
                              <Trash2 size={16} /> Delete Case
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              {filteredCases.length === 0 && (
                <div className="empty-state-dash">
                  <Info size={48} opacity={0.3} />
                  <p>{cases.length === 0 ? "Your library is empty. Click the settings gear (⚙) above to get started." : "No cases match your filters."}</p>
                  {cases.length === 0 && (
                    <button
                      className="btn btn-primary"
                      onClick={() => setView('build-hub')}
                      style={{ width: 'auto', padding: '0.65rem 1.5rem', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                    >
                      <Settings size={16} /> Import & Build Cases
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
