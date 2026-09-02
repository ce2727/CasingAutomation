import Dexie, { type EntityTable } from 'dexie';
import { pdfService } from './PdfService';

export interface CasePageMetadata {
  pageIndex: number; // 0-indexed relative to the extracted case PDF
  title: string;
  isExhibit: boolean;
}

export type CaseType = 'M&A' | 'Profitability' | 'Market Entry' | 'Opportunity Assessment' | 'Industry Analysis' | 'Growth Strategy' | 'Pricing' | 'Other';

export type HistoryOutcome = 'given' | 'completed' | 'observed';

export interface HistoryEntry {
  id: string;                  // UUID
  role: 'caser' | 'casee';
  date: number;                // Unix timestamp (ms)
  caseId?: string;             // Links to local CasePackage if present
  caseTitle: string;           // Always stored as fallback display value
  casebook?: string;           // Source casebook name, if known
  partnerName?: string;        // Who you were paired with
  durationSeconds: number;
  notes?: string;
  selfRating?: number;         // 1–5, caser's self-assessment of their delivery
  rating?: number;             // 1–5, casee's rating of their experience
  outcome: HistoryOutcome;     // 'given' for caser, 'completed' | 'observed' for casee
}

export type CaseeOutcome = 'completed' | 'observed' | null;

export interface CasePackage {
  id: string;
  title: string;
  difficulty: number; // 1-5
  caseType: CaseType;
  tags: string[];
  completed: boolean;
  pdfBlob: Blob;
  pages: CasePageMetadata[];
  createdAt: number;
  source?: string;
  sourceYear?: number;
  timesGiven?: number;
  caseeOutcome?: CaseeOutcome;
}

export interface ImportResult {
  total: number;
  replaced: string[];
}

const db = new Dexie('CasingAppDB') as Dexie & {
  cases: EntityTable<CasePackage, 'id'>;
  history: EntityTable<HistoryEntry, 'id'>;
};

// Version history:
// v4: base schema
// v5: added source, sourceYear, sessions
// v6: added timesGiven, caseeOutcome
// v7: replaced sessions[] on CasePackage with separate history table; migrated existing sessions
db.version(7).stores({
  cases: 'id, title, caseType, difficulty, completed, *tags, createdAt',
  history: 'id, role, date, caseId, outcome'
}).upgrade(async tx => {
  // Remove sessions array from cases; migrate any existing sessions to history entries
  const allCases = await tx.table('cases').toArray();
  for (const c of allCases) {
    const sessions: any[] = (c as any).sessions || [];
    for (const s of sessions) {
      const entry: HistoryEntry = {
        id: s.id || crypto.randomUUID(),
        role: 'caser',
        date: s.date,
        caseId: c.id,
        caseTitle: c.title,
        casebook: c.source || undefined,
        durationSeconds: s.durationSeconds,
        notes: s.notes || undefined,
        selfRating: s.selfRating > 0 ? s.selfRating : undefined,
        outcome: 'given',
      };
      await tx.table('history').put(entry);
    }
    // Strip the sessions field off the case record
    const { sessions: _removed, ...cleanCase } = c as any;
    await tx.table('cases').put(cleanCase);
  }
});

db.version(6).stores({
  cases: 'id, title, caseType, difficulty, completed, *tags, createdAt'
}).upgrade(tx => {
  return tx.table('cases').toCollection().modify(c => {
    if (c.timesGiven === undefined) c.timesGiven = 0;
    if (c.caseeOutcome === undefined) c.caseeOutcome = null;
  });
});

db.version(5).stores({
  cases: 'id, title, caseType, difficulty, completed, *tags, createdAt'
}).upgrade(tx => {
  return tx.table('cases').toCollection().modify(c => {
    if (!c.sessions) c.sessions = [];
    if (c.source === undefined) c.source = '';
    if (c.sourceYear === undefined) c.sourceYear = 0;
  });
});

db.version(4).stores({
  cases: 'id, title, caseType, difficulty, completed, *tags, createdAt'
});

export function normalizeCaseTitle(title: string): string {
  return (title || '')
    .trim()
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\s+/g, ' ');
}

export const libraryService = {
  // ── Cases ──────────────────────────────────────────────────────────────────

  async saveCase(casePkg: CasePackage) {
    return await db.cases.put(casePkg);
  },

  async getCaseById(id: string) {
    return await db.cases.get(id);
  },

  async deduplicateLibrary(): Promise<number> {
    const all = await db.cases.toArray();
    const map = new Map<string, CasePackage[]>();
    for (const c of all) {
      const key = normalizeCaseTitle(c.title);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    }

    let removedCount = 0;
    for (const [, cases] of map.entries()) {
      if (cases.length > 1) {
        // Keep the one with highest timesGiven, or most recent createdAt
        cases.sort((a, b) => (b.timesGiven || 0) - (a.timesGiven || 0) || b.createdAt - a.createdAt);
        const keeper = cases[0];
        for (let i = 1; i < cases.length; i++) {
          const dup = cases[i];
          await db.cases.delete(dup.id);
          const orphanHistory = await db.history.where('caseId').equals(dup.id).toArray();
          for (const h of orphanHistory) {
            await db.history.put({ ...h, caseId: keeper.id });
          }
          removedCount++;
        }
      }
    }
    return removedCount;
  },

  async getAllCases() {
    await this.deduplicateLibrary();
    return await db.cases.reverse().sortBy('createdAt');
  },

  async deleteCase(id: string) {
    return await db.cases.delete(id);
  },

  async clearLibrary() {
    await db.cases.clear();
    await db.history.clear();
  },

  async clearHistory() {
    await db.history.clear();
  },

  // ── History ─────────────────────────────────────────────────────────────────

  async addHistoryEntry(entry: Omit<HistoryEntry, 'id'>): Promise<HistoryEntry> {
    const full: HistoryEntry = {
      ...entry,
      id: (crypto.randomUUID && crypto.randomUUID()) || Math.random().toString(36).substring(2),
    };
    await db.history.put(full);

    // Sync side-effects onto the linked CasePackage if it exists
    if (entry.caseId) {
      const casePkg = await this.getCaseById(entry.caseId);
      if (casePkg) {
        const updates: Partial<CasePackage> = {};
        if (entry.role === 'caser') {
          updates.timesGiven = (casePkg.timesGiven || 0) + 1;
          updates.completed = true;
        } else {
          // casee outcome
          updates.caseeOutcome = entry.outcome as CaseeOutcome;
          if (entry.outcome === 'completed') updates.completed = true;
        }
        await this.saveCase({ ...casePkg, ...updates });
      }
    }

    return full;
  },

  async getAllHistory(): Promise<HistoryEntry[]> {
    return await db.history.orderBy('date').reverse().toArray();
  },

  async getHistoryByCaseId(caseId: string): Promise<HistoryEntry[]> {
    return await db.history.where('caseId').equals(caseId).reverse().sortBy('date');
  },

  async deleteHistoryEntry(id: string) {
    return await db.history.delete(id);
  },

  // ── Export / Import ────────────────────────────────────────────────────────

  async exportCasePackage(id: string): Promise<string> {
    const casePkg = await this.getCaseById(id);
    if (!casePkg) throw new Error('Case not found');

    const reader = new FileReader();
    return new Promise((resolve) => {
      reader.onload = () => {
        const base64 = reader.result as string;
        const exportData = {
          ...casePkg,
          pdfBlob: undefined,
          pdfData: base64
        };
        resolve(JSON.stringify(exportData));
      };
      reader.readAsDataURL(casePkg.pdfBlob);
    });
  },

  async exportLibrary(): Promise<string> {
    const all = await db.cases.toArray();
    const exported = await Promise.all(all.map(async c => {
      const reader = new FileReader();
      const base64 = await new Promise<string>(r => {
        reader.onloadend = () => r(reader.result as string);
        reader.readAsDataURL(c.pdfBlob);
      });
      return { ...c, pdfBlob: undefined, pdfData: base64 };
    }));
    return JSON.stringify(exported);
  },

  async importData(jsonStr: string): Promise<ImportResult> {
    const replaced: string[] = [];
    let total = 0;
    try {
      const data = JSON.parse(jsonStr);
      const items = Array.isArray(data) ? data : [data];

      for (const item of items) {
        const rawPdfData = item.pdfData || item.pdfBlob;
        if (!rawPdfData || !item.title) {
          console.warn(`Skipping item "${item.title || 'Unknown'}" - missing PDF data or title.`);
          continue;
        }

        let blob: Blob;
        if (typeof rawPdfData === 'string' && rawPdfData.startsWith('data:')) {
          const resp = await fetch(rawPdfData);
          blob = await resp.blob();
        } else if (rawPdfData instanceof Blob) {
          blob = rawPdfData;
        } else {
          console.warn(`Skipping item "${item.title}" - invalid PDF data format.`);
          continue;
        }

        // Match existing case by name (title) to stomp duplicates
        const targetTitle = item.title.trim();
        const normalizedTarget = normalizeCaseTitle(targetTitle);
        const existingCases = await db.cases
          .filter(c => normalizeCaseTitle(c.title) === normalizedTarget)
          .toArray();

        const primaryCase = existingCases[0];

        let caseId: string;
        if (primaryCase) {
          caseId = primaryCase.id;
          replaced.push(primaryCase.title || targetTitle);
          if (existingCases.length > 1) {
            for (let k = 1; k < existingCases.length; k++) {
              await db.cases.delete(existingCases[k].id);
              const orphanHistory = await db.history.where('caseId').equals(existingCases[k].id).toArray();
              for (const h of orphanHistory) {
                await db.history.put({ ...h, caseId });
              }
            }
          }
        } else if (item.id) {
          const conflict = await this.getCaseById(item.id);
          caseId = conflict ? crypto.randomUUID() : item.id;
        } else {
          caseId = crypto.randomUUID();
        }

        const casePkg: CasePackage = {
          id: caseId,
          title: targetTitle || item.title,
          caseType: item.caseType || (item.industry as CaseType) || 'Other',
          difficulty: Number(item.difficulty) || 1,
          tags: Array.isArray(item.tags) ? item.tags : [],
          completed: !!item.completed,
          pdfBlob: blob,
          pages: item.pages || [],
          createdAt: item.createdAt || Date.now(),
          source: item.source || '',
          sourceYear: item.sourceYear ? Number(item.sourceYear) : 0,
          timesGiven: item.timesGiven ? Number(item.timesGiven) : 0,
          caseeOutcome: item.caseeOutcome || null,
        };

        await this.saveCase(casePkg);
        total++;
      }
      return { total, replaced };
    } catch (err) {
      console.error('Import process failed:', err);
      throw err;
    }
  },

  exportProgressCsv(): Promise<string> {
    return Promise.all([this.getAllCases(), this.getAllHistory()]).then(([allCases, allHistory]) => {
      const rows: string[] = ['Title,Type,Difficulty,Times Given,Times Received,Last Practiced,Completed'];
      for (const c of allCases) {
        const caseHistory = allHistory.filter(h => h.caseId === c.id);
        const givenCount = caseHistory.filter(h => h.role === 'caser').length;
        const receivedCount = caseHistory.filter(h => h.role === 'casee').length;
        const lastDate = caseHistory.length > 0
          ? new Date(Math.max(...caseHistory.map(h => h.date))).toLocaleDateString()
          : '';
        const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
        rows.push([
          escape(c.title),
          escape(c.caseType),
          c.difficulty,
          givenCount,
          receivedCount,
          lastDate,
          c.completed ? 'Yes' : 'No',
        ].join(','));
      }
      return rows.join('\n');
    });
  },

  async exportHistoryCsv(options: {
    received: boolean;
    observed: boolean;
    gave: boolean;
  }): Promise<string> {
    const allHistory = await this.getAllHistory();
    const filtered = allHistory.filter(h => {
      if (h.outcome === 'completed' || (h.role === 'casee' && h.outcome !== 'observed')) {
        return options.received;
      }
      if (h.outcome === 'observed') {
        return options.observed;
      }
      if (h.outcome === 'given' || h.role === 'caser') {
        return options.gave;
      }
      return false;
    });

    // Sort descending by date (most recent sessions first)
    filtered.sort((a, b) => b.date - a.date);

    const escape = (v: any) => {
      if (v === null || v === undefined) return '""';
      const str = String(v).trim();
      return `"${str.replace(/"/g, '""')}"`;
    };

    const header = [
      'Date',
      'Session Type',
      'Case Title',
      'Casebook / Source',
      'Partner Name',
      'Duration (Minutes)',
      'Outcome',
      'Rating',
      'Notes'
    ];

    const rows = [header.join(',')];

    for (const h of filtered) {
      let sessionType = 'Received';
      if (h.outcome === 'observed') sessionType = 'Observed';
      else if (h.outcome === 'given' || h.role === 'caser') sessionType = 'Gave';

      let outcomeText = 'Completed';
      if (h.outcome === 'observed') outcomeText = 'Observed';
      else if (h.outcome === 'given') outcomeText = 'Given';

      const durationMinutes = h.durationSeconds ? Math.round((h.durationSeconds / 60) * 10) / 10 : 0;
      const dateStr = new Date(h.date).toISOString().split('T')[0];
      const ratingVal = h.rating || h.selfRating || '';

      rows.push([
        escape(dateStr),
        escape(sessionType),
        escape(h.caseTitle),
        escape(h.casebook || ''),
        escape(h.partnerName || ''),
        durationMinutes,
        escape(outcomeText),
        ratingVal,
        escape(h.notes || '')
      ].join(','));
    }

    return rows.join('\n');
  },

  async importFromCsv(csvText: string, pdfBlob: Blob, onProgress?: (msg: string) => void): Promise<ImportResult> {
    const replaced: string[] = [];
    let total = 0;
    const lines = csvText.split('\n').filter(l => l.trim());
    if (lines.length === 0) return { total: 0, replaced: [] };

    const header = lines[0].toLowerCase();
    const startIndex = header.includes('title') && header.includes('page') ? 1 : 0;

    const parseCsvLine = (text: string) => {
      const result = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    };

    for (let i = startIndex; i < lines.length; i++) {
      try {
        const parts = parseCsvLine(lines[i]);
        if (parts.length < 5) continue;

        const [title, type, difficulty, startPageStr, endPageStr, tagsStr, pageMetaStr] = parts.map(p => p.replace(/^"|"$/g, '').trim());

        const startPage = parseInt(startPageStr);
        const endPage = parseInt(endPageStr);

        if (isNaN(startPage) || isNaN(endPage)) continue;

        if (onProgress) onProgress(`Processing: ${title}...`);

        const slicedBlob = await pdfService.slicePdf(pdfBlob, startPage, endPage);

        const totalPages = endPage - startPage + 1;
        let pages: CasePageMetadata[] = [];

        if (pageMetaStr) {
          const metaParts = pageMetaStr.split(';').map(m => m.trim()).filter(Boolean);
          pages = metaParts.map((m, idx) => {
            const lastPipe = m.lastIndexOf('|');
            if (lastPipe === -1) return { pageIndex: idx, title: m, isExhibit: false };
            const pTitle = m.substring(0, lastPipe).trim();
            const pIsExhibit = m.substring(lastPipe + 1).trim();
            return {
              pageIndex: idx,
              title: pTitle || `Page ${idx + 1}`,
              isExhibit: pIsExhibit.toLowerCase() === 'true' || pIsExhibit === '1' || pIsExhibit.toLowerCase() === 'y'
            };
          });
          pages = pages.slice(0, totalPages);
          for (let idx = pages.length; idx < totalPages; idx++) {
            pages.push({ pageIndex: idx, title: `Page ${idx + 1}`, isExhibit: false });
          }
        } else {
          pages = Array.from({ length: totalPages }, (_, idx) => ({
            pageIndex: idx,
            title: idx === 0 ? 'Case Overview' : `Exhibit ${idx}`,
            isExhibit: idx > 0
          }));
        }

        const targetTitle = title.trim();
        const normalizedTarget = normalizeCaseTitle(targetTitle);

        // Match existing case by name (title) to stomp duplicates
        const existingCases = await db.cases
          .filter(c => normalizeCaseTitle(c.title) === normalizedTarget)
          .toArray();

        const primaryCase = existingCases[0];
        const caseId = primaryCase?.id || crypto.randomUUID();

        if (primaryCase) {
          replaced.push(primaryCase.title || targetTitle);
        }

        // Clean up any extra duplicates that were already in the library
        if (existingCases.length > 1) {
          for (let k = 1; k < existingCases.length; k++) {
            await db.cases.delete(existingCases[k].id);
            const orphanHistory = await db.history.where('caseId').equals(existingCases[k].id).toArray();
            for (const h of orphanHistory) {
              await db.history.put({ ...h, caseId });
            }
          }
        }

        const casePkg: CasePackage = {
          id: caseId,
          title: targetTitle || title,
          caseType: (type as CaseType) || 'Other',
          difficulty: parseInt(difficulty) || 3,
          tags: tagsStr ? tagsStr.split(';').map(t => t.trim()).filter(Boolean) : [],
          completed: false,
          pdfBlob: slicedBlob,
          pages,
          createdAt: primaryCase?.createdAt || Date.now(),
          source: '',
          sourceYear: 0,
          timesGiven: 0,
          caseeOutcome: null,
        };

        await this.saveCase(casePkg);
        total++;
      } catch (err) {
        console.error(`Error importing row ${i}:`, err);
      }
    }
    return { total, replaced };
  }
};
