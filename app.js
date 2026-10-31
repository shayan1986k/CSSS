/**
 * Campus Pulse - Main Application Logic
 * Translucent Cornflower Blue cards with Playing Card Suits:
 * - Green Hearts (♥): 2+ Days Later
 * - Yellow Clubs (♣): Tomorrow
 * - Red Diamonds (♦): Today
 * - Black Spades (♠): Is Over
 * 
 * Features:
 * - High-accuracy WhatsApp parser that detects labeled lines (Venue, Date, Time, Title).
 * - Inner details box uses a light, matching border tint for high readability.
 * - Floating Green Plus button with Text and Image options.
 * - Floating Red Delete button with smart Selection Mode (auto-selects all Black Spades cards).
 */

// State Management
const STATE = {
  events: [],
  activeFilter: 'all',
  searchQuery: '',
  geminiApiKey: localStorage.getItem('campuspulse_gemini_key') || localStorage.getItem('organaize_gemini_key') || localStorage.getItem('noticepulse_gemini_key') || '',
  currentImageBase64: null,
  currentImageMimeType: null,
  currentImageFile: null,
  
  // Selection / Batch Deletion Mode
  isSelectionMode: false,
  selectedCardIds: new Set()
};

// Selectors
const DOM = {
  cardsGrid: document.getElementById('cardsGrid'),
  emptyState: document.getElementById('emptyState'),
  currentDeviceTime: document.getElementById('currentDeviceTime'),
  
  // Floating Action Controls
  greenAddBtn: document.getElementById('greenAddBtn'),
  addPopover: document.getElementById('addPopover'),
  popoverTextOption: document.getElementById('popoverTextOption'),
  popoverImageOption: document.getElementById('popoverImageOption'),
  redDeleteBtn: document.getElementById('redDeleteBtn'),
  selectedCountBadge: document.getElementById('selectedCountBadge'),
  deleteBtnTooltip: document.getElementById('deleteBtnTooltip'),
  selectionBanner: document.getElementById('selectionBanner'),
  cancelSelectionBtn: document.getElementById('cancelSelectionBtn'),
  
  // Text Modal
  textModal: document.getElementById('textModal'),
  closeTextModalBtn: document.getElementById('closeTextModalBtn'),
  cancelTextModalBtn: document.getElementById('cancelTextModalBtn'),
  clearTextModalBtn: document.getElementById('clearTextModalBtn'),
  submitTextModalBtn: document.getElementById('submitTextModalBtn'),
  noticeTextInput: document.getElementById('noticeTextInput'),
  modalProgressBar: document.getElementById('modalProgressBar'),
  modalProgressText: document.getElementById('modalProgressText'),
  sampleNotice1: document.getElementById('sampleNotice1'),
  sampleNotice2: document.getElementById('sampleNotice2'),
  sampleNotice3: document.getElementById('sampleNotice3'),

  // Image Modal
  imageModal: document.getElementById('imageModal'),
  closeImageModalBtn: document.getElementById('closeImageModalBtn'),
  cancelImageModalBtn: document.getElementById('cancelImageModalBtn'),
  submitImageModalBtn: document.getElementById('submitImageModalBtn'),
  modalDropzone: document.getElementById('modalDropzone'),
  modalImageFileInput: document.getElementById('modalImageFileInput'),
  modalImagePreviewContainer: document.getElementById('modalImagePreviewContainer'),
  modalImagePreview: document.getElementById('modalImagePreview'),
  modalImageFileName: document.getElementById('modalImageFileName'),
  modalImageFileSize: document.getElementById('modalImageFileSize'),
  modalRemoveImageBtn: document.getElementById('modalRemoveImageBtn'),
  imageProgressBar: document.getElementById('imageProgressBar'),
  
  // Controls & Modals
  loadDemoBtn: document.getElementById('loadDemoBtn'),
  emptyLoadDemoBtn: document.getElementById('emptyLoadDemoBtn'),
  searchInput: document.getElementById('searchInput'),
  
  // Counts
  countAll: document.getElementById('countAll'),
  countUpcoming: document.getElementById('countUpcoming'),
  countTomorrow: document.getElementById('countTomorrow'),
  countToday: document.getElementById('countToday'),
  countOver: document.getElementById('countOver'),
  
  // Edit Modal
  cardModal: document.getElementById('cardModal'),
  closeModalBtn: document.getElementById('closeModalBtn'),
  cancelModalBtn: document.getElementById('cancelModalBtn'),
  cardEditForm: document.getElementById('cardEditForm'),
  editCardId: document.getElementById('editCardId'),
  editTitle: document.getElementById('editTitle'),
  editDate: document.getElementById('editDate'),
  editTime: document.getElementById('editTime'),
  editVenue: document.getElementById('editVenue'),
  editSummary: document.getElementById('editSummary'),
  
  // Settings Modal
  openApiKeyBtn: document.getElementById('openApiKeyBtn'),
  apiKeyStatusDot: document.getElementById('apiKeyStatusDot'),
  apiKeyModal: document.getElementById('apiKeyModal'),
  closeApiKeyModalBtn: document.getElementById('closeApiKeyModalBtn'),
  apiKeyInput: document.getElementById('apiKeyInput'),
  saveApiKeyBtn: document.getElementById('saveApiKeyBtn'),
  clearApiKeyBtn: document.getElementById('clearApiKeyBtn'),
  
  toastContainer: document.getElementById('toastContainer')
};

// ==========================================
// 1. Initial Setup & Device Clock
// ==========================================

function initApp() {
  loadEventsFromStorage();
  updateDeviceClock();
  setInterval(updateDeviceClock, 1000);
  
  updateApiKeyStatusUI();
  setupEventListeners();
  setupClipboardPaste();
  
  if (window.lucide) {
    window.lucide.createIcons();
  }

  if (!STATE.events || STATE.events.length === 0) {
    loadDemoCards();
  } else {
    renderCards();
  }
}

function updateDeviceClock() {
  try {
    const now = new Date();
    const options = { 
      weekday: 'short', 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    };
    if (DOM.currentDeviceTime) {
      DOM.currentDeviceTime.textContent = now.toLocaleDateString(undefined, options);
    }
  } catch (e) {
    console.error('Error updating clock:', e);
  }
}

// ==========================================
// 2. Date Comparison, Suits & Color Tinting
// ==========================================

function getEventStatus(eventDateStr, eventTimeStr) {
  const defaultStatus = {
    status: 'upcoming',
    diffDays: 2,
    label: 'In 2+ days',
    badgeText: '♥ In 2+ Days',
    suit: '♥',
    borderClass: 'card-green',
    badgeClass: 'bg-white text-emerald-800 font-bold border-2 border-emerald-500 shadow-sm',
    detailsBoxClass: 'bg-emerald-50/90 border border-emerald-200 text-emerald-950',
    iconColor: 'text-emerald-700'
  };

  if (!eventDateStr) return defaultStatus;

  try {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const cleanStr = String(eventDateStr).trim();
    let eventDate = null;

    if (cleanStr.includes('-')) {
      const parts = cleanStr.split('-');
      if (parts.length === 3) {
        eventDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      }
    }

    if (!eventDate || isNaN(eventDate.getTime())) {
      eventDate = new Date(cleanStr);
    }

    if (isNaN(eventDate.getTime())) {
      return defaultStatus;
    }

    const diffTime = eventDate.getTime() - today.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays >= 2) {
      return {
        status: 'upcoming',
        diffDays,
        label: `In ${diffDays} days`,
        badgeText: `♥ In ${diffDays} Days`,
        suit: '♥',
        borderClass: 'card-green',
        badgeClass: 'bg-white text-emerald-800 font-bold border-2 border-emerald-500 shadow-sm',
        detailsBoxClass: 'bg-emerald-50/90 border border-emerald-200 text-emerald-950',
        iconColor: 'text-emerald-700'
      };
    } else if (diffDays === 1) {
      return {
        status: 'tomorrow',
        diffDays,
        label: 'Tomorrow',
        badgeText: '♣ Tomorrow',
        suit: '♣',
        borderClass: 'card-yellow',
        badgeClass: 'bg-white text-yellow-800 font-bold border-2 border-yellow-500 shadow-sm',
        detailsBoxClass: 'bg-amber-50/90 border border-amber-200 text-amber-950',
        iconColor: 'text-amber-700'
      };
    } else if (diffDays === 0) {
      return {
        status: 'today',
        diffDays,
        label: 'Happening Today',
        badgeText: '♦ Today',
        suit: '♦',
        borderClass: 'card-red',
        badgeClass: 'bg-white text-red-800 font-bold border-2 border-red-500 shadow-sm',
        detailsBoxClass: 'bg-red-50/90 border border-red-200 text-red-950',
        iconColor: 'text-red-700'
      };
    } else {
      const pastDays = Math.abs(diffDays);
      return {
        status: 'over',
        diffDays,
        label: pastDays === 1 ? 'Ended yesterday' : `Ended ${pastDays} days ago`,
        badgeText: '♠ Is Over',
        suit: '♠',
        borderClass: 'card-black',
        badgeClass: 'bg-slate-100 text-slate-900 font-bold border-2 border-slate-800 shadow-sm',
        detailsBoxClass: 'bg-slate-100/90 border border-slate-300 text-slate-900',
        iconColor: 'text-slate-700'
      };
    }
  } catch (err) {
    console.warn('Date parsing exception, using default:', err);
    return defaultStatus;
  }
}

function formatDisplayDate(dateStr) {
  if (!dateStr) return 'Date TBD';
  try {
    const cleanStr = String(dateStr).trim();
    if (cleanStr.includes('-')) {
      const parts = cleanStr.split('-');
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        if (!isNaN(d.getTime())) {
          return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
        }
      }
    }
    const d = new Date(cleanStr);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    }
    return cleanStr;
  } catch (e) {
    return String(dateStr);
  }
}

// ==========================================
// 3. Card Rendering & Selection Mode
// ==========================================

function renderCards() {
  if (!DOM.cardsGrid) return;

  try {
    if (!Array.isArray(STATE.events)) {
      STATE.events = [];
    }

    const filtered = STATE.events.filter(event => {
      if (!event || typeof event !== 'object') return false;

      const statusObj = getEventStatus(event.date, event.time);
      
      if (STATE.activeFilter !== 'all' && statusObj.status !== STATE.activeFilter) {
        return false;
      }

      if (STATE.searchQuery && STATE.searchQuery.trim() !== '') {
        const q = STATE.searchQuery.toLowerCase().trim();
        const matchTitle = String(event.title || '').toLowerCase().includes(q);
        const matchVenue = String(event.venue || '').toLowerCase().includes(q);
        const matchSummary = String(event.summary || '').toLowerCase().includes(q);
        return matchTitle || matchVenue || matchSummary;
      }

      return true;
    });

    filtered.sort((a, b) => {
      const statusA = getEventStatus(a.date, a.time);
      const statusB = getEventStatus(b.date, b.time);
      const weight = { 'today': 1, 'tomorrow': 2, 'upcoming': 3, 'over': 4 };
      const weightA = weight[statusA.status] || 99;
      const weightB = weight[statusB.status] || 99;
      
      if (weightA !== weightB) {
        return weightA - weightB;
      }
      return String(a.date || '').localeCompare(String(b.date || ''));
    });

    updateCounters();

    if (filtered.length === 0) {
      DOM.cardsGrid.innerHTML = '';
      if (DOM.emptyState) DOM.emptyState.classList.remove('hidden');
      return;
    } else {
      if (DOM.emptyState) DOM.emptyState.classList.add('hidden');
    }

    const fragment = document.createDocumentFragment();

    filtered.forEach(event => {
      try {
        const status = getEventStatus(event.date, event.time);
        const formattedDate = formatDisplayDate(event.date);
        const gCalUrl = generateGoogleCalendarUrl(event);
        const safeId = escapeHtml(event.id || ('ev_' + Math.random().toString(36).substr(2, 6)));
        const isSelected = STATE.selectedCardIds.has(safeId);

        const card = document.createElement('div');
        card.className = `card-event group relative rounded-2xl p-5 flex flex-col justify-between ${status.borderClass} ${isSelected ? 'card-selected' : ''}`;
        card.setAttribute('data-id', safeId);

        if (STATE.isSelectionMode) {
          card.onclick = (e) => {
            if (e.target.closest('a') || e.target.closest('button')) return;
            toggleCardSelection(safeId);
          };
          card.style.cursor = 'pointer';
        }

        card.innerHTML = `
          <!-- Top Card Header: Suit Badge, Relative Time, and Selection Checkbox -->
          <div>
            <div class="flex items-center justify-between gap-2 mb-3">
              <span class="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold ${status.badgeClass}">
                <span class="text-sm mr-1">${status.suit}</span>
                ${status.badgeText.substring(2)}
              </span>

              <div class="flex items-center space-x-2">
                <span class="text-[11px] font-bold text-slate-700 bg-white/80 border border-slate-200/80 px-2 py-0.5 rounded-md shadow-xs">
                  ${status.label}
                </span>

                ${STATE.isSelectionMode ? `
                  <input type="checkbox" ${isSelected ? 'checked' : ''} onchange="toggleCardSelection('${safeId}')" class="w-4 h-4 text-red-600 rounded focus:ring-red-500 cursor-pointer" />
                ` : ''}
              </div>
            </div>

            <!-- Event Title -->
            <h3 class="text-base font-extrabold text-slate-900 group-hover:text-emerald-700 transition-colors line-clamp-2 mb-3">
              ${escapeHtml(event.title || 'Untitled Event')}
            </h3>

            <!-- Key Details Grid: Date, Time, Venue (Matching light border color tint) -->
            <div class="space-y-1.5 text-xs font-semibold mb-4 p-3 rounded-xl shadow-xs ${status.detailsBoxClass}">
              <div class="flex items-center space-x-2">
                <i data-lucide="calendar" class="w-4 h-4 ${status.iconColor} shrink-0"></i>
                <span class="font-bold">${formattedDate}</span>
              </div>
              
              <div class="flex items-center space-x-2">
                <i data-lucide="clock" class="w-4 h-4 ${status.iconColor} shrink-0"></i>
                <span>${escapeHtml(event.time || 'Time unspecified')}</span>
              </div>

              <div class="flex items-center space-x-2">
                <i data-lucide="map-pin" class="w-4 h-4 ${status.iconColor} shrink-0"></i>
                <span class="truncate" title="${escapeHtml(event.venue || '')}">${escapeHtml(event.venue || 'Venue TBD')}</span>
              </div>
            </div>

            <!-- Short Summary -->
            <p class="text-xs text-slate-800 font-medium line-clamp-3 leading-relaxed mb-4">
              ${escapeHtml(event.summary || 'No summary available.')}
            </p>
          </div>

          <!-- Bottom Card Action Toolbar -->
          <div class="pt-3 border-t border-slate-300/80 flex items-center justify-between text-xs">
            <div class="flex items-center space-x-1.5">
              <a href="${gCalUrl}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-white hover:bg-slate-50 text-slate-900 font-bold border border-slate-200 shadow-xs transition text-[11px]" title="Add event to Google Calendar">
                <i data-lucide="calendar-plus" class="w-3.5 h-3.5 text-emerald-600"></i>
                <span class="hidden sm:inline">Add to Cal</span>
              </a>

              <button onclick="copyEventDetails('${safeId}')" class="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-white hover:bg-slate-50 text-slate-900 font-bold border border-slate-200 shadow-xs transition text-[11px]" title="Copy summary">
                <i data-lucide="copy" class="w-3.5 h-3.5 text-slate-700"></i>
                <span>Copy</span>
              </button>
            </div>

            <div class="flex items-center space-x-1">
              <button onclick="editEvent('${safeId}')" class="p-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 hover:text-emerald-600 border border-slate-200 shadow-xs transition" title="Edit Card">
                <i data-lucide="edit-2" class="w-3.5 h-3.5"></i>
              </button>
              <button onclick="deleteEvent('${safeId}')" class="p-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 hover:text-red-600 border border-slate-200 shadow-xs transition" title="Delete Card">
                <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
              </button>
            </div>
          </div>
        `;

        fragment.appendChild(card);
      } catch (cardError) {
        console.error('Error rendering individual card:', cardError, event);
      }
    });

    DOM.cardsGrid.innerHTML = '';
    DOM.cardsGrid.appendChild(fragment);

    if (window.lucide) {
      window.lucide.createIcons();
    }
  } catch (err) {
    console.error('Fatal error in renderCards:', err);
  }
}

function updateCounters() {
  const counts = { all: STATE.events.length, upcoming: 0, tomorrow: 0, today: 0, over: 0 };
  
  STATE.events.forEach(e => {
    if (e) {
      const s = getEventStatus(e.date, e.time);
      if (counts[s.status] !== undefined) {
        counts[s.status]++;
      }
    }
  });

  if (DOM.countAll) DOM.countAll.textContent = counts.all;
  if (DOM.countUpcoming) DOM.countUpcoming.textContent = counts.upcoming;
  if (DOM.countTomorrow) DOM.countTomorrow.textContent = counts.tomorrow;
  if (DOM.countToday) DOM.countToday.textContent = counts.today;
  if (DOM.countOver) DOM.countOver.textContent = counts.over;
}

function generateGoogleCalendarUrl(event) {
  try {
    const title = encodeURIComponent(String(event.title || 'Event'));
    const details = encodeURIComponent(String(event.summary || '') + '\n\nOrganized by Campus Pulse');
    const location = encodeURIComponent(String(event.venue || ''));
    
    let dateParam = '';
    if (event.date) {
      const cleanDate = String(event.date).replace(/[^0-9]/g, '');
      if (cleanDate.length === 8) {
        dateParam = `&dates=${cleanDate}/${cleanDate}`;
      }
    }

    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}&location=${location}${dateParam}`;
  } catch (e) {
    return 'https://calendar.google.com';
  }
}

// ==========================================
// 4. Smart Deletion & Selection Mode
// ==========================================

function handleRedDeleteBtnClick() {
  if (!STATE.isSelectionMode) {
    STATE.isSelectionMode = true;
    STATE.selectedCardIds.clear();

    // Auto-select all BLACK cards (♠ Is Over) by default!
    STATE.events.forEach(event => {
      if (event) {
        const s = getEventStatus(event.date, event.time);
        if (s.status === 'over') {
          STATE.selectedCardIds.add(event.id);
        }
      }
    });

    updateSelectionUI();
    renderCards();
    showToast(`Select cards to remove. All Black Spades cards are auto-selected!`, 'info');
  } else {
    const countToDelete = STATE.selectedCardIds.size;
    if (countToDelete === 0) {
      showToast('No cards selected to delete.', 'info');
      exitSelectionMode();
      return;
    }

    if (confirm(`Delete ${countToDelete} selected card(s)?`)) {
      STATE.events = STATE.events.filter(e => e && !STATE.selectedCardIds.has(e.id));
      saveEventsToStorage();
      exitSelectionMode();
      renderCards();
      showToast(`Removed ${countToDelete} card(s) successfully!`, 'success');
    }
  }
}

window.toggleCardSelection = function(cardId) {
  if (STATE.selectedCardIds.has(cardId)) {
    STATE.selectedCardIds.delete(cardId);
  } else {
    STATE.selectedCardIds.add(cardId);
  }
  updateSelectionUI();
  renderCards();
};

function updateSelectionUI() {
  const count = STATE.selectedCardIds.size;
  if (STATE.isSelectionMode) {
    if (DOM.selectionBanner) DOM.selectionBanner.classList.remove('hidden');
    if (DOM.selectedCountBadge) {
      DOM.selectedCountBadge.textContent = count;
      DOM.selectedCountBadge.classList.remove('hidden');
    }
    if (DOM.deleteBtnTooltip) {
      DOM.deleteBtnTooltip.textContent = `Click to Delete (${count})`;
    }
    if (DOM.redDeleteBtn) {
      DOM.redDeleteBtn.classList.add('ring-4', 'ring-red-300');
    }
  } else {
    if (DOM.selectionBanner) DOM.selectionBanner.classList.add('hidden');
    if (DOM.selectedCountBadge) DOM.selectedCountBadge.classList.add('hidden');
    if (DOM.deleteBtnTooltip) DOM.deleteBtnTooltip.textContent = 'Select & Delete';
    if (DOM.redDeleteBtn) DOM.redDeleteBtn.classList.remove('ring-4', 'ring-red-300');
  }
}

function exitSelectionMode() {
  STATE.isSelectionMode = false;
  STATE.selectedCardIds.clear();
  updateSelectionUI();
  renderCards();
}

// ==========================================
// 5. High-Accuracy Parser (Handles Real WhatsApp Notices)
// ==========================================

function extractWithHeuristicParser(text) {
  if (!text || typeof text !== 'string') {
    return {
      title: 'Event Notice',
      venue: 'Main Campus',
      time: '10:00 AM',
      date: getFormattedDateOffset(2),
      summary: 'Event announced via notice.'
    };
  }

  const rawLines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  const today = new Date();

  // ==========================================
  // A. VENUE EXTRACTION (Explicit Line Target)
  // ==========================================
  let venue = '';

  for (const line of rawLines) {
    // Check if line contains Venue, Location, Place, or 📍
    if (/(?:📍|🗺️|\bvenue\b|\blocation\b|\bplace\b)/i.test(line)) {
      let cleaned = line
        .replace(/^[📍🗺️\s*#-]*/g, '')
        .replace(/^(?:venue|location|place)\s*[:\-]?\s*/i, '')
        .replace(/^[📍🗺️\s*#-]*/g, '')
        .replace(/[*#_]+$/g, '')
        .trim();

      if (cleaned.length > 2 && !/^(venue|location|place)$/i.test(cleaned)) {
        venue = cleaned;
        break;
      }
    }
  }

  // Fallback venue check
  if (!venue) {
    for (const line of rawLines) {
      if (/(?:auditorium|hall|campus|block|lab|room|ground|center|centre|zoom|google meet|teams)/i.test(line)) {
        let cleaned = line.replace(/^[📍🗺️\s*#-]*/g, '').replace(/[*#_]+$/g, '').trim();
        if (cleaned.length > 3 && cleaned.length < 80) {
          venue = cleaned;
          break;
        }
      }
    }
  }
  if (!venue) venue = 'Main Campus Auditorium';

  // ==========================================
  // B. DATE EXTRACTION (Handles 31st October 2026, Oct 31, DD/MM/YYYY)
  // ==========================================
  let date = '';

  // Look for labeled date line first
  let dateTargetText = '';
  for (const line of rawLines) {
    if (/(?:📅|🗓️|🗓|\bdate\b)/i.test(line)) {
      dateTargetText = line;
      break;
    }
  }
  const dateSearchSources = dateTargetText ? [dateTargetText, text] : [text];

  const monthMap = {
    january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
    july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
    jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
    jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12
  };

  for (const src of dateSearchSources) {
    if (date) break;

    const lowerSrc = src.toLowerCase();
    if (/\btoday\b/.test(lowerSrc)) {
      date = getFormattedDateOffset(0);
      break;
    } else if (/\btomorrow\b/.test(lowerSrc)) {
      date = getFormattedDateOffset(1);
      break;
    } else if (/\bday after tomorrow\b/.test(lowerSrc)) {
      date = getFormattedDateOffset(2);
      break;
    }

    // Pattern 1: Day Month Year e.g. "31st October 2026", "31 Oct 2026", "5th Nov"
    const dayMonthRegex = /\b(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*(?:\s*,?\s*(\d{4}))?\b/i;
    const dmMatch = src.match(dayMonthRegex);
    if (dmMatch) {
      const day = parseInt(dmMatch[1], 10);
      const mStr = dmMatch[2].toLowerCase();
      const monthNum = monthMap[mStr] || monthMap[mStr.substring(0, 3)];
      const year = dmMatch[3] ? parseInt(dmMatch[3], 10) : today.getFullYear();
      if (monthNum && !isNaN(day)) {
        date = `${year}-${String(monthNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        break;
      }
    }

    // Pattern 2: Month Day Year e.g. "October 31st, 2026", "Nov 5, 2026"
    const monthDayRegex = /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s*,?\s*(\d{4}))?\b/i;
    const mdMatch = src.match(monthDayRegex);
    if (mdMatch) {
      const mStr = mdMatch[1].toLowerCase();
      const monthNum = monthMap[mStr] || monthMap[mStr.substring(0, 3)];
      const day = parseInt(mdMatch[2], 10);
      const year = mdMatch[3] ? parseInt(mdMatch[3], 10) : today.getFullYear();
      if (monthNum && !isNaN(day)) {
        date = `${year}-${String(monthNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        break;
      }
    }

    // Pattern 3: Numeric DD/MM/YYYY or YYYY-MM-DD
    const numRegex = /\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b|\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\b/;
    const numMatch = src.match(numRegex);
    if (numMatch) {
      if (numMatch[1]) {
        date = `${numMatch[1]}-${numMatch[2].padStart(2, '0')}-${numMatch[3].padStart(2, '0')}`;
        break;
      } else if (numMatch[4] && numMatch[5] && numMatch[6]) {
        let yr = numMatch[6].length === 2 ? '20' + numMatch[6] : numMatch[6];
        const n1 = parseInt(numMatch[4], 10);
        const n2 = parseInt(numMatch[5], 10);
        if (n2 > 12) {
          // MM/DD/YYYY format
          date = `${yr}-${String(n1).padStart(2, '0')}-${String(n2).padStart(2, '0')}`;
        } else {
          // DD/MM/YYYY format (standard in WhatsApp / colleges)
          date = `${yr}-${String(n2).padStart(2, '0')}-${String(n1).padStart(2, '0')}`;
        }
        break;
      }
    }
  }

  if (!date) {
    date = getFormattedDateOffset(2);
  }

  // ==========================================
  // C. TIME EXTRACTION (Handles Start & End Times, En-Dashes)
  // ==========================================
  let time = '';

  for (const line of rawLines) {
    if (/(?:⏰|\btime\b|\btiming\b|\btimings\b)/i.test(line)) {
      let cleaned = line
        .replace(/^[⏰\s*#-]*/g, '')
        .replace(/^(?:time|timing|timings)\s*[:\-]?\s*/i, '')
        .replace(/^[⏰\s*#-]*/g, '')
        .replace(/[*#_]+$/g, '')
        .trim();

      if (cleaned.length > 2 && !/^(time|timing|timings)$/i.test(cleaned)) {
        time = cleaned;
        break;
      }
    }
  }

  if (!time) {
    // Regex for time range with hyphen, en-dash, em-dash, or 'to'
    const rangeTimeRegex = /\b\d{1,2}(?::\d{2})?\s*(?:am|pm|AM|PM)?\s*(?:[-–—~]|to|till|until)\s*\d{1,2}(?::\d{2})?\s*(?:am|pm|AM|PM)\b/i;
    const rangeMatch = text.match(rangeTimeRegex);
    if (rangeMatch) {
      time = rangeMatch[0].trim();
    } else {
      const singleTimeRegex = /\b\d{1,2}(?::\d{2})?\s*(?:am|pm|AM|PM)\b/i;
      const singleMatch = text.match(singleTimeRegex);
      time = singleMatch ? singleMatch[0].trim() : '10:00 AM - 1:00 PM';
    }
  }

  // Normalize en-dash
  time = time.replace(/[–—]/g, '–');

  // ==========================================
  // D. TITLE EXTRACTION (Smart Event Name Detection)
  // ==========================================
  let title = '';
  const eventKeywords = /\b(buildathon|hackathon|promptwars|summit|symposium|conference|workshop|bootcamp|meetup|orientation|championship|tournament|codeathon|hack|conclave)\b/i;

  let eventNameParts = [];
  for (const line of rawLines) {
    if (/(?:📍|📅|⏰|venue:|date:|time:)/i.test(line)) continue;
    if (/^(are you ready|think beyond|this isn't just|proudly powered|the prompts are|the clock is|it's time to|join us for)/i.test(line)) continue;

    if (eventKeywords.test(line)) {
      let cleanLine = line
        .replace(/[🚨🚀⚡🔥✨🧠💻💡📍📅⏰*#_]/g, '')
        // Remove introductory conversational prefixes from start of line
        .replace(/^(?:get ready for(?:\s+an?)?(?:\s+electrifying)?|welcome to|announcing|introducing|presents?|calling all)\s+/i, '')
        // Remove hype suffixes from the end of the title line
        .replace(/\b(?:is officially here|officially here|is here|here!|now!)\b.*/i, '')
        .replace(/\b(?:where creativity meets|ideas turn into|and your prompts become|where ideas turn)\b.*/i, '')
        .trim();
      
      if (cleanLine.length > 3) {
        eventNameParts.push(cleanLine);
      }
    }
  }

  if (eventNameParts.length > 0) {
    const hasPromptWars = eventNameParts.find(p => /promptwars/i.test(p));
    const hasBuildathon = eventNameParts.find(p => /buildathon|hackathon/i.test(p));

    if (hasPromptWars && hasBuildathon && hasPromptWars !== hasBuildathon) {
      title = `${hasBuildathon.trim()} (${hasPromptWars.trim()})`;
    } else if (hasBuildathon) {
      title = hasBuildathon.trim();
    } else {
      title = eventNameParts[0];
    }
  }

  if (!title) {
    for (const line of rawLines) {
      const boldMatch = line.match(/\*([^*]+)\*/);
      if (boldMatch && boldMatch[1].trim().length > 3) {
        title = boldMatch[1].trim();
        break;
      }
    }
  }

  if (!title) {
    for (const line of rawLines) {
      if (/(?:📍|📅|⏰|venue|date|time)/i.test(line)) continue;
      if (/^(are you ready|the prompts are|proudly powered)/i.test(line)) continue;
      const clean = line.replace(/[🚨🚀⚡🔥✨🧠💻💡📍📅⏰*#_]/g, '').trim();
      if (clean.length > 4 && clean.length < 65) {
        title = clean;
        break;
      }
    }
  }

  if (!title) title = 'Upcoming Campus Event';

  // ==========================================
  // E. SUMMARY EXTRACTION
  // ==========================================
  let summary = '';
  const descriptiveCandidates = rawLines.filter(l => {
    if (/(?:📍|📅|⏰|venue:|date:|time:)/i.test(l)) return false;
    if (l === title) return false;
    if (/^(are you ready|the prompts are ready|proudly powered by)/i.test(l)) return false;
    return l.length > 25;
  });

  if (descriptiveCandidates.length > 0) {
    summary = descriptiveCandidates[0].replace(/[*#_]/g, '').trim();
  } else {
    summary = `Event scheduled at ${venue} on ${date}.`;
  }

  return { title, venue, time, date, summary };
}

// ==========================================
// 6. Extraction Actions (Text & Image)
// ==========================================

async function handleExtractFromText() {
  const rawText = DOM.noticeTextInput ? DOM.noticeTextInput.value.trim() : '';
  if (!rawText) {
    showToast('Please paste a WhatsApp notice or text first!', 'warning');
    return;
  }

  setModalProcessing(true, 'text');

  try {
    let extractedData = null;

    if (STATE.geminiApiKey) {
      extractedData = await extractWithGeminiText(rawText);
    } else {
      await new Promise(r => setTimeout(r, 350));
      extractedData = extractWithHeuristicParser(rawText);
    }

    if (extractedData) {
      const newCard = {
        id: 'ev_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        title: String(extractedData.title || 'Untitled Event').trim(),
        date: String(extractedData.date || getFormattedDateOffset(2)).trim(),
        time: String(extractedData.time || '10:00 AM').trim(),
        venue: String(extractedData.venue || 'Venue TBD').trim(),
        summary: String(extractedData.summary || 'Event notice details extracted.').trim(),
        createdAt: new Date().toISOString()
      };

      STATE.events.unshift(newCard);
      saveEventsToStorage();

      resetFiltersToAll();
      renderCards();

      showToast(`Event card created: "${newCard.title}"!`, 'success');

      if (DOM.noticeTextInput) DOM.noticeTextInput.value = '';
      if (DOM.textModal) DOM.textModal.classList.add('hidden');
    }
  } catch (err) {
    console.error('Text extraction error, using fallback:', err);
    const fallback = extractWithHeuristicParser(rawText || 'Event Notice');
    const newCard = {
      id: 'ev_' + Date.now(),
      title: String(fallback.title || 'Event Notice'),
      date: String(fallback.date || getFormattedDateOffset(2)),
      time: String(fallback.time || '10:00 AM'),
      venue: String(fallback.venue || 'Campus'),
      summary: String(fallback.summary || 'Event details extracted.'),
      createdAt: new Date().toISOString()
    };
    STATE.events.unshift(newCard);
    saveEventsToStorage();
    resetFiltersToAll();
    renderCards();
    if (DOM.textModal) DOM.textModal.classList.add('hidden');
  } finally {
    setModalProcessing(false, 'text');
  }
}

// ==========================================
// Tesseract.js OCR — In-Browser Image Scanning (No API Key Required)
// ==========================================

async function extractWithTesseract(base64Data, mimeType) {
  if (typeof Tesseract === 'undefined') {
    throw new Error('Tesseract.js is not loaded. Check your internet connection.');
  }

  const dataUrl = `data:${mimeType || 'image/png'};base64,${base64Data}`;

  // Tesseract progress callback — updates the progress bar in the modal
  const progressFn = (p) => {
    try {
      const progressText = document.getElementById('imageProgressText');
      const progressPct = document.getElementById('imageProgressPct');
      const progressFill = document.getElementById('imageProgressFill');

      const pct = Math.round((p.progress || 0) * 100);
      const statusMap = {
        'loading tesseract core': 'Loading OCR engine...',
        'initializing tesseract': 'Initialising...',
        'loading language traineddata': 'Loading English language model...',
        'initializing api': 'Starting up...',
        'recognizing text': `Reading text from image... ${pct}%`,
      };
      const label = statusMap[p.status] || (p.status ? p.status.charAt(0).toUpperCase() + p.status.slice(1) + '...' : 'Processing...');

      if (progressText) progressText.innerHTML = `<i data-lucide="loader-2" class="w-3.5 h-3.5 animate-spin inline-block mr-1"></i>${label}`;
      if (progressPct) progressPct.textContent = `${pct}%`;
      if (progressFill) progressFill.style.width = `${pct}%`;
      if (window.lucide) window.lucide.createIcons();
    } catch (e) { /* ignore UI update errors */ }
  };

  const result = await Tesseract.recognize(dataUrl, 'eng', { logger: progressFn });
  const rawText = result.data.text || '';

  if (!rawText.trim() || rawText.trim().length < 10) {
    throw new Error('OCR could not read any text from this image. Try a clearer, higher-contrast flyer.');
  }

  // Feed the OCR'd text straight into the existing WhatsApp/notice heuristic parser
  return extractWithHeuristicParser(rawText);
}

async function handleExtractFromImage() {
  if (!STATE.currentImageBase64) {
    showToast('Please choose or paste an image flyer first!', 'warning');
    return;
  }

  setModalProcessing(true, 'image');

  try {
    let extractedData = null;

    if (STATE.geminiApiKey) {
      // Gemini vision — fast, smart, handles complex layouts
      const progressText = document.getElementById('imageProgressText');
      if (progressText) progressText.innerHTML = '<i data-lucide="loader-2" class="w-3.5 h-3.5 animate-spin inline-block mr-1"></i>Sending to Gemini vision scanner...';
      const progressPct = document.getElementById('imageProgressPct');
      if (progressPct) progressPct.textContent = '';
      const progressFill = document.getElementById('imageProgressFill');
      if (progressFill) progressFill.style.width = '60%';

      extractedData = await extractWithGeminiMultimodal(STATE.currentImageBase64, STATE.currentImageMimeType);
    } else {
      // Tesseract.js — free, local OCR, no API key needed
      extractedData = await extractWithTesseract(STATE.currentImageBase64, STATE.currentImageMimeType);
    }

    if (extractedData) {
      const newCard = {
        id: 'ev_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        title: String(extractedData.title || 'Flyer Event').trim(),
        date: String(extractedData.date || getFormattedDateOffset(2)).trim(),
        time: String(extractedData.time || 'Time TBC').trim(),
        venue: String(extractedData.venue || 'Venue TBC').trim(),
        summary: String(extractedData.summary || 'Event details extracted from flyer.').trim(),
        createdAt: new Date().toISOString()
      };

      STATE.events.unshift(newCard);
      saveEventsToStorage();
      resetFiltersToAll();
      renderCards();

      const engine = STATE.geminiApiKey ? 'Gemini' : 'OCR';
      showToast(`Card created from flyer via ${engine}! Check and edit if needed.`, 'success');

      clearImageInput();
      if (DOM.imageModal) DOM.imageModal.classList.add('hidden');

      // Open the edit modal so the user can verify/correct the extracted details
      setTimeout(() => window.editEvent(newCard.id), 300);
    }
  } catch (err) {
    console.error('Image extraction error:', err);
    const msg = err && err.message ? err.message : '';
    if (msg.toLowerCase().includes('api key') || msg.includes('401') || msg.includes('403')) {
      showToast('API key error — check your Gemini key in Settings.', 'error');
    } else if (msg.toLowerCase().includes('ocr') || msg.toLowerCase().includes('text')) {
      showToast(msg, 'warning');
    } else {
      showToast('Could not scan image. Try a clearer photo or paste the text manually.', 'error');
    }
  } finally {
    setModalProcessing(false, 'image');
    // Reset progress bar
    const progressFill = document.getElementById('imageProgressFill');
    if (progressFill) progressFill.style.width = '0%';
    const progressPct = document.getElementById('imageProgressPct');
    if (progressPct) progressPct.textContent = '0%';
  }
}

function setModalProcessing(isProcessing, type) {
  if (type === 'text') {
    if (DOM.modalProgressBar) DOM.modalProgressBar.classList.toggle('hidden', !isProcessing);
    if (DOM.submitTextModalBtn) DOM.submitTextModalBtn.disabled = isProcessing;
  } else if (type === 'image') {
    if (DOM.imageProgressBar) DOM.imageProgressBar.classList.toggle('hidden', !isProcessing);
    if (DOM.submitImageModalBtn) {
      DOM.submitImageModalBtn.disabled = isProcessing;
      DOM.submitImageModalBtn.classList.toggle('opacity-60', isProcessing);
      DOM.submitImageModalBtn.classList.toggle('cursor-not-allowed', isProcessing);
    }
    const cancelBtn = document.getElementById('cancelImageModalBtn');
    if (cancelBtn) cancelBtn.disabled = isProcessing;
  }
}

function resetFiltersToAll() {
  STATE.activeFilter = 'all';
  STATE.searchQuery = '';
  if (DOM.searchInput) DOM.searchInput.value = '';

  document.querySelectorAll('.filter-tab').forEach(t => {
    if (t.getAttribute('data-filter') === 'all') {
      t.classList.add('active', 'bg-slate-900', 'text-white');
      t.classList.remove('text-slate-600');
    } else {
      t.classList.remove('active', 'bg-slate-900', 'text-white');
      t.classList.add('text-slate-600');
    }
  });
}

async function extractWithGeminiText(text) {
  const apiKey = STATE.geminiApiKey;
  const todayStr = getTodayISO();

  const prompt = `Extract event details from this WhatsApp notice / text.
Today's reference date on the device is ${todayStr}.
Extract the following fields and return ONLY a strict valid JSON object:
{
  "title": "Concise, clean event title",
  "venue": "Location, room, auditorium, platform, or link",
  "date": "YYYY-MM-DD format (if relative like 'tomorrow', calculate based on today ${todayStr})",
  "time": "Event time or time range with both start and end time (e.g. '9:00 AM – 5:00 PM')",
  "summary": "Short 1-2 sentence highlight/summary of what the event is about"
}

Notice text:
${text}`;

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: 'application/json'
      }
    })
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || 'Parser request failed');
  }

  const data = await response.json();
  const rawContent = data.candidates?.[0]?.content?.parts?.[0]?.text;
  return cleanAndParseJson(rawContent);
}

async function extractWithGeminiMultimodal(base64Data, mimeType) {
  const apiKey = STATE.geminiApiKey;
  const todayStr = getTodayISO();

  const prompt = `Extract event details from this notice flyer / screenshot image.
Today's reference date on the device is ${todayStr}.
Extract the following fields and return ONLY a strict valid JSON object:
{
  "title": "Event title from the flyer",
  "venue": "Venue, campus, auditorium, room, or platform",
  "date": "YYYY-MM-DD format (calculate based on today ${todayStr} if relative)",
  "time": "Event time or time range (e.g. '9:00 AM – 5:00 PM')",
  "summary": "Short 1-2 sentence summary of what the event is about"
}`;

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: prompt },
          {
            inline_data: {
              mime_type: mimeType || 'image/png',
              data: base64Data
            }
          }
        ]
      }],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: 'application/json'
      }
    })
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || 'Vision parser request failed');
  }

  const data = await response.json();
  const rawContent = data.candidates?.[0]?.content?.parts?.[0]?.text;
  return cleanAndParseJson(rawContent);
}

function cleanAndParseJson(str) {
  if (!str) return null;
  let cleaned = String(str).replace(/```json/gi, '').replace(/```/g, '').trim();
  return JSON.parse(cleaned);
}

function getTodayISO() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getFormattedDateOffset(offsetDays) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// ==========================================
// 7. Demo Cards & Sample Notices
// ==========================================

function loadDemoCards() {
  const now = new Date();
  
  STATE.events = [
    {
      id: 'demo_green',
      title: '🌐 Web Innovation Summit 2026',
      date: getFormattedDateOffset(3), // 3 days in future -> GREEN HEARTS (♥)
      time: '09:30 AM – 04:30 PM',
      venue: 'Tech Park Convention Center, Hall B',
      summary: 'Explore breakthroughs in real-time edge computing, distributed apps, and full-stack architecture with keynote speakers and live panels.',
      createdAt: now.toISOString()
    },
    {
      id: 'demo_yellow',
      title: '⚡ Full-Stack Developer Hack Bootcamp',
      date: getFormattedDateOffset(1), // Tomorrow -> YELLOW CLUBS (♣)
      time: '11:00 AM – 02:00 PM',
      venue: 'Innovation Hub, Lab 4 & Zoom',
      summary: 'Hands-on intensive workshop on building and deploying client-side web applications with instant GitHub Pages hosting.',
      createdAt: now.toISOString()
    },
    {
      id: 'demo_red',
      title: '🔥 Annual Grand Hackathon: Demo Day',
      date: getFormattedDateOffset(0), // Today -> RED DIAMONDS (♦)
      time: '10:00 AM – 06:00 PM',
      venue: 'Main University Auditorium',
      summary: 'Happening today! Live pitches, product demonstrations, project judging, and award ceremony. All participants report to Stage 1.',
      createdAt: now.toISOString()
    },
    {
      id: 'demo_black',
      title: '📋 Pre-Hackathon Orientation & Team Sync',
      date: getFormattedDateOffset(-2), // 2 days ago -> BLACK SPADES (♠)
      time: '04:00 PM – 05:30 PM',
      venue: 'Seminar Hall 3',
      summary: 'Orientation session regarding team formation, rulebook clarification, submission guidelines, and event logistics.',
      createdAt: now.toISOString()
    }
  ];

  saveEventsToStorage();
  resetFiltersToAll();
  renderCards();
  showToast('4 demo cards loaded (♥, ♣, ♦, ♠)!', 'success');
}

function loadSampleNotice(type) {
  if (type === 'green') {
    if (DOM.noticeTextInput) DOM.noticeTextInput.value = `📢 *TECH MEETUP & NETWORKING 2026*
🗓 Date: ${formatDisplayDate(getFormattedDateOffset(4))}
⏰ Time: 3:00 PM – 6:00 PM
📍 Venue: Open Source Hall, Silicon Tower
Join fellow developers, designers, and founders for deep tech talks, lightning demos, and snacks. Registration is free for all attendees!`;
  } else if (type === 'tomorrow') {
    if (DOM.noticeTextInput) DOM.noticeTextInput.value = `⚡ *HANDS-ON DOCKER & CLOUD WORKSHOP*
Tomorrow at 11:00 AM – 1:30 PM
📍 Venue: Computer Lab 204, Engineering Wing
Don't forget to bring your laptops with Docker Desktop pre-installed. We will be deploying containers and microservices from scratch!`;
  } else if (type === 'today') {
    if (DOM.noticeTextInput) DOM.noticeTextInput.value = `🚨 *URGENT: CODE-A-THON ROUND 2 IS TODAY!*
Today at 2:00 PM – 6:00 PM
Venue: Central Seminar Auditorium
All qualified teams must report with their student ID cards and final prototypes. Judging begins promptly at 2:15 PM!`;
  }
}

// ==========================================
// 8. Clipboard & Image Dropzone Handlers
// ==========================================

function setupClipboardPaste() {
  window.addEventListener('paste', (e) => {
    try {
      const items = (e.clipboardData || e.originalEvent.clipboardData)?.items;
      if (!items) return;

      for (const item of items) {
        if (item.type && item.type.indexOf('image') !== -1) {
          const file = item.getAsFile();
          handleSelectedImage(file);
          if (DOM.imageModal) DOM.imageModal.classList.remove('hidden');
          showToast('Image pasted from clipboard!', 'success');
          break;
        }
      }
    } catch (err) {
      console.warn('Clipboard paste handling error:', err);
    }
  });
}

function handleSelectedImage(file) {
  if (!file) return;

  STATE.currentImageFile = file;
  STATE.currentImageMimeType = file.type || 'image/png';
  if (DOM.modalImageFileName) DOM.modalImageFileName.textContent = file.name || 'clipboard-screenshot.png';
  if (DOM.modalImageFileSize) DOM.modalImageFileSize.textContent = (file.size / 1024).toFixed(1) + ' KB';

  const reader = new FileReader();
  reader.onload = function(e) {
    const result = e.target.result;
    if (DOM.modalImagePreview) DOM.modalImagePreview.src = result;
    if (result && result.includes(',')) {
      STATE.currentImageBase64 = result.split(',')[1];
    }
    
    if (DOM.modalDropzone) DOM.modalDropzone.classList.add('hidden');
    if (DOM.modalImagePreviewContainer) {
      DOM.modalImagePreviewContainer.classList.remove('hidden');
      DOM.modalImagePreviewContainer.classList.add('flex');
    }
  };
  reader.readAsDataURL(file);
}

function clearImageInput() {
  STATE.currentImageBase64 = null;
  STATE.currentImageMimeType = null;
  STATE.currentImageFile = null;
  if (DOM.modalImageFileInput) DOM.modalImageFileInput.value = '';
  if (DOM.modalImagePreview) DOM.modalImagePreview.src = '';
  if (DOM.modalDropzone) DOM.modalDropzone.classList.remove('hidden');
  if (DOM.modalImagePreviewContainer) {
    DOM.modalImagePreviewContainer.classList.add('hidden');
    DOM.modalImagePreviewContainer.classList.remove('flex');
  }
}

// ==========================================
// 9. Single Event Card Actions
// ==========================================

window.deleteEvent = function(id) {
  if (confirm('Are you sure you want to delete this event card?')) {
    STATE.events = STATE.events.filter(e => e && e.id !== id);
    saveEventsToStorage();
    renderCards();
    showToast('Event card deleted.', 'info');
  }
};

window.editEvent = function(id) {
  const event = STATE.events.find(e => e && e.id === id);
  if (!event) return;

  if (DOM.editCardId) DOM.editCardId.value = event.id || '';
  if (DOM.editTitle) DOM.editTitle.value = event.title || '';
  if (DOM.editDate) DOM.editDate.value = event.date || '';
  if (DOM.editTime) DOM.editTime.value = event.time || '';
  if (DOM.editVenue) DOM.editVenue.value = event.venue || '';
  if (DOM.editSummary) DOM.editSummary.value = event.summary || '';

  if (DOM.cardModal) DOM.cardModal.classList.remove('hidden');
};

window.copyEventDetails = function(id) {
  const event = STATE.events.find(e => e && e.id === id);
  if (!event) return;

  const status = getEventStatus(event.date, event.time);
  const textToCopy = `${status.suit} *${event.title || 'Event'}*
🗓 Date: ${formatDisplayDate(event.date)}
⏰ Time: ${event.time || ''}
📍 Venue: ${event.venue || ''}
📝 Summary: ${event.summary || ''}`;

  navigator.clipboard.writeText(textToCopy).then(() => {
    showToast('Event details copied to clipboard!', 'success');
  }).catch(() => {
    showToast('Failed to copy to clipboard', 'error');
  });
};

function handleSaveEditForm(e) {
  e.preventDefault();
  const id = DOM.editCardId ? DOM.editCardId.value : '';
  const eventIndex = STATE.events.findIndex(ev => ev && ev.id === id);

  if (eventIndex !== -1) {
    STATE.events[eventIndex].title = DOM.editTitle ? DOM.editTitle.value.trim() : '';
    STATE.events[eventIndex].date = DOM.editDate ? DOM.editDate.value : '';
    STATE.events[eventIndex].time = DOM.editTime ? DOM.editTime.value.trim() : '';
    STATE.events[eventIndex].venue = DOM.editVenue ? DOM.editVenue.value.trim() : '';
    STATE.events[eventIndex].summary = DOM.editSummary ? DOM.editSummary.value.trim() : '';

    saveEventsToStorage();
    renderCards();
    if (DOM.cardModal) DOM.cardModal.classList.add('hidden');
    showToast('Card updated successfully!', 'success');
  }
}

// ==========================================
// 10. Settings Management
// ==========================================

function updateApiKeyStatusUI() {
  if (STATE.geminiApiKey) {
    if (DOM.apiKeyStatusDot) DOM.apiKeyStatusDot.className = 'w-2 h-2 rounded-full bg-emerald-500';
  } else {
    if (DOM.apiKeyStatusDot) DOM.apiKeyStatusDot.className = 'w-2 h-2 rounded-full bg-slate-400';
  }
}

function handleSaveApiKey() {
  const key = DOM.apiKeyInput ? DOM.apiKeyInput.value.trim() : '';
  if (key) {
    STATE.geminiApiKey = key;
    localStorage.setItem('campuspulse_gemini_key', key);
    updateApiKeyStatusUI();
    if (DOM.apiKeyModal) DOM.apiKeyModal.classList.add('hidden');
    showToast('Settings saved successfully!', 'success');
  }
}

function handleClearApiKey() {
  STATE.geminiApiKey = '';
  localStorage.removeItem('campuspulse_gemini_key');
  localStorage.removeItem('organaize_gemini_key');
  localStorage.removeItem('noticepulse_gemini_key');
  if (DOM.apiKeyInput) DOM.apiKeyInput.value = '';
  updateApiKeyStatusUI();
  if (DOM.apiKeyModal) DOM.apiKeyModal.classList.add('hidden');
  showToast('Settings reset to built-in parser.', 'info');
}

function updateImageModalKeyUI() {
  const noKeyWarning = document.getElementById('imageNoKeyWarning');
  const manualBtn = document.getElementById('imageManualFillBtn');
  const submitBtn = DOM.submitImageModalBtn;

  if (!STATE.geminiApiKey) {
    if (noKeyWarning) noKeyWarning.classList.remove('hidden');
    if (manualBtn) manualBtn.classList.remove('hidden');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.classList.add('opacity-50', 'cursor-not-allowed');
    }
  } else {
    if (noKeyWarning) noKeyWarning.classList.add('hidden');
    if (manualBtn) manualBtn.classList.add('hidden');
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    }
  }
}

// ==========================================
// 11. Event Listeners Setup
// ==========================================

function setupEventListeners() {
  // Green Add Button & Popover
  if (DOM.greenAddBtn) {
    DOM.greenAddBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (DOM.addPopover) DOM.addPopover.classList.toggle('hidden');
    });
  }

  // Popover Options
  if (DOM.popoverTextOption) {
    DOM.popoverTextOption.addEventListener('click', () => {
      if (DOM.addPopover) DOM.addPopover.classList.add('hidden');
      if (DOM.textModal) DOM.textModal.classList.remove('hidden');
      if (DOM.noticeTextInput) DOM.noticeTextInput.focus();
    });
  }

  if (DOM.popoverImageOption) {
    DOM.popoverImageOption.addEventListener('click', () => {
      if (DOM.addPopover) DOM.addPopover.classList.add('hidden');
      if (DOM.imageModal) DOM.imageModal.classList.remove('hidden');
      // Show/hide the no-key warning and manual fill button based on current key status
      updateImageModalKeyUI();
    });
  }

  // Close popover when clicking anywhere outside
  document.addEventListener('click', (e) => {
    if (DOM.addPopover && !DOM.addPopover.classList.contains('hidden')) {
      if (!DOM.addPopover.contains(e.target) && !DOM.greenAddBtn.contains(e.target)) {
        DOM.addPopover.classList.add('hidden');
      }
    }
  });

  // Red Delete Button (Selection Mode)
  if (DOM.redDeleteBtn) {
    DOM.redDeleteBtn.addEventListener('click', handleRedDeleteBtnClick);
  }

  if (DOM.cancelSelectionBtn) {
    DOM.cancelSelectionBtn.addEventListener('click', exitSelectionMode);
  }

  // Text Modal Events
  if (DOM.closeTextModalBtn) DOM.closeTextModalBtn.addEventListener('click', () => DOM.textModal.classList.add('hidden'));
  if (DOM.cancelTextModalBtn) DOM.cancelTextModalBtn.addEventListener('click', () => DOM.textModal.classList.add('hidden'));
  if (DOM.clearTextModalBtn) {
    DOM.clearTextModalBtn.addEventListener('click', () => {
      if (DOM.noticeTextInput) DOM.noticeTextInput.value = '';
    });
  }
  if (DOM.submitTextModalBtn) DOM.submitTextModalBtn.addEventListener('click', handleExtractFromText);

  // Sample Buttons in Text Modal
  if (DOM.sampleNotice1) DOM.sampleNotice1.addEventListener('click', () => loadSampleNotice('green'));
  if (DOM.sampleNotice2) DOM.sampleNotice2.addEventListener('click', () => loadSampleNotice('tomorrow'));
  if (DOM.sampleNotice3) DOM.sampleNotice3.addEventListener('click', () => loadSampleNotice('today'));

  // Image Modal Events
  if (DOM.closeImageModalBtn) DOM.closeImageModalBtn.addEventListener('click', () => { DOM.imageModal.classList.add('hidden'); clearImageInput(); });
  if (DOM.cancelImageModalBtn) DOM.cancelImageModalBtn.addEventListener('click', () => { DOM.imageModal.classList.add('hidden'); clearImageInput(); });
  if (DOM.submitImageModalBtn) DOM.submitImageModalBtn.addEventListener('click', handleExtractFromImage);

  // "Fill Manually" button — opens blank edit modal so user can type details
  const imageManualFillBtn = document.getElementById('imageManualFillBtn');
  if (imageManualFillBtn) {
    imageManualFillBtn.addEventListener('click', () => {
      if (DOM.imageModal) DOM.imageModal.classList.add('hidden');
      clearImageInput();
      // Pre-populate a blank card and open the edit modal
      const blankCard = {
        id: 'ev_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        title: '',
        date: getFormattedDateOffset(2),
        time: '',
        venue: '',
        summary: '',
        createdAt: new Date().toISOString()
      };
      STATE.events.unshift(blankCard);
      saveEventsToStorage();
      resetFiltersToAll();
      renderCards();
      // Open edit modal for this new card
      window.editEvent(blankCard.id);
      showToast('Fill in the event details from the flyer.', 'info');
    });
  }

  // Show/hide the image modal warning & manual fill button whenever the modal opens
  const imageModalEl = document.getElementById('imageModal');
  if (imageModalEl) {
    const observer = new MutationObserver(() => {
      if (!imageModalEl.classList.contains('hidden')) {
        updateImageModalKeyUI();
      }
    });
    observer.observe(imageModalEl, { attributes: true, attributeFilter: ['class'] });
  }

  if (DOM.modalDropzone) {
    DOM.modalDropzone.addEventListener('click', () => {
      if (DOM.modalImageFileInput) DOM.modalImageFileInput.click();
    });
    DOM.modalDropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      DOM.modalDropzone.classList.add('border-emerald-500', 'bg-emerald-50');
    });
    DOM.modalDropzone.addEventListener('dragleave', (e) => {
      e.preventDefault();
      DOM.modalDropzone.classList.remove('border-emerald-500', 'bg-emerald-50');
    });
    DOM.modalDropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      DOM.modalDropzone.classList.remove('border-emerald-500', 'bg-emerald-50');
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleSelectedImage(e.dataTransfer.files[0]);
      }
    });
  }

  if (DOM.modalImageFileInput) {
    DOM.modalImageFileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        handleSelectedImage(e.target.files[0]);
      }
    });
  }

  if (DOM.modalRemoveImageBtn) DOM.modalRemoveImageBtn.addEventListener('click', clearImageInput);

  // Filter tabs
  document.querySelectorAll('.filter-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.filter-tab').forEach(t => {
        t.classList.remove('active', 'bg-slate-900', 'text-white');
        t.classList.add('text-slate-600');
      });
      tab.classList.add('active', 'bg-slate-900', 'text-white');
      tab.classList.remove('text-slate-600');
      
      STATE.activeFilter = tab.getAttribute('data-filter') || 'all';
      renderCards();
    });
  });

  if (DOM.searchInput) {
    DOM.searchInput.addEventListener('input', (e) => {
      STATE.searchQuery = e.target.value;
      renderCards();
    });
  }

  if (DOM.loadDemoBtn) DOM.loadDemoBtn.addEventListener('click', loadDemoCards);
  if (DOM.emptyLoadDemoBtn) DOM.emptyLoadDemoBtn.addEventListener('click', loadDemoCards);

  // Edit Modal
  if (DOM.cardEditForm) DOM.cardEditForm.addEventListener('submit', handleSaveEditForm);
  if (DOM.closeModalBtn) DOM.closeModalBtn.addEventListener('click', () => DOM.cardModal.classList.add('hidden'));
  if (DOM.cancelModalBtn) DOM.cancelModalBtn.addEventListener('click', () => DOM.cardModal.classList.add('hidden'));

  // Settings Modal
  if (DOM.openApiKeyBtn) {
    DOM.openApiKeyBtn.addEventListener('click', () => {
      if (DOM.apiKeyInput) DOM.apiKeyInput.value = STATE.geminiApiKey || '';
      if (DOM.apiKeyModal) DOM.apiKeyModal.classList.remove('hidden');
    });
  }
  if (DOM.closeApiKeyModalBtn) DOM.closeApiKeyModalBtn.addEventListener('click', () => DOM.apiKeyModal.classList.add('hidden'));
  if (DOM.saveApiKeyBtn) DOM.saveApiKeyBtn.addEventListener('click', handleSaveApiKey);
  if (DOM.clearApiKeyBtn) DOM.clearApiKeyBtn.addEventListener('click', handleClearApiKey);
}

function showToast(message, type = 'info') {
  if (!DOM.toastContainer) return;
  const toast = document.createElement('div');
  const colors = {
    info: 'bg-white border-slate-200 text-slate-800 shadow-lg',
    success: 'bg-emerald-50 border-emerald-300 text-emerald-900 shadow-lg',
    warning: 'bg-amber-50 border-amber-300 text-amber-900 shadow-lg',
    error: 'bg-red-50 border-red-300 text-red-900 shadow-lg'
  };

  const icons = {
    info: 'info',
    success: 'check-circle-2',
    warning: 'alert-triangle',
    error: 'alert-octagon'
  };

  toast.className = `flex items-center space-x-2 px-4 py-2.5 rounded-xl border text-xs shadow-xl backdrop-blur-md transform transition-all duration-300 translate-y-2 opacity-0 pointer-events-auto font-medium ${colors[type] || colors.info}`;
  toast.innerHTML = `
    <i data-lucide="${icons[type] || 'info'}" class="w-4 h-4 shrink-0"></i>
    <span>${escapeHtml(message)}</span>
  `;

  DOM.toastContainer.appendChild(toast);
  if (window.lucide) window.lucide.createIcons();

  setTimeout(() => {
    toast.classList.remove('translate-y-2', 'opacity-0');
  }, 10);

  setTimeout(() => {
    toast.classList.add('translate-y-2', 'opacity-0');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
}

function saveEventsToStorage() {
  try {
    localStorage.setItem('campuspulse_events_v1', JSON.stringify(STATE.events));
  } catch (e) {
    console.error('Failed to save events to storage:', e);
  }
}

function loadEventsFromStorage() {
  try {
    const saved = localStorage.getItem('campuspulse_events_v1') || localStorage.getItem('organaize_events_v2') || localStorage.getItem('noticepulse_events_v1');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        STATE.events = parsed
          .filter(e => e && typeof e === 'object')
          .map(e => ({
            id: String(e.id || ('ev_' + Math.random().toString(36).substr(2, 6))),
            title: String(e.title || 'Untitled Event'),
            date: String(e.date || getFormattedDateOffset(2)),
            time: String(e.time || '10:00 AM'),
            venue: String(e.venue || 'Venue TBD'),
            summary: String(e.summary || 'Event notice details.'),
            createdAt: e.createdAt || new Date().toISOString()
          }));
        return;
      }
    }
    STATE.events = [];
  } catch (e) {
    console.error('Failed to parse saved events:', e);
    STATE.events = [];
  }
}

document.addEventListener('DOMContentLoaded', initApp);
