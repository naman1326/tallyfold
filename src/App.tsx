import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { BrowserRouter, Link, NavLink, Route, Routes, useNavigate, useSearchParams } from 'react-router-dom';
import {
  BookOpen, ClipboardCheck, LayoutDashboard, RefreshCw, Settings as Cog, Upload as UpIcon,
  Sun, Moon, Laptop, ArrowUpDown, ArrowUp, ArrowDown, Search, X, Download, Copy, Check,
  CheckCircle2, AlertCircle, AlertTriangle, XCircle, DollarSign, Receipt, Clock, ExternalLink,
  RotateCcw, ChevronLeft, ChevronRight, Eye, ShieldCheck, FileText, Sparkles, LogOut
} from 'lucide-react';
import { blockers, Expense, money, sortExpenses, SortDirection, SortField, toCsv } from './lib';
import * as api from './api';
import { ThemeProvider, useTheme, type Theme } from './theme';
import { ToastProvider, useToast } from './toast';
import { AuthProvider, RequireAuth, useAuth } from './auth';
import { LoginPage } from './LoginPage';

const uid = () => localStorage.getItem('userId') || 'demo-user';
const STATUSES = ['NEEDS_REVIEW', 'PENDING', 'SYNCING', 'SYNCED', 'FAILED'];

function Logo() {
  return (
    <Link to="/" className="brand" aria-label="Tallyfold Home">
      <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true">
        <defs>
          <linearGradient id="tfLogoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--primary)" />
            <stop offset="100%" stopColor="#14b8a6" />
          </linearGradient>
        </defs>
        <rect width="32" height="32" rx="9" fill="url(#tfLogoGrad)" />
        <path d="M9 7h14v18l-3.5-2.5L16 25l-3.5-2.5L9 25z" fill="#fff" />
        <path d="M12.5 14.5l2.5 2.5 4.5-5" stroke="var(--primary)" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span>Tallyfold</span>
    </Link>
  );
}

function ThemeToggleButton() {
  const { theme, setTheme } = useTheme();
  const { info } = useToast();

  const select = (t: Theme) => {
    setTheme(t);
    info(`Theme: ${t.charAt(0).toUpperCase() + t.slice(1)}`);
  };

  return (
    <div className="segmented-theme" role="radiogroup" aria-label="Theme selector">
      <button
        type="button"
        className={`segmented-item ${theme === 'light' ? 'active' : ''}`}
        onClick={() => select('light')}
        title="Light theme"
        aria-label="Light theme"
      >
        <Sun size={15} />
      </button>
      <button
        type="button"
        className={`segmented-item ${theme === 'dark' ? 'active' : ''}`}
        onClick={() => select('dark')}
        title="Dark theme"
        aria-label="Dark theme"
      >
        <Moon size={15} />
      </button>
      <button
        type="button"
        className={`segmented-item ${theme === 'system' ? 'active' : ''}`}
        onClick={() => select('system')}
        title="System default theme"
        aria-label="System default theme"
      >
        <Laptop size={15} />
      </button>
    </div>
  );
}

const Badge = ({ s }: { s: string }) => {
  const clean = s.replace(/[^A-Z_]/g, '');
  return (
    <span className={`badge ${clean}`}>
      {s.replace(/_/g, ' ')}
    </span>
  );
};

function useExpenses() {
  const [rows, setRows] = useState<Expense[]>([]);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    setErr('');
    api.listExpenses(uid())
      .then(setRows)
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { rows, err, loading, load };
}

function State({ x, children }: { x: ReturnType<typeof useExpenses>; children: ReactNode }) {
  if (x.loading) {
    return (
      <div className="skel" aria-busy="true">
        <span>Loading receipt data…</span>
      </div>
    );
  }
  if (x.err) {
    return (
      <div className="err" role="alert">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <AlertCircle size={20} />
          <span>{x.err}</span>
        </div>
        <button onClick={x.load} className="btn-sm">
          <RefreshCw size={14} /> Retry
        </button>
      </div>
    );
  }
  return <>{children}</>;
}

const COLS: Record<string, { label: string; field?: SortField; render: (e: Expense) => ReactNode }> = {
  merchant: {
    label: 'Merchant',
    field: 'merchant',
    render: e => <span style={{ fontWeight: 600 }}>{e.merchant || '—'}</span>
  },
  date: {
    label: 'Date',
    field: 'receiptDate',
    render: e => <span style={{ color: 'var(--text-secondary)' }}>{e.receiptDate || '—'}</span>
  },
  amount: {
    label: 'Amount',
    field: 'total',
    render: e => <span className="amount-cell">{money(e.total, e.currency)}</span>
  },
  category: {
    label: 'Category',
    field: 'category',
    render: e => (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--primary)', opacity: 0.7 }} />
        {e.category || '—'}
      </span>
    )
  },
  conf: {
    label: 'OCR',
    field: 'confidence',
    render: e => {
      if (e.confidence === null) return '—';
      const pct = Math.round(e.confidence * 100);
      const isGood = pct >= 75;
      return (
        <span style={{ color: isGood ? '#10b981' : '#f59e0b', fontWeight: 600 }}>
          {pct}%
        </span>
      );
    }
  },
  pay: {
    label: 'Payment',
    render: e => [e.paymentType, e.paymentAccountId].filter(Boolean).join(' · ') || '—'
  },
  reason: {
    label: 'Review reason',
    render: e => (
      e.reviewReasons.length ? (
        <span style={{ color: '#d97706', fontSize: '0.82rem' }}>
          {e.reviewReasons.join('; ')}
        </span>
      ) : <span style={{ color: 'var(--text-muted)' }}>—</span>
    )
  },
  status: {
    label: 'Status',
    field: 'syncStatus',
    render: e => <Badge s={e.syncStatus} />
  },
  id: {
    label: 'Receipt ID',
    render: e => <code>{e.receiptId ? e.receiptId.slice(0, 8) : '—'}</code>
  },
  qbo: {
    label: 'QBO ID',
    render: e => e.qboId ? <code>{e.qboId}</code> : '—'
  },
  err: {
    label: 'Sync Error',
    render: e => e.syncError ? (
      <span style={{ color: '#ef4444', fontSize: '0.82rem' }}>{e.syncError}</span>
    ) : '—'
  },
};

function List({
  rows,
  cols,
  onOpen,
  status = '',
  statuses = STATUSES,
  csv = false
}: {
  rows: Expense[];
  cols: string[];
  onOpen: (e: Expense) => void;
  status?: string;
  statuses?: string[];
  csv?: boolean;
}) {
  const [q, setQ] = useState('');
  const [st, setSt] = useState(status);
  const [cat, setCat] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(0);
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDir, setSortDir] = useState<SortDirection>('desc');

  const { success } = useToast();

  const cats = useMemo(() => [...new Set(rows.map(r => r.category).filter(Boolean))], [rows]);

  // Handle column sorting
  const handleSort = (field?: SortField) => {
    if (!field) return;
    if (sortField === field) {
      if (sortDir === 'desc') setSortDir('asc');
      else {
        setSortField(null);
        setSortDir('desc');
      }
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const filtered = useMemo(() => {
    let result = rows.filter(r => {
      const matchQuery = !q || (r.merchant + ' ' + r.receiptId + ' ' + (r.qboId || '')).toLowerCase().includes(q.toLowerCase());
      const matchStatus = !st || r.syncStatus === st;
      const matchCat = !cat || r.category === cat;
      const matchFrom = !from || r.receiptDate >= from;
      const matchTo = !to || r.receiptDate <= to;
      return matchQuery && matchStatus && matchCat && matchFrom && matchTo;
    });

    if (sortField) {
      result = sortExpenses(result, sortField, sortDir);
    } else {
      // Default: sort by date descending
      result = [...result].sort((a, b) => b.receiptDate.localeCompare(a.receiptDate));
    }

    return result;
  }, [rows, q, st, cat, from, to, sortField, sortDir]);

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pages - 1);
  const pagedRows = filtered.slice(currentPage * pageSize, currentPage * pageSize + pageSize);

  const hasActiveFilters = Boolean(q || (status ? st !== status : st) || cat || from || to);

  const resetFilters = () => {
    setQ('');
    setSt(status || '');
    setCat('');
    setFrom('');
    setTo('');
    setPage(0);
  };

  const exp = () => {
    const csvContent = toCsv(filtered);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tallyfold-expenses-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    success(`Exported ${filtered.length} receipts to CSV`);
  };

  return (
    <>
      <div className="filter-card">
        <div className="filters">
          <div className="search-box">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              aria-label="Search receipts"
              placeholder="Search merchant, receipt ID, QBO ID…"
              value={q}
              onChange={e => { setQ(e.target.value); setPage(0); }}
            />
            {q && (
              <button className="search-clear" onClick={() => setQ('')} aria-label="Clear search">
                <X size={14} />
              </button>
            )}
          </div>

          <select
            aria-label="Filter by Status"
            value={st}
            onChange={e => { setSt(e.target.value); setPage(0); }}
          >
            <option value="">All statuses ({rows.length})</option>
            {statuses.map(s => {
              const count = rows.filter(r => r.syncStatus === s).length;
              return <option key={s} value={s}>{s.replace(/_/g, ' ')} ({count})</option>;
            })}
          </select>

          <select
            aria-label="Filter by Category"
            value={cat}
            onChange={e => { setCat(e.target.value); setPage(0); }}
          >
            <option value="">All categories ({cats.length})</option>
            {cats.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          <input
            type="date"
            aria-label="From date"
            title="From date"
            value={from}
            onChange={e => { setFrom(e.target.value); setPage(0); }}
          />
          <input
            type="date"
            aria-label="To date"
            title="To date"
            value={to}
            onChange={e => { setTo(e.target.value); setPage(0); }}
          />

          {hasActiveFilters && (
            <button className="btn-outline btn-sm" onClick={resetFilters}>
              <RotateCcw size={14} /> Reset
            </button>
          )}

          {csv && (
            <button className="primary" onClick={exp} style={{ marginLeft: 'auto' }}>
              <Download size={14} /> Export CSV ({filtered.length})
            </button>
          )}
        </div>

        {/* Quick status filter pills */}
        <div className="filter-chips">
          <button
            className={`chip ${!st ? 'active' : ''}`}
            onClick={() => { setSt(''); setPage(0); }}
          >
            All ({rows.length})
          </button>
          {statuses.map(s => {
            const count = rows.filter(r => r.syncStatus === s).length;
            if (count === 0 && st !== s) return null;
            return (
              <button
                key={s}
                className={`chip ${st === s ? 'active' : ''}`}
                onClick={() => { setSt(st === s ? '' : s); setPage(0); }}
              >
                <span>{s.replace(/_/g, ' ')}</span>
                <b style={{ opacity: 0.8 }}>({count})</b>
              </button>
            );
          })}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="empty">
          <Receipt className="empty-icon" />
          <b>No receipts found.</b>
          <p style={{ marginTop: '0.4rem', color: 'var(--text-muted)' }}>
            Try adjusting your search terms or active filters.
          </p>
          {hasActiveFilters && (
            <button className="btn-secondary btn-sm" onClick={resetFilters} style={{ marginTop: '0.75rem' }}>
              Reset filters
            </button>
          )}
        </div>
      ) : (
        <div className="scroll">
          <table>
            <thead>
              <tr>
                {cols.map(c => {
                  const colDef = COLS[c];
                  const isSortable = !!colDef.field;
                  const isSorted = sortField === colDef.field;
                  return (
                    <th
                      key={c}
                      className={isSortable ? `sortable ${isSorted ? 'active' : ''}` : ''}
                      onClick={() => handleSort(colDef.field)}
                      title={isSortable ? `Sort by ${colDef.label}` : undefined}
                    >
                      <div className="th-content">
                        <span>{colDef.label}</span>
                        {isSortable && (
                          <span className="sort-icon">
                            {isSorted ? (
                              sortDir === 'asc' ? <ArrowUp size={13} /> : <ArrowDown size={13} />
                            ) : (
                              <ArrowUpDown size={13} />
                            )}
                          </span>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {pagedRows.map(e => (
                <tr
                  key={e.sk}
                  tabIndex={0}
                  onClick={() => onOpen(e)}
                  onKeyDown={k => k.key === 'Enter' && onOpen(e)}
                >
                  {cols.map(c => (
                    <td key={c}>{COLS[c].render(e)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {filtered.length > 0 && (
        <div className="pager">
          <div className="pager-info">
            Showing <b>{currentPage * pageSize + 1}</b>–<b>{Math.min((currentPage + 1) * pageSize, filtered.length)}</b> of <b>{filtered.length}</b> receipts
          </div>

          <div className="pager-controls">
            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Rows:
              <select
                value={pageSize}
                onChange={e => { setPageSize(Number(e.target.value)); setPage(0); }}
                style={{ marginLeft: '0.4rem', padding: '0.2rem 0.4rem' }}
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </label>

            <button
              disabled={currentPage === 0}
              onClick={() => setPage(currentPage - 1)}
              className="btn-sm"
              aria-label="Previous page"
            >
              <ChevronLeft size={14} /> Prev
            </button>
            <span style={{ padding: '0 0.5rem', fontWeight: 600 }}>
              {currentPage + 1} / {pages}
            </span>
            <button
              disabled={currentPage >= pages - 1}
              onClick={() => setPage(currentPage + 1)}
              className="btn-sm"
              aria-label="Next page"
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function ReceiptPreview({
  s3Key,
  merchant,
  receiptId
}: {
  s3Key: string;
  merchant?: string;
  receiptId?: string;
}) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const { success } = useToast();

  const loadUrl = useCallback(async () => {
    if (!s3Key) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const url = await api.getReceiptUrl(s3Key);
      if (url) {
        setImageUrl(url);
      } else {
        setError('No preview URL generated.');
      }
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to generate receipt image preview');
    } finally {
      setLoading(false);
    }
  }, [s3Key]);

  useEffect(() => {
    loadUrl();
  }, [loadUrl]);

  const copyKey = () => {
    if (!s3Key) return;
    navigator.clipboard.writeText(s3Key);
    success('S3 Key copied to clipboard');
  };

  return (
    <div className="receipt-preview-container">
      {loading ? (
        <div className="receipt-preview-loading">
          <RefreshCw size={24} className="spin" style={{ color: 'var(--primary)' }} />
          <span>Generating secure receipt image preview…</span>
        </div>
      ) : error ? (
        <div className="img-placeholder">
          <AlertCircle size={32} style={{ color: '#ef4444' }} />
          <b>Unable to load receipt preview</b>
          <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>{error}</p>
          <button className="btn-outline btn-sm" onClick={loadUrl} style={{ marginTop: '0.5rem' }}>
            <RefreshCw size={12} /> Retry
          </button>
        </div>
      ) : imageUrl ? (
        <>
          <div
            className="receipt-img-card"
            onClick={() => setLightboxOpen(true)}
            title="Click to view full-resolution receipt"
            role="button"
            tabIndex={0}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setLightboxOpen(true); } }}
          >
            <img
              src={imageUrl}
              alt={`Receipt from ${merchant || 'store'}`}
              className="receipt-live-img"
              onError={() => setError('Image failed to render in browser.')}
            />
            <div className="receipt-badge-overlay">
              <Eye size={12} /> Click to expand
            </div>
          </div>

          <div className="receipt-key-banner">
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <FileText size={12} /> S3: <code title={s3Key}>{s3Key.length > 28 ? `…${s3Key.slice(-26)}` : s3Key}</code>
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <button
                className="btn-outline btn-sm"
                onClick={copyKey}
                title="Copy full S3 key"
                style={{ padding: '0.15rem 0.4rem', fontSize: '0.7rem' }}
              >
                <Copy size={11} /> Copy Key
              </button>
              <a
                href={imageUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="btn-outline btn-sm"
                title="Open image in new tab"
                style={{ padding: '0.15rem 0.4rem', fontSize: '0.7rem' }}
                onClick={e => e.stopPropagation()}
              >
                <ExternalLink size={11} />
              </a>
            </div>
          </div>

          {lightboxOpen && (
            <div className="receipt-lightbox" onClick={() => setLightboxOpen(false)}>
              <div className="receipt-lightbox-header" onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <FileText size={18} />
                  <span style={{ fontWeight: 600 }}>{merchant || 'Receipt Image'}</span>
                  {receiptId && <span style={{ opacity: 0.7, fontSize: '0.85rem' }}>({receiptId})</span>}
                </div>
                <button
                  className="x-btn"
                  onClick={() => setLightboxOpen(false)}
                  aria-label="Close lightbox"
                  title="Close (Esc)"
                >
                  <X size={18} strokeWidth={2.5} width={18} height={18} />
                </button>
              </div>
              <div className="receipt-lightbox-content" onClick={e => e.stopPropagation()}>
                <img
                  src={imageUrl}
                  alt={`Receipt from ${merchant || 'store'}`}
                  className="receipt-lightbox-img"
                />
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="img-placeholder">
          <FileText size={36} />
          <b>No receipt image preview</b>
          <p style={{ margin: 0 }}>The S3 storage bucket is private and no key was found.</p>
        </div>
      )}
    </div>
  );
}

function Detail({
  e,
  onClose,
  canApprove,
  onDone
}: {
  e: Expense;
  onClose: () => void;
  canApprove: boolean;
  onDone: () => void;
}) {
  const [pt, setPt] = useState('Cash');
  const [selectedCategory, setSelectedCategory] = useState(e.category || '');
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const { success, error } = useToast();

  const b = blockers({ ...e, category: selectedCategory });

  // Keyboard shortcut: ESC to close
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const copyId = () => {
    navigator.clipboard.writeText(e.receiptId);
    success('Receipt ID copied to clipboard');
  };

  const go = async () => {
    setBusy(true);
    setMsg('');
    try {
      const r = await api.approve(e, pt, selectedCategory);
      const text = (r.message || 'Approved') + ' — status will show PENDING; QuickBooks sync runs asynchronously.';
      setMsg(text);
      success('Receipt approved and submitted for sync');
      onDone();
    } catch (x) {
      const errText = (x as Error).message;
      setMsg(errText);
      error(errText);
    } finally {
      setBusy(false);
    }
  };

  const F = ([k, v]: [string, ReactNode]) => (
    <div key={k}>
      <dt>{k}</dt>
      <dd>{v}</dd>
    </div>
  );

  const confPct = e.confidence !== null ? Math.round(e.confidence * 100) : null;

  return (
    <div className="modal" onClick={onClose}>
      <div
        className="panel"
        role="dialog"
        aria-modal="true"
        aria-label="Receipt details drawer"
        onClick={x => x.stopPropagation()}
      >
        <div className="sheet-handle" />
        <div className="modal-header">
          <div className="modal-title-group">
            <h2>
              <span>{e.merchant || 'Unknown Merchant'}</span>
              <Badge s={e.syncStatus} />
            </h2>
            <div className="modal-id">
              <span>Receipt ID: <code>{e.receiptId || '—'}</code></span>
              {e.receiptId && (
                <button
                  className="btn-outline btn-sm"
                  onClick={copyId}
                  title="Copy full Receipt ID"
                  style={{ padding: '0.15rem 0.4rem' }}
                >
                  <Copy size={12} />
                </button>
              )}
            </div>
          </div>
          <button className="x-btn" onClick={onClose} aria-label="Close dialog" title="Close dialog">
            <X size={18} strokeWidth={2.5} width={18} height={18} />
          </button>
        </div>

        {/* Hero banner with amount and OCR confidence */}
        <div className="detail-hero">
          <div>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.2rem' }}>
              Total Amount
            </span>
            <div className="detail-amount">
              {money(e.total, e.currency)}
            </div>
          </div>

          <div className="detail-confidence-pill">
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              OCR Confidence: <b>{confPct !== null ? `${confPct}%` : 'N/A'}</b>
            </span>
            <div className="conf-bar">
              <div
                className={`conf-bar-fill ${confPct && confPct >= 75 ? 'conf-good' : confPct && confPct >= 60 ? 'conf-warn' : 'conf-bad'}`}
                style={{ width: `${confPct || 0}%` }}
              />
            </div>
          </div>
        </div>

        <div className="two">
          <ReceiptPreview s3Key={e.s3Key} merchant={e.merchant} receiptId={e.receiptId} />

          <dl>
            {([
              ['Receipt Date', e.receiptDate || '—'],
              ['Subtotal', money(e.subtotal, e.currency)],
              ['Tax', money(e.tax, e.currency)],
              ['Category', e.category || '—'],
              ['Payment Method', e.paymentType || '—'],
              ['Account ID', e.paymentAccountId || '—'],
              ['QuickBooks ID', e.qboId || '—'],
              ['Sync Error', e.syncError || '—'],
            ] as [string, ReactNode][]).map(F)}
          </dl>
        </div>

        {e.reviewReasons.length > 0 && (
          <div className="warn-box">
            <b><AlertTriangle size={16} /> Review Reasons Flagged</b>
            <ul>
              {e.reviewReasons.map(r => <li key={r}>{r}</li>)}
            </ul>
          </div>
        )}

        {canApprove && (
          <div className="approve-box">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <b><ShieldCheck size={18} style={{ color: 'var(--primary)' }} /> Eligibility Verification</b>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Lambda policy authority
              </span>
            </div>

            <div className="checklist">
              <div className="check-item">
                {e.syncStatus === 'NEEDS_REVIEW' ? <CheckCircle2 size={16} className="check-pass" /> : <XCircle size={16} className="check-fail" />}
                <span>Status is NEEDS_REVIEW</span>
              </div>
              <div className="check-item">
                {(e.confidence ?? 0) >= 0.75 ? <CheckCircle2 size={16} className="check-pass" /> : <XCircle size={16} className="check-fail" />}
                <span>OCR confidence &ge; 75% ({confPct}%)</span>
              </div>
              <div className="check-item">
                {e.currency === 'USD' ? <CheckCircle2 size={16} className="check-pass" /> : <XCircle size={16} className="check-fail" />}
                <span>Currency is USD ({e.currency || 'missing'})</span>
              </div>
              <div className="check-item">
                {e.paymentAccountId === '35' ? <CheckCircle2 size={16} className="check-pass" /> : <XCircle size={16} className="check-fail" />}
                <span>Account is Checking 35 ({e.paymentAccountId || 'missing'})</span>
              </div>
              <div className="check-item">
                {['Office Supplies', 'Meals & Entertainment', 'Travel & Transport', 'Utilities'].includes(selectedCategory) ? <CheckCircle2 size={16} className="check-pass" /> : <XCircle size={16} 				className="check-fail" />}
			<span>Approved QBO category ({selectedCategory || 'missing'})</span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.5rem' }}>
  		<label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', fontWeight: 500 }}>
    			Expense Category:
    			<select
      				value={selectedCategory}
      				onChange={x => {
        				setSelectedCategory(x.target.value);
        				setOk(false);
      				}}
    			>

      				<option value="">Select a category</option>
      				<option value="Office Supplies">Office Supplies</option>
      				<option value="Meals & Entertainment">Meals & Entertainment</option>
      				<option value="Travel & Transport">Travel & Transport</option>
      				<option value="Utilities">Utilities</option>
    			</select>
  		</label>

  		<label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', fontWeight: 500 }}>
    			Payment Method:
    			<select value={pt} onChange={x => setPt(x.target.value)}>
      				<option value="Cash">Cash</option>
      				<option value="Check">Check</option>
    			</select>
  		</label>
	    </div>

            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem', fontSize: '0.875rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={ok}
                onChange={x => setOk(x.target.checked)}
                style={{ marginTop: '0.2rem' }}
              />
              <span>I confirm merchant, date, total and category are accurate and authorize QuickBooks Sandbox sync.</span>
            </label>

            <div className="approve-actions">
              <button
                className="primary"
                disabled={busy || !ok || !['Office Supplies', 'Meals & Entertainment', 'Travel & Transport', 'Utilities'].includes(selectedCategory) || b.length > 0}
                onClick={go}
              >
                {busy ? <><RefreshCw size={14} className="spin" /> Submitting…</> : <><Check size={16} /> Approve for sync</>}
              </button>
              <button disabled title="Backend reject endpoint is planned for a future update" className="btn-outline">
                Reject (Not available yet)
              </button>
            </div>
          </div>
        )}

        {msg && <p role="status" className="muted" style={{ marginTop: '0.5rem' }}>{msg}</p>}
      </div>
    </div>
  );
}

function Dashboard() {
  const x = useExpenses();
  const navigate = useNavigate();

  const s = useMemo(() => {
    const usd = x.rows.filter(r => r.currency === 'USD');
    const by: Record<string, number> = {};
    const countBy: Record<string, number> = {};

    usd.forEach(r => {
      const cat = r.category || 'Uncategorized';
      by[cat] = (by[cat] || 0) + (r.total || 0);
      countBy[cat] = (countBy[cat] || 0) + 1;
    });

    return {
      total: usd.reduce((a, r) => a + (r.total || 0), 0),
      by,
      countBy,
      n: (st: string) => x.rows.filter(r => r.syncStatus === st).length
    };
  }, [x.rows]);

  const max = Math.max(1, ...Object.values(s.by));
  const totalCount = x.rows.length;

  return (
    <>
      <div className="head">
        <div>
          <h1>Dashboard</h1>
          <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.875rem' }}>
            Real-time receipt reconciliation & QuickBooks Online sandbox pipeline
          </p>
        </div>
        <div className="head-actions">
          <Link className="btn primary" to="/upload">
            <UpIcon size={16} /> Upload receipt
          </Link>
          <button className="btn-secondary" onClick={x.load} title="Refresh data">
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      <State x={x}>
        {/* KPI Metric Cards */}
        <div className="cards">
          <div className="card">
            <div className="card-top">
              <span>Total USD spend</span>
              <div className="card-icon" style={{ color: '#0f766e', background: 'var(--primary-light)' }}>
                <DollarSign size={20} />
              </div>
            </div>
            <b>{money(s.total, 'USD')}</b>
            <span className="card-subtext">Across {x.rows.filter(r => r.currency === 'USD').length} USD receipts</span>
          </div>

          <div className="card card-clickable" onClick={() => navigate('/expenses')}>
            <div className="card-top">
              <span>Total receipts</span>
              <div className="card-icon" style={{ color: '#0284c7', background: 'rgba(2, 132, 199, 0.12)' }}>
                <Receipt size={20} />
              </div>
            </div>
            <b>{totalCount}</b>
            <span className="card-subtext">Click to view all expenses &rarr;</span>
          </div>

          <div className="card card-clickable" onClick={() => navigate('/review')}>
            <div className="card-top">
              <span>Awaiting review</span>
              <div className="card-icon" style={{ color: '#d97706', background: 'var(--status-review-bg)' }}>
                <Clock size={20} />
              </div>
            </div>
            <b>{s.n('NEEDS_REVIEW')}</b>
            <span className="card-subtext">Requires human verification &rarr;</span>
          </div>

          <div className="card card-clickable" onClick={() => navigate('/sync')}>
            <div className="card-top">
              <span>Synced to QBO</span>
              <div className="card-icon" style={{ color: '#16a34a', background: 'var(--status-synced-bg)' }}>
                <CheckCircle2 size={20} />
              </div>
            </div>
            <b>{s.n('SYNCED')}</b>
            <span className="card-subtext">Verified in QuickBooks Sandbox</span>
          </div>

          <div className="card card-clickable" onClick={() => navigate('/sync')}>
            <div className="card-top">
              <span>Sync failures</span>
              <div className="card-icon" style={{ color: '#dc2626', background: 'var(--status-failed-bg)' }}>
                <AlertCircle size={20} />
              </div>
            </div>
            <b>{s.n('FAILED')}</b>
            <span className="card-subtext">{s.n('FAILED') > 0 ? 'Requires attention' : 'No sync errors'}</span>
          </div>
        </div>

        {/* Category Breakdown Progress Bars */}
        <h3>Expense breakdown by category (USD)</h3>
        {Object.keys(s.by).length ? (
          <div className="category-bars">
            {Object.entries(s.by).map(([k, v]) => {
              const pct = s.total > 0 ? Math.round((v / s.total) * 100) : 0;
              const count = s.countBy[k] || 0;
              return (
                <div className="bar" key={k}>
                  <div className="bar-label" title={k}>
                    {k}
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
                      ({count})
                    </span>
                  </div>
                  <div className="bar-track">
                    <div className="bar-fill" style={{ width: `${(v / max) * 100}%` }} />
                  </div>
                  <b className="bar-amount">{money(v, 'USD')}</b>
                  <span className="bar-pct">{pct}%</span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="empty">No expenses categorized yet.</div>
        )}

        {/* Recent receipts table */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.75rem', marginBottom: '0.75rem' }}>
          <h3 style={{ margin: 0 }}>Recent Receipts</h3>
          <Link to="/expenses" style={{ fontSize: '0.85rem', color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}>
            View all ({x.rows.length}) &rarr;
          </Link>
        </div>
        <Recent rows={x.rows} />
      </State>
    </>
  );
}

function Recent({ rows }: { rows: Expense[] }) {
  const [sel, setSel] = useState<Expense | null>(null);
  const r = [...rows].sort((a, b) => (b.createdAt || b.receiptDate).localeCompare(a.createdAt || a.receiptDate)).slice(0, 5);

  if (!r.length) return <div className="empty">No recent activity.</div>;

  return (
    <>
      <div className="scroll">
        <table>
          <thead>
            <tr>
              <th>Merchant</th>
              <th>Date</th>
              <th>Amount</th>
              <th>Category</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {r.map(e => (
              <tr key={e.sk} onClick={() => setSel(e)}>
                <td style={{ fontWeight: 600 }}>{e.merchant || '—'}</td>
                <td style={{ color: 'var(--text-secondary)' }}>{e.receiptDate}</td>
                <td className="amount-cell">{money(e.total, e.currency)}</td>
                <td>{e.category || '—'}</td>
                <td><Badge s={e.syncStatus} /></td>
                <td>
                  <button className="btn-outline btn-sm" onClick={ev => { ev.stopPropagation(); setSel(e); }}>
                    <Eye size={12} /> View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {sel && <Detail e={sel} canApprove={sel.syncStatus === 'NEEDS_REVIEW'} onClose={() => setSel(null)} onDone={() => {}} />}
    </>
  );
}

function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [meta, setMeta] = useState({ currency: 'USD', paymentAccountId: '35', paymentType: 'Cash' });
  const [step, setStep] = useState(0);
  const [msg, setMsg] = useState('');
  const [id, setId] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const navigate = useNavigate();

  const { success, error } = useToast();

  const pick = (f?: File) => {
    setMsg('');
    if (!f) return;
    if (!['image/jpeg', 'image/png'].includes(f.type)) {
      const err = 'Only JPG or PNG images are supported.';
      setMsg(err);
      error(err);
      return;
    }
    if (f.size > 8e6) {
      const err = 'File is larger than 8 MB.';
      setMsg(err);
      error(err);
      return;
    }
    setFile(f);
    setStep(0);
  };

  const preview = useMemo(() => (file ? URL.createObjectURL(file) : ''), [file]);

  async function go() {
    if (!file) return;
    setMsg('');
    setStep(1);
    try {
      const rid = await api.uploadReceipt(uid(), file, meta);
      setId(rid);
      setStep(2);
      success('Uploaded to storage. Extracting details via OCR…');

      for (let i = 0; i < 15; i++) {
        await new Promise(r => setTimeout(r, 4000));
        const list = await api.listExpenses(uid());
        if (list.some(e => e.receiptId === rid)) {
          setStep(3);
          success('OCR complete! Receipt is ready for review.');
          return;
        }
      }
      setMsg('Still processing after 60 s. Check the Review page shortly.');
    } catch (e) {
      const errText = (e as Error).message;
      setMsg(errText);
      error(errText);
      setStep(0);
    }
  }

  const stepsList = [
    { title: 'Select receipt', desc: 'Choose JPG or PNG image' },
    { title: 'Upload to S3', desc: 'Presigned S3 upload' },
    { title: 'Extract details', desc: 'Lambda + Tesseract OCR' },
    { title: 'Review or sync', desc: 'Reconcile into QuickBooks' }
  ];

  return (
    <>
      <div className="head">
        <div>
          <h1>Upload receipt</h1>
          <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.875rem' }}>
            Submit a paper receipt image for automated OCR recognition and ledger matching
          </p>
        </div>
      </div>

      <div className="dropzone-container">
        <div
          className={`drop ${isDragOver ? 'drag-over' : ''}`}
          onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={e => {
            e.preventDefault();
            setIsDragOver(false);
            pick(e.dataTransfer.files[0]);
          }}
          onClick={() => document.getElementById('receipt-upload-input')?.click()}
        >
          <div className="drop-icon">
            <UpIcon size={28} />
          </div>
          <div>
            <b style={{ fontSize: '1.05rem', display: 'block', marginBottom: '0.2rem' }}>
              Drag &amp; drop receipt file here
            </b>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              or click to browse your computer (JPEG or PNG up to 8 MB)
            </span>
          </div>

          <input
            id="receipt-upload-input"
            type="file"
            accept="image/jpeg,image/png"
            style={{ display: 'none' }}
            aria-label="Receipt file"
            onChange={e => pick(e.target.files?.[0])}
          />

          {file && (
            <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--bg-surface)', padding: '0.35rem 0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)' }}>
                <FileText size={16} />
                <span style={{ fontWeight: 600 }}>{file.name}</span>
                <span style={{ color: 'var(--text-muted)' }}>({(file.size / 1024).toFixed(1)} KB)</span>
                <button
                  className="search-clear"
                  onClick={e => { e.stopPropagation(); setFile(null); }}
                  title="Remove file"
                >
                  <X size={14} />
                </button>
              </div>

              {preview && (
                <img src={preview} alt="Selected receipt preview" />
              )}
            </div>
          )}
        </div>

        <div className="filter-card">
          <h3 style={{ margin: '0 0 0.75rem' }}>Receipt metadata</h3>
          <div className="filters">
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Currency
              <select value={meta.currency} onChange={e => setMeta({ ...meta, currency: e.target.value })}>
                <option>USD</option>
                <option>INR</option>
                <option>GBP</option>
                <option>EUR</option>
              </select>
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Checking Account ID
              <input value={meta.paymentAccountId} onChange={e => setMeta({ ...meta, paymentAccountId: e.target.value })} />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Payment Type
              <select value={meta.paymentType} onChange={e => setMeta({ ...meta, paymentType: e.target.value })}>
                <option>Cash</option>
                <option>Check</option>
                <option>CreditCard</option>
              </select>
            </label>

            <div style={{ alignSelf: 'flex-end', marginLeft: 'auto' }}>
              <button
                className="primary"
                disabled={!file || step === 1 || step === 2}
                onClick={go}
              >
                {step === 1 || step === 2 ? (
                  <><RefreshCw size={14} className="spin" /> Processing…</>
                ) : (
                  <><UpIcon size={16} /> Start upload</>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Progress Pipeline Stepper */}
        <div className="upload-pipeline">
          {stepsList.map((s, i) => {
            const isCompleted = i < step;
            const isCurrent = i === step && (file !== null || step > 0);
            const isReviewOrSync = i === 3;
            const isActionable = isReviewOrSync && (step === 3 || Boolean(id));

            const handleClick = () => {
              if (isActionable) {
                const targetUrl = id ? `/review?receiptId=${encodeURIComponent(id)}` : '/review';
                navigate(targetUrl);
              }
            };

            return (
              <div
                key={s.title}
                className={`step-card ${isCurrent ? 'active' : ''} ${isCompleted ? 'completed' : ''} ${isActionable ? 'actionable' : ''}`}
                onClick={isActionable ? handleClick : undefined}
                role={isActionable ? 'button' : undefined}
                tabIndex={isActionable ? 0 : undefined}
                onKeyDown={isActionable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick(); } } : undefined}
                title={isActionable ? `Click to open review page for uploaded receipt (${id || 'ready'})` : undefined}
              >
                <div className="step-number">
                  {isCompleted ? <Check size={16} /> : i + 1}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{s.title}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{s.desc}</div>
                  {isActionable && (
                    <div className="step-action-badge">
                      Click to review receipt &rarr;
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {id && (
          <div className="filter-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>
              Assigned Receipt ID: <code>{id}</code>
            </span>
            {step === 3 && (
              <Link to={`/review?receiptId=${encodeURIComponent(id)}`} className="btn primary btn-sm">
                Open review queue &rarr;
              </Link>
            )}
          </div>
        )}

        {msg && <div className="err" role="alert">{msg}</div>}
      </div>
    </>
  );
}

function Page({
  title,
  cols,
  status,
  statuses,
  csv,
  approve,
  help
}: {
  title: string;
  cols: string[];
  status?: string;
  statuses?: string[];
  csv?: boolean;
  approve?: boolean;
  help?: ReactNode;
}) {
  const x = useExpenses();
  const [sel, setSel] = useState<Expense | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const targetReceiptId = searchParams.get('receiptId') || searchParams.get('id');

  // Automatically select & open the requested receipt if specified in the query params
  useEffect(() => {
    if (targetReceiptId && x.rows.length > 0 && !sel) {
      const match = x.rows.find(
        r => r.receiptId === targetReceiptId || r.sk.split('#')[1] === targetReceiptId || r.sk.includes(targetReceiptId)
      );
      if (match) {
        setSel(match);
      }
    }
  }, [targetReceiptId, x.rows, sel]);

  const handleClose = () => {
    setSel(null);
    if (targetReceiptId) {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete('receiptId');
      nextParams.delete('id');
      setSearchParams(nextParams, { replace: true });
    }
  };

  return (
    <>
      <div className="head">
        <div>
          <h1>{title}</h1>
        </div>
        <button onClick={x.load} className="btn-secondary">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {help}

      <State x={x}>
        <List
          rows={x.rows}
          cols={cols}
          status={status}
          statuses={statuses}
          csv={csv}
          onOpen={setSel}
        />
        {sel && (
          <Detail
            e={sel}
            canApprove={!!approve}
            onClose={handleClose}
            onDone={() => { x.load(); }}
          />
        )}
      </State>
    </>
  );
}

function SettingsPage() {
  const [u, setU] = useState(uid());
  const x = useExpenses();
  const { theme, setTheme } = useTheme();
  const { success } = useToast();

  const saveUser = () => {
    localStorage.setItem('userId', u.trim());
    success(`User ID updated to "${u.trim()}"`);
    setTimeout(() => location.reload(), 600);
  };

  const selectTheme = (t: Theme) => {
    setTheme(t);
    success(`Theme set to ${t.charAt(0).toUpperCase() + t.slice(1)}`);
  };

  return (
    <>
      <div className="head">
        <div>
          <h1>Settings &amp; Preferences</h1>
          <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.875rem' }}>
            Configure theme, user identity, and inspect API gateway connection
          </p>
        </div>
      </div>

      <div className="settings-grid">
        {/* Theme Settings Card */}
        <div className="settings-card">
          <h3>Interface Appearance</h3>
          <p>Choose your preferred color theme or match your operating system theme.</p>

          <div className="theme-selector">
            <div
              className={`theme-option ${theme === 'light' ? 'selected' : ''}`}
              onClick={() => selectTheme('light')}
            >
              {theme === 'light' && (
                <div className="theme-check-badge" title="Active Theme">
                  <Check size={12} strokeWidth={3} />
                </div>
              )}
              <div className="theme-preview-box preview-light">
                <div className="window-dots">
                  <span className="dot-red" />
                  <span className="dot-yellow" />
                  <span className="dot-green" />
                </div>
                <div className="preview-body">
                  <div className="preview-light-nav" />
                  <div className="preview-light-main">
                    <div className="preview-bar-teal" />
                    <div className="preview-bar-gray" />
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}>
                <Sun size={16} /> Light
              </div>
            </div>

            <div
              className={`theme-option ${theme === 'dark' ? 'selected' : ''}`}
              onClick={() => selectTheme('dark')}
            >
              {theme === 'dark' && (
                <div className="theme-check-badge" title="Active Theme">
                  <Check size={12} strokeWidth={3} />
                </div>
              )}
              <div className="theme-preview-box preview-dark">
                <div className="window-dots">
                  <span className="dot-red" />
                  <span className="dot-yellow" />
                  <span className="dot-green" />
                </div>
                <div className="preview-body">
                  <div className="preview-dark-nav" />
                  <div className="preview-dark-main">
                    <div className="preview-dark-teal" />
                    <div className="preview-dark-gray" />
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}>
                <Moon size={16} /> Dark
              </div>
            </div>

            <div
              className={`theme-option ${theme === 'system' ? 'selected' : ''}`}
              onClick={() => selectTheme('system')}
            >
              {theme === 'system' && (
                <div className="theme-check-badge" title="Active Theme">
                  <Check size={12} strokeWidth={3} />
                </div>
              )}
              <div className="theme-preview-box preview-light">
                <div className="window-dots">
                  <span className="dot-red" />
                  <span className="dot-yellow" />
                  <span className="dot-green" />
                </div>
                <div
                  className="preview-body"
                  style={{ background: 'linear-gradient(135deg, #f5f5f7 50%, #1c1c1e 50%)' }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}>
                <Laptop size={16} /> System Default
              </div>
            </div>
          </div>
        </div>

        {/* User Identity Card */}
        <div className="settings-card">
          <h3>User Identity (Frontend simulation)</h3>
          <p>
            Receipts in DynamoDB are partitioned by <code>userId</code>.
            Change the user identifier below to test isolated receipt batches.
          </p>

          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', flexWrap: 'wrap' }}>
            <input
              value={u}
              onChange={e => setU(e.target.value)}
              placeholder="e.g. demo-user"
              style={{ minWidth: '260px' }}
            />
            <button className="primary" onClick={saveUser}>
              Save &amp; Reload
            </button>
          </div>

          <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.75rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Quick presets:</span>
            {['demo-user', 'finance-team', 'auditor-01'].map(name => (
              <button
                key={name}
                className="chip"
                onClick={() => { setU(name); }}
              >
                {name}
              </button>
            ))}
          </div>
        </div>

        {/* Diagnostics & Environment */}
        <div className="settings-card">
          <h3>System &amp; Pipeline Diagnostics</h3>
          <dl style={{ marginTop: '0.75rem' }}>
            <div>
              <dt>QuickBooks Environment</dt>
              <dd><Badge s="SANDBOX" /> QuickBooks Online Sandbox Company</dd>
            </div>
            <div>
              <dt>Data Mode</dt>
              <dd>
                {api.DEMO ? (
                  <span style={{ color: '#d97706', fontWeight: 600 }}>Built-in Demo Sample Data</span>
                ) : (
                  <span style={{ color: '#10b981', fontWeight: 600 }}>Live AWS Pipeline Gateway</span>
                )}
              </dd>
            </div>
            <div>
              <dt>Backend API Connectivity</dt>
              <dd>
                {x.loading ? (
                  <span>Checking status…</span>
                ) : x.err ? (
                  <span style={{ color: '#ef4444' }}>Error: {x.err}</span>
                ) : (
                  <span style={{ color: '#10b981' }}>Connected ({x.rows.length} records loaded)</span>
                )}
              </dd>
            </div>
            <div>
              <dt>Dev Gateway Security</dt>
              <dd>Server-side injection of API_KEY &amp; REVIEW_TOKEN</dd>
            </div>
          </dl>
        </div>
      </div>
    </>
  );
}

const NAV: [string, string, (counts: { review: number; failed: number }) => ReactNode, ReactNode][] = [
  ['/', 'Dashboard', () => null, <LayoutDashboard size={18} />],
  ['/upload', 'Upload receipt', () => null, <UpIcon size={18} />],
  [
    '/review',
    'Review queue',
    c => c.review > 0 ? <span className="nav-badge">{c.review}</span> : null,
    <ClipboardCheck size={18} />
  ],
  ['/expenses', 'All expenses', () => null, <BookOpen size={18} />],
  [
    '/sync',
    'QuickBooks sync',
    c => c.failed > 0 ? <span className="nav-badge danger">{c.failed}</span> : null,
    <RefreshCw size={18} />
  ],
  ['/settings', 'Settings', () => null, <Cog size={18} />]
];

function MainShell() {
  const x = useExpenses();
  const { user, logout } = useAuth();
  const { success } = useToast();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    success('Signed out successfully');
    navigate('/login', { replace: true });
  };

  const counts = useMemo(() => ({
    review: x.rows.filter(r => r.syncStatus === 'NEEDS_REVIEW').length,
    failed: x.rows.filter(r => r.syncStatus === 'FAILED').length
  }), [x.rows]);

  const activeUser = user || uid();

  return (
    <>
      <header className="top">
        <Logo />

        <div className="top-actions">
          <span className="env">
            <span className="env-dot" />
            QuickBooks Sandbox
          </span>

          <ThemeToggleButton />

          <Link to="/upload" className="btn primary btn-sm" style={{ textDecoration: 'none' }}>
            <UpIcon size={14} /> Upload
          </Link>

          <button
            type="button"
            onClick={handleLogout}
            className="btn-signout"
            title="Sign Out of Tallyfold"
            aria-label="Sign Out"
          >
            <LogOut size={13} /> Sign Out
          </button>
        </div>
      </header>

      {api.DEMO && (
        <div className="demo-banner">
          <span>Demo Mode</span>
          Displaying built-in sample expenses (backend calls disabled).
        </div>
      )}

      <div className="shell">
        <nav aria-label="Main Navigation">
          <div className="nav-links">
            <div className="nav-section-label">Navigation</div>
            {NAV.map(([to, label, badgeFn, icon]) => (
              <NavLink key={to} to={to} end={to === '/'}>
                {icon}
                <span>{label}</span>
                {badgeFn(counts)}
              </NavLink>
            ))}
          </div>

          <div className="nav-footer">
            <div className="user-pill">
              <div className="user-avatar">
                {activeUser.charAt(0).toUpperCase()}
              </div>
              <div className="user-meta" style={{ flex: 1, minWidth: 0 }}>
                <span className="user-name">{activeUser}</span>
                <span className="user-role">Sandbox Auditor</span>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="btn-signout"
                title="Sign Out"
                aria-label="Sign Out"
                style={{ border: 'none', padding: '4px' }}
              >
                <LogOut size={14} />
              </button>
            </div>
          </div>
        </nav>

        <main>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/upload" element={<UploadPage />} />
            <Route
              path="/review"
              element={
                <Page
                  title="Review receipts"
                  status="NEEDS_REVIEW"
                  cols={['merchant', 'date', 'amount', 'category', 'conf', 'pay', 'reason', 'status']}
                  approve
                  help={
                    <p style={{ color: 'var(--text-muted)', marginBottom: '1.25rem', fontSize: '0.875rem' }}>
                      Inspect OCR extracted receipt values. Verify compliance with sandbox eligibility rules before syncing to QuickBooks.
                    </p>
                  }
                />
              }
            />
            <Route
              path="/expenses"
              element={
                <Page
                  title="All expenses"
                  csv
                  cols={['merchant', 'date', 'amount', 'category', 'pay', 'id', 'status', 'qbo']}
                  help={
                    <p style={{ color: 'var(--text-muted)', marginBottom: '1.25rem', fontSize: '0.875rem' }}>
                      Complete history of scanned receipts and synchronization records.
                    </p>
                  }
                />
              }
            />
            <Route
              path="/sync"
              element={
                <Page
                  title="QuickBooks sync status"
                  statuses={['PENDING', 'SYNCING', 'SYNCED', 'FAILED']}
                  cols={['merchant', 'date', 'amount', 'id', 'status', 'qbo', 'err']}
                  help={
                    <p style={{ color: 'var(--text-muted)', marginBottom: '1.25rem', fontSize: '0.875rem' }}>
                      Real-time status of asynchronous QuickBooks Sandbox synchronization. Synced transactions will be registered under Sandbox Expenses.
                    </p>
                  }
                />
              }
            />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </main>
      </div>
    </>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route
                path="/*"
                element={
                  <RequireAuth>
                    <MainShell />
                  </RequireAuth>
                }
              />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
