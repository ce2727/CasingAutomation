import React, { useState, useEffect, useRef } from 'react';
import { PDFDocument } from 'pdf-lib';
import { pdfService } from '../services/PdfService';
import { PDFViewer } from './PDFViewer';
import { libraryService, type CasePackage, type CasePageMetadata, type CaseType } from '../services/LibraryService';
import { ArrowLeft, Save, ChevronDown, RotateCcw, Share2, Check, Star, X } from 'lucide-react';

interface CaseSlicerProps {
  sourceBlob: Blob;
  existingCase?: CasePackage;
  onComplete: () => void;
  onCancel: () => void;
}

const PRESET_TITLES = [
  'Prompt', 
  'Clarifying Information', 
  'Details', 
  'Exhibit', 
  'Brainstorm', 
  'Question', 
  'Recommendation'
];

const CASE_TYPES: CaseType[] = [
  'M&A', 'Profitability', 'Market Entry', 'Opportunity Assessment', 
  'Industry Analysis', 'Growth Strategy', 'Pricing', 'Other'
];

export const CaseSlicer: React.FC<CaseSlicerProps> = ({ sourceBlob, existingCase, onComplete, onCancel }) => {
  const [phase, setPhase] = useState<'range' | 'config'>(existingCase ? 'config' : 'range');
  const [totalPages, setTotalPages] = useState(0);
  const [title, setTitle] = useState(existingCase?.title || '');
  const [caseType, setCaseType] = useState<CaseType>(existingCase?.caseType || 'Other');
  const [difficulty, setDifficulty] = useState(existingCase?.difficulty || 1);
  const [tags, setTags] = useState<string[]>(existingCase?.tags || []);
  const [tagInput, setTagInput] = useState('');
  const [startPage, setStartPage] = useState<string | number>(1);
  const [endPage, setEndPage] = useState<string | number>(existingCase?.pages.length || 1);
  const [pagesMetadata, setPagesMetadata] = useState<CasePageMetadata[]>(existingCase?.pages || []);
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewPage, setPreviewPage] = useState(1);
  const [pageInputValue, setPageInputValue] = useState('1');
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<number | null>(null);

  // Reset state when source changes (new case or different existing case)
  useEffect(() => {
    setPhase(existingCase ? 'config' : 'range');
    setTitle(existingCase?.title || '');
    setCaseType(existingCase?.caseType || 'Other');
    setDifficulty(existingCase?.difficulty || 1);
    setTags(existingCase?.tags || []);
    setPagesMetadata(existingCase?.pages || []);
    setPreviewPage(1);
    setPageInputValue('1');
    if (!existingCase) {
      setStartPage(1);
      setEndPage(1);
    } else {
      setStartPage(1);
      setEndPage(existingCase.pages.length);
    }
  }, [existingCase, sourceBlob]);
  
  useEffect(() => {
    if (isInputFocused) return;
    if (phase === 'config') {
      setPageInputValue((previewPage - Number(startPage) + 1).toString());
    } else {
      setPageInputValue(previewPage.toString());
    }
  }, [previewPage, phase, startPage, isInputFocused]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const scrollToPage = (pageNum: number) => {
    setPreviewPage(pageNum);
    document.getElementById(`slicer-page-${pageNum}`)?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const load = async () => {
      const doc = await pdfService.loadDocument(sourceBlob, 'slicer-source');
      setTotalPages(doc.numPages);
      if (!existingCase) setEndPage(doc.numPages);
    };
    load();
  }, [sourceBlob, existingCase]);

  const validateAndSetPage = (type: 'start' | 'end', val: string) => {
    if (val === '') {
      if (type === 'start') {
        setStartPage('');
      } else {
        setEndPage('');
      }
      return;
    }
    const num = parseInt(val, 10);
    if (!isNaN(num)) {
      const clamped = Math.min(Math.max(1, num), totalPages);
      if (type === 'start') {
        setStartPage(clamped);
      } else {
        setEndPage(clamped);
      }
    }
  };

  const lockRange = () => {
    const start = Number(startPage) || 1;
    const end = Number(endPage) || totalPages;
    const numPages = end - start + 1;
    if (numPages <= 0) return alert('Invalid range');
    
    setPagesMetadata(prev => {
      // If we already have metadata, we need to adapt it
      if (prev.length > 0) {
        if (numPages > prev.length) {
          // Expand
          const extra = Array.from({ length: numPages - prev.length }, (_, i) => ({
            pageIndex: prev.length + i,
            title: `Page ${prev.length + i + 1}`,
            isExhibit: false
          }));
          return [...prev, ...extra];
        } else {
          // Prune
          return prev.slice(0, numPages);
        }
      } else {
        // Fresh start
        return Array.from({ length: numPages }, (_, i) => ({
          pageIndex: i,
          title: `Page ${i + 1}`,
          isExhibit: false
        }));
      }
    });
    
    setPhase('config');
    setTimeout(() => scrollToPage(start), 100);
  };

  const updatePageMetadata = (index: number, updates: Partial<CasePageMetadata>) => {
    setPagesMetadata(prev => prev.map((p, i) => {
      if (i === index) {
        return { ...p, ...updates };
      }
      return p;
    }));
    setActiveDropdown(null);
  };

  const handleSave = async () => {
    if (!title) return alert('Please enter a case title');
    const start = Number(startPage) || 1;
    const end = Number(endPage) || totalPages;
    setIsProcessing(true);
    try {
      const srcDoc = await PDFDocument.load(await sourceBlob.arrayBuffer());
      const newDoc = await PDFDocument.create();
      const indices = Array.from({ length: end - start + 1 }, (_, i) => start - 1 + i);
      const copiedPages = await newDoc.copyPages(srcDoc, indices);
      copiedPages.forEach(page => newDoc.addPage(page));
      const pdfBytes = await newDoc.save();
      const pdfBlob = new Blob([pdfBytes as any], { type: 'application/pdf' });
      const pkg: CasePackage = {
        id: existingCase?.id || (crypto.randomUUID && crypto.randomUUID()) || Math.random().toString(36).substring(2),
        title,
        caseType,
        difficulty,
        tags,
        completed: existingCase?.completed || false,
        pdfBlob,
        pages: pagesMetadata,
        createdAt: existingCase?.createdAt || Date.now()
      };
      await libraryService.saveCase(pkg);
      pdfService.clearCache();
      onComplete();
    } catch (err) { 
      console.error('Save error:', err);
      alert('Failed to process case.'); 
    }
    setIsProcessing(false);
  };

  return (
    <div className="slicer-container">
      <div className="slicer-sidebar">
        <div className="slicer-header">
          <button className="btn btn-ghost btn-sm" onClick={onCancel}><ArrowLeft size={16} /> Cancel</button>
          <h2>Build Case</h2>
        </div>

        <div className="slicer-form">
          <div className="form-group">
            <label>Case Title</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Solar Strategy" />
          </div>

          <div className="form-row">
            <div className="form-group flex-2">
              <label>Case Type</label>
              <select className="select-input" value={caseType} onChange={e => setCaseType(e.target.value as CaseType)}>
                {CASE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Difficulty</label>
              <div className="star-rating">
                {[1, 2, 3, 4, 5].map(star => (
                  <button 
                    key={star} 
                    className={`star-btn ${difficulty >= star ? 'active' : ''}`}
                    onClick={() => setDifficulty(star)}
                  >
                    <Star size={16} fill={difficulty >= star ? "currentColor" : "none"} />
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="form-group">
            <label>Tags</label>
            <div className="tag-input-wrapper">
              <div className="tags-display">
                {tags.map(t => (
                  <span key={t} className="tag-pill">
                    {t}
                    <button onClick={() => setTags(prev => prev.filter(tag => tag !== t))}><X size={10} /></button>
                  </span>
                ))}
              </div>
              <input 
                type="text" 
                value={tagInput} 
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && tagInput.trim()) {
                    e.preventDefault();
                    if (!tags.includes(tagInput.trim())) setTags(prev => [...prev, tagInput.trim()]);
                    setTagInput('');
                  }
                }}
                placeholder="Add tag and press Enter..." 
              />
            </div>
          </div>

          <div className="form-group">
            <label>Page Range</label>
            <div className={`range-selector-box ${phase === 'config' ? 'locked' : ''}`}>
              <div className="range-selector-compact">
                <div className="range-field">
                  <span className="field-label">From</span>
                  <input 
                    type="text" 
                    className="range-input"
                    disabled={phase === 'config'} 
                    value={startPage} 
                    onChange={e => validateAndSetPage('start', e.target.value)} 
                  />
                </div>
                <div className="range-field">
                  <span className="field-label">To</span>
                  <input 
                    type="text" 
                    className="range-input"
                    disabled={phase === 'config'} 
                    value={endPage} 
                    onChange={e => validateAndSetPage('end', e.target.value)} 
                  />
                </div>
                {phase === 'range' ? (
                  <button className="btn btn-primary btn-icon-range" title="Set Page Range" onClick={lockRange}><Check size={16} /></button>
                ) : (
                  <button className="btn btn-ghost btn-icon-sm" title="Change Range" onClick={() => setPhase('range')}><RotateCcw size={14} /></button>
                )}
              </div>
            </div>
          </div>

          <div className={`pages-config ${phase === 'range' ? 'disabled' : ''}`}>
            <h4>Configure Pages</h4>
            <div className="config-list scrollable">
              {pagesMetadata.map((page, i) => (
                <div key={i} className={`config-item ${previewPage === (Number(startPage) + i) ? 'active' : ''}`} onClick={() => setPreviewPage(Number(startPage) + i)}>
                  <div className="config-row">
                    <div className="hybrid-input-wrapper">
                      <input 
                        type="text" 
                        value={page.title} 
                        onChange={e => updatePageMetadata(i, { title: e.target.value })}
                        placeholder="Page title..."
                        onClick={e => { e.stopPropagation(); setActiveDropdown(i); }}
                      />
                      <button className="btn-dropdown-trigger" onClick={(e) => { e.stopPropagation(); setActiveDropdown(activeDropdown === i ? null : i); }}><ChevronDown size={14} /></button>
                      {activeDropdown === i && (
                        <div ref={dropdownRef} className="custom-dropdown-list">
                          {PRESET_TITLES.map(t => (
                            <div key={t} className="dropdown-opt" onClick={(e) => { e.stopPropagation(); updatePageMetadata(i, { title: t }); }}>{t}</div>
                          ))}
                        </div>
                      )}
                    </div>
                    <button 
                      className={`btn-exhibit-toggle ${page.isExhibit ? 'active' : ''}`} 
                      title="Mark as sharable exhibit"
                      onClick={(e) => { e.stopPropagation(); updatePageMetadata(i, { isExhibit: !page.isExhibit }); }}
                    >
                      <Share2 size={14} />
                      <span>Exhibit</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button className="btn btn-primary btn-block" onClick={handleSave} disabled={isProcessing || phase === 'range'}>
            {isProcessing ? <div className="animate-spin">🌀</div> : <><Save size={18} /> Save Individual Case</>}
          </button>
        </div>
      </div>

      <div className="slicer-preview">
        <div className="preview-nav">
          <button className="btn btn-ghost btn-sm" disabled={previewPage <= (phase === 'config' ? Number(startPage) : 1)} onClick={() => scrollToPage(Math.max(1, previewPage - 1))}>Prev</button>
          
          <div className="preview-page-input">
            {phase === 'config' ? (
              <>
                <span>Case Page</span>
                <input 
                  type="text" 
                  value={pageInputValue} 
                  onFocus={() => setIsInputFocused(true)}
                  onBlur={() => {
                    setIsInputFocused(false);
                    setPageInputValue((previewPage - Number(startPage) + 1).toString());
                  }}
                  onChange={e => {
                    const val = e.target.value;
                    setPageInputValue(val);
                    const num = parseInt(val, 10);
                    if (!isNaN(num)) {
                      const target = Number(startPage) + num - 1;
                      if (target >= Number(startPage) && target <= Number(endPage)) {
                        setPreviewPage(target);
                        document.getElementById(`slicer-page-${target}`)?.scrollIntoView({ behavior: 'smooth' });
                      }
                    }
                  }}
                />
                <span>of {pagesMetadata.length}</span>
              </>
            ) : (
              <>
                <span>Doc Page</span>
                <input 
                  type="text" 
                  value={pageInputValue} 
                  onFocus={() => setIsInputFocused(true)}
                  onBlur={() => {
                    setIsInputFocused(false);
                    setPageInputValue(previewPage.toString());
                  }}
                  onChange={e => {
                    const val = e.target.value;
                    setPageInputValue(val);
                    const num = parseInt(val, 10);
                    if (!isNaN(num)) {
                      if (num >= 1 && num <= totalPages) {
                        setPreviewPage(num);
                        document.getElementById(`slicer-page-${num}`)?.scrollIntoView({ behavior: 'smooth' });
                      }
                    }
                  }}
                />
                <span>of {totalPages}</span>
              </>
            )}
          </div>

          <button className="btn btn-ghost btn-sm" disabled={previewPage >= (phase === 'config' ? Number(endPage) : totalPages)} onClick={() => scrollToPage(Math.min(totalPages, previewPage + 1))}>Next</button>
        </div>
        <div 
          className="preview-scroll-container"
          onScroll={(e) => {
            const scrollPos = e.currentTarget.scrollTop + 150;
            const range = phase === 'config' 
              ? Array.from({ length: Number(endPage) - Number(startPage) + 1 }, (_, i) => Number(startPage) + i)
              : Array.from({ length: totalPages }, (_, i) => i + 1);
            
            for (const p of range) {
              const el = document.getElementById(`slicer-page-${p}`);
              if (el && el.offsetTop <= scrollPos && (el.offsetTop + el.offsetHeight) > scrollPos) {
                if (previewPage !== p) setPreviewPage(p);
                break;
              }
            }
          }}
        >
          <div className="pdf-container-vertical">
            {(phase === 'config' 
              ? Array.from({ length: Number(endPage) - Number(startPage) + 1 }, (_, i) => Number(startPage) + i)
              : Array.from({ length: totalPages }, (_, i) => i + 1)
            ).map(p => (
              <div key={p} id={`slicer-page-${p}`} className="caser-page-wrapper">
                <PDFViewer blob={sourceBlob} pageNumber={p} id="slicer-source" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
