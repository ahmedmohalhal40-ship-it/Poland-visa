import { DOCUMENT_DATABASE, CATEGORY_DEFINITIONS } from './data.js';
import { translations } from './translations.js';
import { getInitialState, normalizeState, computeVisibleDocuments, getDynamicPriority, getCategoryProgress, getProgressStats, getRecommendation, getTimelineItems, getEstimatedCompletionDate, applyConditionalAnswers } from './state.js';
import { loadAppState, saveAppState, exportBackup, importBackup, safeStorage } from './storage.js';
import { buildPlanner, getPlannerExplanation } from './planner.js';
import { getStatsSummary } from './statistics.js';
import { renderShareCard, downloadShareCard } from './share.js';
import { initializePwa } from './pwa.js';

const appState = normalizeState(loadAppState());
const views = ['dashboard', 'documents', 'planner', 'timeline', 'statistics', 'settings'];
let activeView = appState.activeView || 'dashboard';
let currentDocument = null;
let pendingConditionAnswers = [];

const elements = {
  navButtons: Array.from(document.querySelectorAll('.nav-btn')),
  viewPanels: Array.from(document.querySelectorAll('.view-panel')),
  languageSelect: document.getElementById('languageSelect'),
  themeToggle: document.getElementById('themeToggle'),
  installButton: document.getElementById('installButton'),
  modal: document.getElementById('detailModal'),
  modalContent: document.getElementById('modalContent'),
  closeModal: document.getElementById('closeModal'),
  conditionModal: document.getElementById('conditionModal'),
  conditionForm: document.getElementById('conditionForm'),
  toast: document.getElementById('toast')
};

function init() {
  initializePwa(elements.installButton);
  bindEvents();
  applyTheme(appState.theme);
  applyLanguage(appState.lang);
  ensureConditionalQuestions();
  render();
}

function bindEvents() {
  elements.navButtons.forEach((btn) => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
  });

  elements.languageSelect.addEventListener('change', (event) => {
    appState.lang = event.target.value;
    applyLanguage(appState.lang);
    saveAppState(appState);
    render();
  });

  elements.themeToggle.addEventListener('click', () => {
    appState.theme = appState.theme === 'dark' ? 'light' : 'dark';
    applyTheme(appState.theme);
    saveAppState(appState);
    render();
  });

  elements.closeModal.addEventListener('click', closeModal);
  elements.modal.addEventListener('click', (event) => {
    if (event.target === elements.modal) closeModal();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeModal();
  });

  document.addEventListener('click', (event) => {
    const card = event.target.closest('[data-doc-id]');
    if (card) {
      const id = card.dataset.docId;
      openDocumentModal(id);
    }
  });

  document.addEventListener('submit', (event) => {
    if (event.target.id === 'plannerForm') {
      event.preventDefault();
      const form = event.target;
      const formData = new FormData(form);
      appState.planner = {
        workSchedule: formData.get('workSchedule') || '',
        workingDays: formData.get('workingDays') || '',
        workingHours: formData.get('workingHours') || '',
        appointmentDate: formData.get('appointmentDate') || '',
        travelDate: formData.get('travelDate') || ''
      };
      saveAppState(appState);
      render();
      showToast(getText('plannerSaved'));
    }

    if (event.target.id === 'conditionForm') {
      event.preventDefault();
      const form = event.target;
      const answers = {};
      pendingConditionAnswers.forEach((field) => {
        answers[field] = form.elements[field]?.value === 'yes';
      });
      appState.conditionalAnswers = { ...appState.conditionalAnswers, ...answers };
      saveAppState(appState);
      closeConditionModal();
      render();
      showToast(getText('conditionalSaved'));
    }
  });

  document.addEventListener('click', (event) => {
    const toggle = event.target.closest('[data-toggle-doc]');
    if (toggle) {
      const id = toggle.dataset.toggleDoc;
      toggleCompletion(id);
    }
  });

  document.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-action="search-online"]');
    if (btn) {
      const query = btn.dataset.query || 'Poland National Visa D Erasmus Egypt';
      window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}`, '_blank', 'noopener');
    }
  });

  document.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-action="maps"]');
    if (btn) {
      const query = btn.dataset.query || 'Poland Embassy Egypt';
      window.open(`https://www.google.com/maps/search/${encodeURIComponent(query)}`, '_blank', 'noopener');
    }
  });

  document.addEventListener('input', (event) => {
    if (event.target.id === 'documentSearch') {
      appState.searchTerm = event.target.value;
      saveAppState(appState);
      render();
    }
  });

  document.addEventListener('change', (event) => {
    if (event.target.name === 'filterStatus') {
      appState.filterStatus = event.target.value;
      saveAppState(appState);
      render();
    }
  });

  document.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-share-progress]');
    if (btn) {
      const card = document.getElementById('shareCanvasCard');
      if (card) {
        renderShareCard(card, appState, DOCUMENT_DATABASE, getProgressStats(appState, DOCUMENT_DATABASE));
        downloadShareCard();
      }
    }
  });

  document.addEventListener('click', (event) => {
    const reset = event.target.closest('[data-action="reset-progress"]');
    if (reset) {
      appState.completedIds = [];
      appState.conditionalAnswers = {};
      appState.planner = {};
      appState.searchTerm = '';
      appState.filterStatus = 'all';
      saveAppState(appState);
      render();
      showToast(getText('progressReset'));
    }
  });

  document.addEventListener('click', (event) => {
    const importBtn = event.target.closest('[data-action="import-backup"]');
    if (importBtn) {
      document.getElementById('backupInput').click();
    }
  });

  document.getElementById('backupInput')?.addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const imported = await importBackup(file);
      Object.assign(appState, imported);
      saveAppState(appState);
      render();
      showToast(getText('backupImported'));
    } catch (error) {
      showToast(getText('backupImportError'));
    }
    event.target.value = '';
  });

  document.addEventListener('click', (event) => {
    const exportBtn = event.target.closest('[data-action="export-backup"]');
    if (exportBtn) {
      exportBackup(appState, DOCUMENT_DATABASE);
      showToast(getText('backupExported'));
    }
  });

  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-category-toggle]');
    if (trigger) {
      const key = trigger.dataset.categoryToggle;
      appState.openCategories = appState.openCategories || {};
      appState.openCategories[key] = !appState.openCategories[key];
      saveAppState(appState);
      render();
    }
  });
}

function switchView(view) {
  activeView = view;
  appState.activeView = view;
  saveAppState(appState);
  elements.navButtons.forEach((btn) => btn.classList.toggle('active', btn.dataset.view === view));
  elements.viewPanels.forEach((panel) => panel.classList.toggle('active', panel.id === `${view}View`));
  render();
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const t = theme === 'dark' ? '🌙' : '☀️';
  elements.themeToggle.innerHTML = `<span>${t}</span>`;
}

function applyLanguage(lang) {
  appState.lang = lang;
  document.documentElement.lang = lang;
  elements.languageSelect.value = lang;
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    const text = getText(key);
    if (text) el.textContent = text;
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    const key = el.getAttribute('data-i18n-placeholder');
    const text = getText(key);
    if (text) el.placeholder = text;
  });
}

function ensureConditionalQuestions() {
  const questions = getConditionFields();
  const unanswered = questions.filter((field) => appState.conditionalAnswers[field] === undefined);
  if (unanswered.length) {
    pendingConditionAnswers = unanswered;
    openConditionModal();
  }
}

function getConditionFields() {
  return DOCUMENT_DATABASE.filter((doc) => doc.condition && doc.condition.field)
    .map((doc) => doc.condition.field)
    .filter((value, index, list) => list.indexOf(value) === index);
}

function openConditionModal() {
  const form = elements.conditionForm;
  form.innerHTML = '';
  pendingConditionAnswers.forEach((field) => {
    const item = document.createElement('div');
    item.className = 'summary-card';
    item.innerHTML = `
      <label class="label" for="${field}">${getText(`condition_${field}`) || field}</label>
      <select id="${field}" name="${field}" class="input">
        <option value="yes">${getText('yes')}</option>
        <option value="no">${getText('no')}</option>
      </select>
    `;
    form.appendChild(item);
  });
  const submit = document.createElement('button');
  submit.className = 'primary-btn';
  submit.type = 'submit';
  submit.textContent = getText('save');
  form.appendChild(submit);
  elements.conditionModal.classList.remove('hidden');
}

function closeConditionModal() {
  elements.conditionModal.classList.add('hidden');
}

function openDocumentModal(id) {
  const documentItem = DOCUMENT_DATABASE.find((doc) => doc.id === id);
  if (!documentItem) return;
  currentDocument = documentItem;
  const lang = appState.lang;
  const title = documentItem[`title_${lang}`] || documentItem.title_en || 'Untitled';
  const description = documentItem[`description_${lang}`] || documentItem.description_en || '';
  const purpose = documentItem.purpose?.[lang] || documentItem.purpose?.en || getText('purposeFallback');
  const why = documentItem.why_required?.[lang] || documentItem.why_required?.en || getText('whyFallback');
  const where = documentItem.where_to_get?.[lang] || documentItem.where_to_get?.en || documentItem.where_to_get || '';
  const notes = documentItem.notes?.[lang] || documentItem.notes?.en || documentItem.notes || '';
  const locations = documentItem.locations || [];
  elements.modalContent.innerHTML = `
    <div class="doc-modal-body">
      <h2 id="documentModalTitle">${title}</h2>
      <p>${description}</p>
      <div class="grid-2">
        <div class="summary-card">
          <h3>${getText('purpose')}</h3>
          <p>${purpose}</p>
        </div>
        <div class="summary-card">
          <h3>${getText('whyRequired')}</h3>
          <p>${why}</p>
        </div>
      </div>
      <div class="summary-card">
        <h3>${getText('whereToGet')}</h3>
        <p>${where}</p>
      </div>
      <div class="summary-card">
        <h3>${getText('notes')}</h3>
        <p>${notes}</p>
      </div>
      <div class="summary-card">
        <h3>${getText('issuingOffices')}</h3>
        <ul>${locations.map((location) => `<li><strong>${location.office || ''}</strong> — ${location.address || ''}</li>`) .join('')}</ul>
      </div>
      <div class="doc-actions" style="margin-top:12px;">
        <button class="primary-btn" data-action="search-online" data-query="${escapeHtml(documentItem.google_search_query || title)}" type="button">${getText('searchMore')}</button>
        ${locations.length ? `<button class="secondary-btn" data-action="maps" data-query="${escapeHtml(locations[0].office || title)}" type="button">${getText('viewMaps')}</button>` : ''}
      </div>
    </div>
  `;
  elements.modal.classList.remove('hidden');
}

function closeModal() {
  elements.modal.classList.add('hidden');
}

function toggleCompletion(id) {
  const completed = appState.completedIds.includes(id);
  appState.completedIds = completed ? appState.completedIds.filter((item) => item !== id) : [...appState.completedIds, id];
  saveAppState(appState);
  render();
  showToast(completed ? getText('taskMarkedIncomplete') : getText('taskMarkedComplete'));
}

function getText(key) {
  return translations[appState.lang]?.[key] || translations.en[key] || key;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add('show');
  clearTimeout(showToast.timeoutId);
  showToast.timeoutId = setTimeout(() => elements.toast.classList.remove('show'), 2400);
}

function render() {
  const visibleDocuments = computeVisibleDocuments(DOCUMENT_DATABASE, appState);
  const progress = getProgressStats(appState, DOCUMENT_DATABASE);
  const categories = CATEGORY_DEFINITIONS.map((category) => ({
    ...category,
    documents: visibleDocuments.filter((doc) => doc.category === category.id),
    progress: getCategoryProgress(visibleDocuments, category.id, appState.completedIds)
  }));
  const recommendation = getRecommendation(visibleDocuments, appState);
  const planner = buildPlanner(visibleDocuments, appState);
  const stats = getStatsSummary(appState, visibleDocuments);
  const timeline = getTimelineItems(appState, visibleDocuments);

  document.getElementById('dashboardView').innerHTML = renderDashboard({ visibleDocuments, progress, categories, recommendation, planner, stats });
  document.getElementById('documentsView').innerHTML = renderDocuments({ visibleDocuments, categories, progress });
  document.getElementById('plannerView').innerHTML = renderPlanner({ planner, appState });
  document.getElementById('timelineView').innerHTML = renderTimeline({ timeline });
  document.getElementById('statisticsView').innerHTML = renderStatistics({ stats, categories });
  document.getElementById('settingsView').innerHTML = renderSettings();
  applyLanguage(appState.lang);
  updateActiveNavigation();
}

function updateActiveNavigation() {
  elements.navButtons.forEach((btn) => btn.classList.toggle('active', btn.dataset.view === activeView));
  elements.viewPanels.forEach((panel) => panel.classList.toggle('active', panel.id === `${activeView}View`));
}

function renderDashboard({ visibleDocuments, progress, categories, recommendation, planner, stats }) {
  const recent = visibleDocuments.filter((doc) => appState.completedIds.includes(doc.id)).slice(-3).reverse();
  return `
    <div class="hero-card">
      <div class="hero-top">
        <div>
          <h2>${getText('dashboardTitle')}</h2>
          <p>${getText('dashboardSubtitle')}</p>
        </div>
        <div class="progress-ring">
          <div class="ring" style="background: conic-gradient(var(--accent) ${Math.round(progress.percentage * 3.6)}deg, rgba(255,255,255,0.1) 0deg);">
            <span>${progress.percentage}%</span>
          </div>
        </div>
      </div>
      <div class="hero-metrics">
        <div class="metric-pill">${getText('completedDocuments')}: ${progress.completed}</div>
        <div class="metric-pill">${getText('remainingDocuments')}: ${progress.remaining}</div>
        <div class="metric-pill">${getText('estimatedCompletion')}: ${stats.estimatedCompletionDate}</div>
      </div>
      <div class="summary-card">
        <h3>${getText('todayRecommendation')}</h3>
        <p>${recommendation.title}</p>
        <p>${recommendation.reason}</p>
      </div>
      <div class="grid-2">
        <div class="summary-card">
          <h3>${getText('nextDocument')}</h3>
          <p>${recommendation.nextDocument || getText('noDocumentsLeft')}</p>
        </div>
        <div class="summary-card">
          <h3>${getText('upcomingDeadline')}</h3>
          <p>${progress.upcomingDeadline || getText('noDeadline')}</p>
        </div>
      </div>
      <div class="grid-2">
        <div class="summary-card">
          <h3>${getText('quickStatistics')}</h3>
          <p>${getText('estimatedSessions')}: ${stats.estimatedSessions}</p>
          <p>${getText('documentsByCategory')}: ${categories.filter((item) => item.documents.length).length}</p>
        </div>
        <div class="summary-card">
          <h3>${getText('recentCompleted')}</h3>
          <div class="card-list">
            ${recent.length ? recent.map((doc) => `<div class="card-row"><div class="left"><span class="dot"></span>${doc[`title_${appState.lang}`] || doc.title_en}</div></div>`).join('') : `<p>${getText('noCompletedYet')}</p>`}
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderDocuments({ visibleDocuments, categories, progress }) {
  const searchValue = appState.searchTerm || '';
  return `
    <div class="panel">
      <div class="hero-card">
        <div class="hero-top">
          <div>
            <h2>${getText('documentsTitle')}</h2>
            <p>${getText('documentsSubtitle')}</p>
          </div>
          <div class="hero-metrics">
            <div class="metric-pill">${getText('completion')}: ${progress.percentage}%</div>
          </div>
        </div>
        <div class="search-row">
          <input id="documentSearch" class="input" type="search" value="${escapeHtml(searchValue)}" placeholder="${getText('searchDocuments')}" />
          <div class="doc-actions">
            <label class="chip-btn">
              <input type="radio" name="filterStatus" value="all" ${appState.filterStatus === 'all' ? 'checked' : ''} /> ${getText('all')}
            </label>
            <label class="chip-btn">
              <input type="radio" name="filterStatus" value="completed" ${appState.filterStatus === 'completed' ? 'checked' : ''} /> ${getText('completed')}
            </label>
            <label class="chip-btn">
              <input type="radio" name="filterStatus" value="pending" ${appState.filterStatus === 'pending' ? 'checked' : ''} /> ${getText('notCompleted')}
            </label>
          </div>
        </div>
      </div>
      <div class="card-list" style="margin-top:16px;">
        ${categories.map((category) => {
          const docs = category.documents.filter((doc) => {
            if (appState.filterStatus === 'completed') return appState.completedIds.includes(doc.id);
            if (appState.filterStatus === 'pending') return !appState.completedIds.includes(doc.id);
            return true;
          });
          if (!docs.length) return '';
          const open = appState.openCategories?.[category.id];
          return `
            <section class="category-block">
              <header data-category-toggle="${category.id}">
                <div>
                  <strong>${getText(category.id) || category.name}</strong>
                  <div class="doc-meta">${docs.filter((doc) => appState.completedIds.includes(doc.id)).length}/${docs.length} ${getText('completed')}</div>
                </div>
                <span>${open ? '▾' : '▸'}</span>
              </header>
              ${open ? `<div class="category-body">${docs.map((doc) => renderDocumentCard(doc)).join('')}</div>` : ''}
            </section>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

function renderDocumentCard(doc) {
  const completed = appState.completedIds.includes(doc.id);
  const title = doc[`title_${appState.lang}`] || doc.title_en || 'Untitled';
  const meta = doc.category || 'General';
  const priority = getDynamicPriority(doc, appState);
  return `
    <article class="document-card ${completed ? 'completed' : ''}" data-doc-id="${doc.id}">
      <div class="doc-main">
        <div class="doc-icon">${renderIcon(doc.icon || 'document')}</div>
        <div>
          <div class="doc-title">${title}</div>
          <div class="doc-meta">${meta} • ${getText(priority.toLowerCase()) || priority}</div>
        </div>
      </div>
      <div class="doc-actions">
        <button class="toggle-btn ${completed ? 'complete' : 'incomplete'}" data-toggle-doc="${doc.id}" type="button">${completed ? getText('completed') : getText('notCompleted')}</button>
      </div>
    </article>
  `;
}

function renderPlanner({ planner, appState }) {
  const formValues = planner || appState.planner || {};
  return `
    <div class="planner-card">
      <h3>${getText('plannerTitle')}</h3>
      <p>${getText('plannerSubtitle')}</p>
      <form id="plannerForm" class="planner-form">
        <div class="grid-2">
          <div>
            <label class="label" for="workSchedule">${getText('workSchedule')}</label>
            <input class="input" id="workSchedule" name="workSchedule" value="${escapeHtml(formValues.workSchedule || '')}" />
          </div>
          <div>
            <label class="label" for="workingDays">${getText('workingDays')}</label>
            <input class="input" id="workingDays" name="workingDays" value="${escapeHtml(formValues.workingDays || '')}" />
          </div>
        </div>
        <div class="grid-2">
          <div>
            <label class="label" for="workingHours">${getText('workingHours')}</label>
            <input class="input" id="workingHours" name="workingHours" value="${escapeHtml(formValues.workingHours || '')}" />
          </div>
          <div>
            <label class="label" for="appointmentDate">${getText('appointmentDate')}</label>
            <input class="date-input" id="appointmentDate" name="appointmentDate" type="date" value="${escapeHtml(formValues.appointmentDate || '')}" />
          </div>
        </div>
        <div>
          <label class="label" for="travelDate">${getText('travelDate')}</label>
          <input class="date-input" id="travelDate" name="travelDate" type="date" value="${escapeHtml(formValues.travelDate || '')}" />
        </div>
        <button class="primary-btn" type="submit">${getText('generatePlan')}</button>
      </form>
      <div class="plan-list" style="margin-top:14px;">
        ${planner.length ? planner.map((step) => `<div class="plan-item"><strong>${step.title}</strong><span>${step.reason}</span></div>`).join('') : `<p>${getText('plannerHint')}</p>`}
      </div>
    </div>
  `;
}

function renderTimeline({ timeline }) {
  return `
    <div class="timeline-card">
      <h3>${getText('timelineTitle')}</h3>
      <p>${getText('timelineSubtitle')}</p>
      <div class="timeline-stack">
        ${timeline.map((item) => `<div class="timeline-item"><strong>${item.title}</strong><div class="doc-meta">${item.reason}</div></div>`).join('')}
      </div>
    </div>
  `;
}

function renderStatistics({ stats, categories }) {
  return `
    <div class="stats-card">
      <h3>${getText('statisticsTitle')}</h3>
      <p>${getText('statisticsSubtitle')}</p>
      <div class="stats-grid">
        <div class="summary-card"><div class="stat-number">${stats.totalDocuments}</div><p>${getText('totalDocuments')}</p></div>
        <div class="summary-card"><div class="stat-number">${stats.completed}</div><p>${getText('completedDocuments')}</p></div>
        <div class="summary-card"><div class="stat-number">${stats.remaining}</div><p>${getText('remainingDocuments')}</p></div>
        <div class="summary-card"><div class="stat-number">${stats.percentage}%</div><p>${getText('completion')}</p></div>
      </div>
      <div class="grid-2" style="margin-top:12px;">
        <div class="summary-card">
          <h3>${getText('estimatedSessions')}</h3>
          <p>${stats.estimatedSessions}</p>
          <h3>${getText('estimatedCompletion')}</h3>
          <p>${stats.estimatedCompletionDate}</p>
        </div>
        <div class="summary-card">
          <h3>${getText('documentsByCategory')}</h3>
          <div class="card-list">
            ${categories.map((category) => `<div class="card-row"><div class="left"><span class="dot"></span>${getText(category.id) || category.name}</div><span>${category.documents.length}</span></div>`).join('')}
          </div>
        </div>
      </div>
      <div class="summary-card" style="margin-top:12px;">
        <h3>${getText('shareProgress')}</h3>
        <div id="shareCanvasCard" class="share-card-preview"></div>
        <button class="primary-btn" type="button" data-share-progress="true">${getText('downloadShareCard')}</button>
      </div>
    </div>
  `;
}

function renderSettings() {
  return `
    <div class="settings-card">
      <h3>${getText('settingsTitle')}</h3>
      <p>${getText('settingsSubtitle')}</p>
      <div class="settings-grid">
        <div class="summary-card">
          <h3>${getText('theme')}</h3>
          <p>${getText('themeDescription')}</p>
        </div>
        <div class="summary-card">
          <h3>${getText('language')}</h3>
          <p>${getText('languageDescription')}</p>
        </div>
        <div class="summary-card">
          <h3>${getText('backup')}</h3>
          <p>${getText('backupDescription')}</p>
          <div class="doc-actions">
            <button class="primary-btn" type="button" data-action="export-backup">${getText('exportBackup')}</button>
            <button class="secondary-btn" type="button" data-action="import-backup">${getText('importBackup')}</button>
            <input id="backupInput" type="file" accept="application/json" class="hidden" />
          </div>
        </div>
        <div class="summary-card">
          <h3>${getText('resetProgress')}</h3>
          <p>${getText('resetProgressHint')}</p>
          <button class="secondary-btn" type="button" data-action="reset-progress">${getText('resetProgress')}</button>
        </div>
        <div class="summary-card">
          <h3>${getText('aboutApp')}</h3>
          <p>${getText('aboutAppBody')}</p>
        </div>
      </div>
    </div>
  `;
}

function renderIcon(iconName) {
  const iconMap = {
    document: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none"><path d="M7 3.5h6l4 4V20a1.5 1.5 0 0 1-1.5 1.5H7A1.5 1.5 0 0 1 5.5 20V5A1.5 1.5 0 0 1 7 3.5Z" stroke="currentColor" stroke-width="1.5"/><path d="M13 3.5v4h4" stroke="currentColor" stroke-width="1.5"/></svg>',
    passport: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none"><path d="M7 4.5h10a1.5 1.5 0 0 1 1.5 1.5v12A1.5 1.5 0 0 1 17 19.5H7A1.5 1.5 0 0 1 5.5 18V6A1.5 1.5 0 0 1 7 4.5Z" stroke="currentColor" stroke-width="1.5"/><circle cx="12" cy="11" r="3" stroke="currentColor" stroke-width="1.5"/></svg>',
    money: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none"><rect x="3.5" y="5.5" width="17" height="13" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M8 10h8M8 14h4" stroke="currentColor" stroke-width="1.5"/></svg>',
    school: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none"><path d="M4 8.5 12 4l8 4.5-8 4.5-8-4.5Z" stroke="currentColor" stroke-width="1.5"/><path d="M7 11v4c0 1.5 2 3 5 3s5-1.5 5-3v-4" stroke="currentColor" stroke-width="1.5"/></svg>',
    plane: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none"><path d="m5 13 3.7-1.6 4-4.2 5.2-1.3-2.2 4.8 2.3 2.1-3.4 1.3-2 3.8-1.1-3.2-4.5-1.7Z" stroke="currentColor" stroke-width="1.5"/></svg>',
    shield: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none"><path d="M12 3 5 6v5c0 4.4 2.7 7.9 7 10 4.3-2.1 7-5.6 7-10V6l-7-3Z" stroke="currentColor" stroke-width="1.5"/></svg>',
    office: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none"><path d="M4.5 20.5V9.5L12 4l7.5 5.5v11" stroke="currentColor" stroke-width="1.5"/><path d="M9.5 20.5v-5h5v5" stroke="currentColor" stroke-width="1.5"/></svg>'
  };
  return iconMap[iconName] || iconMap.document;
}

init();
