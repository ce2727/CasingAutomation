import React, { useState, useEffect, useRef } from 'react';
import { libraryService, type CasePackage, type HistoryEntry, type HistoryOutcome } from './services/LibraryService';
import { peerService } from './services/PeerService';
import { pdfService } from './services/PdfService';
import { CaseSlicer } from './components/CaseSlicer';
import { PDFViewer } from './components/PDFViewer';
import { AppLogo } from './components/AppLogo';
import { Play, BookOpen, Share2, Check, Laptop, Users, Loader2, Info, ArrowLeft, RotateCcw, Trash2, Scissors, Download, Pause, ChevronLeft, ChevronRight, Plus, Search, Star, Wrench, Copy, MoreVertical, CheckCircle2, Upload, Clock, FileText, X, History, User, Settings } from 'lucide-react';
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
  joinId: string,
  setJoinId: (id: string) => void,
  userName: string,
  onSettingsClick: () => void
}> = ({ onRoleSelect, joinId, setJoinId, userName, onSettingsClick }) => {
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
        <button className="btn btn-ghost btn-sm" onClick={onSettingsClick} title={`Settings (User: ${userName || 'Not Set'})`} style={{ padding: '0.5rem' }}>
          <Settings size={20} />
        </button>
      </div>
      <div className="hero">
        <div className="brand-wrapper-hero">
          <AppLogo size={100} className="hero-logo" />
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
  const [postCaseeName, setPostCaseeName] = useState('');
  const [peerCaseeName, setPeerCaseeName] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => { const doc = await pdfService.loadDocument(caseFile.pdfBlob, caseFile.id); setTotalPages(doc.numPages); };
    load();
    
    // Generate simple 5-character ID
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No O, I, 0, 1 for readability
    const generatedId = Array.from({ length: 5 }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
    
    peerService.init(generatedId);
    peerService.onOpen(setPeerId);
    peerService.host();
    peerService.onConnectionCountChange(count => {
      setConnectionCount(count);
      if (count > 0) hadPeerRef.current = true;
    });
    peerService.onMessage(msg => {
      if (msg.type === 'PEER_INFO' && msg.payload?.name) {
        caseeNameFromPeerRef.current = msg.payload.name;
        setPostCaseeName(msg.payload.name);
        setPeerCaseeName(msg.payload.name);
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

  const handleExitClick = async () => {
    if (timerActive) setTimerActive(false);
    
    // If we had a peer, automatically save the session before exiting
    if (hadPeerRef.current) {
      peerService.send('SESSION_END', {});
      await libraryService.addHistoryEntry({
        role: 'caser',
        date: Date.now(),
        caseId: caseFile.id,
        caseTitle: caseFile.title,
        casebook: caseFile.source || undefined,
        partnerName: postCaseeName.trim() || peerCaseeName || undefined,
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
const CaseeSession: React.FC<{ initialJoinId: string, userName: string, onBack: () => void }> = ({ initialJoinId, userName, onBack }) => {
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [sessionData, setSessionData] = useState<{ metadata: any, pdfBuffer: ArrayBuffer, caserName?: string } | null>(null);
  const [revealedPages, setRevealedPages] = useState<{ number: number, title: string }[]>([]);
  const [lastRevealedPage, setLastRevealedPage] = useState<number | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [showTimer, setShowTimer] = useState(false);
  const [showPostSession, setShowPostSession] = useState(false);
  const [postRating, setPostRating] = useState(0);
  const hadSessionRef = useRef(false);
  const hasExitedRef = useRef(false);
  const joinIdRef = useRef(initialJoinId);
  const wakeLockRef = useRef<any>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

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
        if (userName) {
          peerService.send('PEER_INFO', { name: userName });
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
        outcome,
      });
    }
    onBack();
  };

  if (showPostSession) {
    return (
      <div className="landing-container">
        <div className="loader-container" style={{ maxWidth: '420px' }}>
          <h2 style={{ marginBottom: '0.25rem' }}>{sessionData?.metadata?.title || 'Session Complete'}</h2>
          {sessionData?.caserName && (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
              with <strong>{sessionData.caserName}</strong>
            </p>
          )}
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.25rem', fontSize: '0.95rem', fontWeight: 600 }}>Difficulty</p>

          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginBottom: '1.5rem' }}>
            {[1, 2, 3, 4, 5].map(s => (
              <button
                key={s}
                onClick={() => setPostRating(postRating === s ? 0 : s)}
                className={`star-btn ${postRating >= s ? getDifficultyClass(postRating) : ''}`}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px' }}
              >
                <Star size={28} fill={s <= postRating ? 'currentColor' : 'none'} className={s <= postRating ? 'star-active' : 'star-muted'} />
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '100%' }}>
            <button className="btn btn-primary" style={{ justifyContent: 'center', padding: '0.875rem' }} onClick={() => handleSaveAndExit('completed')}>
              <CheckCircle2 size={20} /> Completed
            </button>
            <button className="btn btn-secondary" style={{ justifyContent: 'center', padding: '0.875rem' }} onClick={() => handleSaveAndExit('observed')}>
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

const HistoryPage: React.FC<{ onBack: () => void, cases: CasePackage[], onHistoryReset?: () => void }> = ({ onBack, cases, onHistoryReset }) => {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [roleFilter, setRoleFilter] = useState<'all' | 'caser' | 'casee'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [manual, setManual] = useState<Omit<HistoryEntry, 'id'>>(() => ({ ...BLANK_MANUAL, date: Date.now() }));
  const [manualMins, setManualMins] = useState('');

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
                placeholder="Any notes about the session..."
                rows={2}
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

      <header className="session-top-bar">
        <div className="left-section" style={{ gap: '12px' }}>
          <div className="header-brand-group" onClick={onBack}>
            <AppLogo size={32} className="header-logo" />
            <h2 className="brand-name">ProCase</h2>
          </div>
          <div className="header-divider" />
          <button className="btn btn-ghost btn-sm" onClick={onBack}><ArrowLeft size={18} /> Library</button>
        </div>
        <div className="center-section"><h2 className="case-name">Case History</h2></div>
        <div className="right-section" style={{ gap: '0.75rem' }}>
          <button className="btn btn-ghost btn-sm" style={{ color: '#ef4444' }} onClick={handleResetHistory}>
            <RotateCcw size={16} /> Reset History
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

// --- Main App ---
function App() {
  const [role, setRole] = useState<'caser' | 'casee' | null>(null);
  const [view, setView] = useState<'library' | 'history'>('library');
  const [activeCase, setActiveCase] = useState<CasePackage | null>(null);
  const [cases, setCases] = useState<CasePackage[]>([]);
  const [slicingSource, setSlicingSource] = useState<Blob | null>(null);
  const [editingCase, setEditingCase] = useState<CasePackage | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isBulkImporting, setIsBulkImporting] = useState(false);
  const [importJson, setImportJson] = useState('');
  const [bulkCsvText, setBulkCsvText] = useState('');
  const [bulkPdfFile, setBulkPdfFile] = useState<File | null>(null);
  const [importStatus, setImportStatus] = useState('');
  const [joinId, setJoinId] = useState('');
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [showCreateDropdown, setShowCreateDropdown] = useState(false);
  const [historyCase, setHistoryCase] = useState<CasePackage | null>(null);
  const [historyCaseEntries, setHistoryCaseEntries] = useState<HistoryEntry[]>([]);
  const createDropdownRef = useRef<HTMLDivElement>(null);

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
    if (sortBy === 'newest') return (b.id || 0) - (a.id || 0);
    if (sortBy === 'oldest') return (a.id || 0) - (b.id || 0);
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
      if (createDropdownRef.current && !createDropdownRef.current.contains(event.target as Node)) {
        setShowCreateDropdown(false);
      }
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

  const handleReset = async () => { if (window.confirm('Wipe library and all history?')) { await libraryService.clearLibrary(); setCases([]); } };
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

  const handleBulkImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      await libraryService.importData(text);
      const all = await libraryService.getAllCases();
      setCases(all.map(normalizeCase));
      alert('Import successful!');
      e.target.value = '';
    } catch (err) {
      console.error('Import error:', err);
      alert('Import failed. Ensure the file is a valid ProCase JSON.');
    }
  };

  const handleJsonImport = async () => { try { await libraryService.importData(importJson); const all = await libraryService.getAllCases(); setCases(all.map(normalizeCase)); setIsImporting(false); setImportJson(''); } catch (err) { alert('Invalid file.'); } };

  const handleBulkCsvImport = async () => {
    if (!bulkPdfFile || !bulkCsvText) { alert('Please provide both a PDF and CSV text.'); return; }
    setImportStatus('Processing...');
    try {
      await libraryService.importFromCsv(bulkCsvText, bulkPdfFile, (msg) => setImportStatus(msg));
      const all = await libraryService.getAllCases();
      setCases(all.map(normalizeCase));
      setIsBulkImporting(false);
      setBulkCsvText('');
      setBulkPdfFile(null);
      setImportStatus('');
      alert('Bulk import complete!');
    } catch (err) {
      console.error('Bulk import error:', err);
      alert('Bulk import failed. Check CSV format.');
      setImportStatus('');
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { setSlicingSource(file); setShowCreateDropdown(false); }
  };

  // --- Render gates ---
  if (showNameSetup) return <NameSetupModal onSave={handleSaveName} />;
  if (!role) return (
    <>
      <LandingPage 
        onRoleSelect={setRole} 
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
          </div>
        </div>
      )}
    </>
  );
  if (role === 'casee') return (
    <CaseeSession
      initialJoinId={joinId}
      userName={userName}
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
      onComplete={async () => {
        setSlicingSource(null);
        setEditingCase(null);
        const all = await libraryService.getAllCases();
        setCases(all.map(normalizeCase));
      }}
      onCancel={() => { setSlicingSource(null); setEditingCase(null); }}
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
      onBack={() => setView('library')} 
      cases={cases} 
      onHistoryReset={async () => {
        const all = await libraryService.getAllCases();
        setCases(all.map(normalizeCase));
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
          <button className="btn btn-ghost btn-sm" onClick={() => setView('history')} style={{ padding: '0.5rem 1.25rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <History size={18} /> <span style={{ fontWeight: 600 }}>View History</span>
          </button>
          <div className="create-dropdown-wrapper" ref={createDropdownRef}>
            <button className="btn btn-ghost btn-sm" style={{ padding: '0.5rem' }} onClick={(e) => { e.stopPropagation(); setShowCreateDropdown(!showCreateDropdown); }} title="Create or Import">
              <Plus size={20} />
            </button>
            {showCreateDropdown && (
              <div className="dropdown-menu">
                <label className="dropdown-item cursor-pointer">
                  <Scissors size={16} /> Build Case
                  <input type="file" accept=".pdf" style={{ display: 'none' }} onChange={handleFileSelect} />
                </label>
                <button className="dropdown-item" onClick={() => { setIsBulkImporting(true); setShowCreateDropdown(false); }}>
                  <Plus size={16} /> Bulk Import (CSV + PDF)
                </button>
                <div className="dropdown-divider" />
                <button className="dropdown-item" onClick={() => { handleBulkExport(); setShowCreateDropdown(false); }}><Download size={16} /> Bulk Export (.json)</button>
                <label className="dropdown-item cursor-pointer">
                  <Upload size={16} /> Bulk Import (.json)
                  <input type="file" accept=".json" style={{ display: 'none' }} onChange={(e) => { handleBulkImport(e); setShowCreateDropdown(false); }} />
                </label>
                <div className="dropdown-divider" />
                <button className="dropdown-item" onClick={async () => {
                  const csv = await libraryService.exportProgressCsv();
                  const blob = new Blob([csv], { type: 'text/csv' });
                  const a = document.createElement('a');
                  a.href = URL.createObjectURL(blob);
                  a.download = `ProCase_Progress_${new Date().toISOString().split('T')[0]}.csv`;
                  a.click();
                  setShowCreateDropdown(false);
                }}><FileText size={16} /> Export Progress (.csv)</button>
                <div className="dropdown-divider" />
                <button className="dropdown-item text-muted" onClick={() => { handleReset(); setShowCreateDropdown(false); }}><RotateCcw size={16} /> Reset Library</button>
              </div>
            )}
          </div>
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

            {isImporting && (
              <div className="modal">
                <div className="import-form">
                  <h2>Import Case</h2>
                  <textarea value={importJson} onChange={e => setImportJson(e.target.value)} placeholder="Paste JSON here..." rows={8} style={{ width: '100%' }} />
                  <div className="form-actions"><button className="btn btn-ghost" onClick={() => setIsImporting(false)}>Cancel</button><button className="btn btn-primary" onClick={handleJsonImport}>Import</button></div>
                </div>
              </div>
            )}

            {isBulkImporting && (
              <div className="modal">
                <div className="import-form" style={{ maxWidth: '600px' }}>
                  <h2>Bulk CSV Import</h2>
                  <p className="hint-xs" style={{ marginBottom: '1rem' }}>Slices a master PDF into individual cases using a metadata CSV.</p>
                  <div className="form-group" style={{ marginBottom: '1.5rem', textAlign: 'left' }}>
                    <label className="label-sm">1. Select Master Casebook PDF</label>
                    <input type="file" accept=".pdf" onChange={e => setBulkPdfFile(e.target.files?.[0] || null)} style={{ marginTop: '0.5rem' }} />
                  </div>
                  <div className="form-group" style={{ marginBottom: '1.5rem', textAlign: 'left' }}>
                    <label className="label-sm">2. Paste CSV Metadata</label>
                    <textarea
                      value={bulkCsvText}
                      onChange={e => setBulkCsvText(e.target.value)}
                      placeholder="Title, Type, Difficulty, StartPage, EndPage, Tags..."
                      rows={10}
                      style={{ width: '100%', marginTop: '0.5rem', fontFamily: 'monospace', fontSize: '0.8rem' }}
                    />
                  </div>
                  {importStatus && <p className="status-text" style={{ fontSize: '0.85rem', color: 'var(--primary)', marginBottom: '1rem' }}>{importStatus}</p>}
                  <div className="form-actions">
                    <button className="btn btn-ghost" onClick={() => { setIsBulkImporting(false); setImportStatus(''); }}>Cancel</button>
                    <button className="btn btn-primary" onClick={handleBulkCsvImport} disabled={!bulkPdfFile || !bulkCsvText || !!importStatus}>
                      {importStatus ? 'Processing...' : 'Run Bulk Import'}
                    </button>
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
                  <p>{cases.length === 0 ? "Your library is empty. Use the Create menu to begin." : "No cases match your filters."}</p>
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
