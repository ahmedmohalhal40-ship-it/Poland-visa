// State utilities for the visa checklist app.
import { DOCUMENT_DATABASE } from './data.js';

export function getInitialState() {
  return {
    completedIds: [],
    lang: 'en',
    theme: 'dark',
    activeView: 'dashboard',
    searchTerm: '',
    filterStatus: 'all',
    planner: {},
    conditionalAnswers: {},
    openCategories: {},
    version: 1
  };
}

export function normalizeState(state = {}) {
  const initial = getInitialState();
  const merged = { ...initial, ...state };
  merged.completedIds = Array.isArray(state?.completedIds) ? state.completedIds : [];
  merged.conditionalAnswers = state?.conditionalAnswers && typeof state.conditionalAnswers === 'object' ? state.conditionalAnswers : {};
  merged.openCategories = state?.openCategories && typeof state.openCategories === 'object' ? state.openCategories : {};
  merged.planner = state?.planner && typeof state.planner === 'object' ? state.planner : {};
  return merged;
}

export function computeVisibleDocuments(data = DOCUMENT_DATABASE, state = {}) {
  const searchTerm = (state.searchTerm || '').toLowerCase().trim();
  const filterStatus = state.filterStatus || 'all';
  const conditionalAnswers = state.conditionalAnswers || {};

  return data.filter((doc) => {
    if (doc.condition && doc.condition.field) {
      const answer = conditionalAnswers[doc.condition.field];
      if (answer === undefined) return true;
      if (answer !== doc.condition.value) return false;
    }

    const title = `${doc.title_en || ''} ${doc.title_ar || ''}`.toLowerCase();
    const description = `${doc.description_en || ''} ${doc.description_ar || ''}`.toLowerCase();
    const notes = `${doc.notes?.en || ''} ${doc.notes?.ar || ''}`.toLowerCase();
    const category = `${doc.category || ''}`.toLowerCase();
    const locations = (doc.locations || []).map((loc) => `${loc.office || ''} ${loc.address || ''}`.toLowerCase()).join(' ');
    const haystack = [title, description, notes, category, locations].join(' ');
    const matchesSearch = !searchTerm || haystack.includes(searchTerm);

    const completed = Array.isArray(state.completedIds) && state.completedIds.includes(doc.id);
    if (filterStatus === 'completed') return matchesSearch && completed;
    if (filterStatus === 'pending') return matchesSearch && !completed;
    return matchesSearch;
  });
}

export function getDynamicPriority(doc, state = {}) {
  const appointmentDate = state.planner?.appointmentDate ? new Date(state.planner.appointmentDate) : null;
  const travelDate = state.planner?.travelDate ? new Date(state.planner.travelDate) : null;
  const now = new Date();
  const daysUntilAppointment = appointmentDate ? Math.ceil((appointmentDate - now) / (1000 * 60 * 60 * 24)) : null;
  const daysUntilTravel = travelDate ? Math.ceil((travelDate - now) / (1000 * 60 * 60 * 24)) : null;
  const urgentCategories = ['embassy', 'travel', 'identity'];

  if (daysUntilAppointment !== null && daysUntilAppointment <= 14) return 'URGENT';
  if (daysUntilTravel !== null && daysUntilTravel <= 21) return 'URGENT';
  if (urgentCategories.includes(doc.category)) return 'HIGH';
  if (doc.priority === 'urgent') return 'URGENT';
  if (doc.priority === 'high') return 'HIGH';
  if (doc.priority === 'normal') return 'NORMAL';
  return 'LOW';
}

export function getCategoryProgress(visibleDocuments, categoryId, completedIds = []) {
  const matched = visibleDocuments.filter((doc) => doc.category === categoryId);
  if (!matched.length) return 0;
  const completed = matched.filter((doc) => completedIds.includes(doc.id)).length;
  return Math.round((completed / matched.length) * 100);
}

export function getProgressStats(state, data = DOCUMENT_DATABASE) {
  const visibleDocuments = computeVisibleDocuments(data, state);
  const completed = visibleDocuments.filter((doc) => state.completedIds.includes(doc.id)).length;
  const total = visibleDocuments.length;
  const percentage = total ? Math.round((completed / total) * 100) : 0;
  const remaining = Math.max(total - completed, 0);
  const upcomingDeadline = remaining ? `Finish ${remaining} more document${remaining > 1 ? 's' : ''} this week.` : 'All clear for now.';
  return { completed, total, remaining, percentage, upcomingDeadline };
}

export function getRecommendation(visibleDocuments, state = {}) {
  const pending = visibleDocuments.filter((doc) => !state.completedIds.includes(doc.id));
  if (!pending.length) return { title: 'You are fully prepared.', reason: 'Every required document is marked complete.', nextDocument: 'No pending tasks.' };
  const next = pending.sort((a, b) => {
    const priorityA = getDynamicPriority(a, state);
    const priorityB = getDynamicPriority(b, state);
    const rank = { URGENT: 0, HIGH: 1, NORMAL: 2, LOW: 3 };
    return rank[priorityA] - rank[priorityB];
  })[0];
  return {
    title: `Complete ${next.title_en || next.title_ar || 'the next document'}.`,
    reason: `This is prioritized because it may require extra time or office visits.`,
    nextDocument: next.title_en || next.title_ar || 'Next document'
  };
}

export function getTimelineItems(state, visibleDocuments) {
  const items = [];
  const today = new Date();
  items.push({ title: 'Today', reason: 'Start with the next priority item.' });
  const pending = visibleDocuments.filter((doc) => !state.completedIds.includes(doc.id));
  const ordered = pending.slice().sort((a, b) => {
    const priorityA = getDynamicPriority(a, state);
    const priorityB = getDynamicPriority(b, state);
    const rank = { URGENT: 0, HIGH: 1, NORMAL: 2, LOW: 3 };
    return rank[priorityA] - rank[priorityB];
  }).slice(0, 6);
  ordered.forEach((doc) => items.push({ title: doc.title_en || doc.title_ar || 'Document', reason: `Recommended because of ${doc.category} priority.` }));
  if (state.planner?.appointmentDate) {
    items.push({ title: 'Embassy Appointment', reason: 'Your appointment is the key milestone.' });
  }
  if (state.planner?.travelDate) {
    items.push({ title: 'Travel', reason: 'Prepare your departure checklist.' });
  }
  return items;
}

export function getEstimatedCompletionDate(state, data = DOCUMENT_DATABASE) {
  const remaining = computeVisibleDocuments(data, state).filter((doc) => !state.completedIds.includes(doc.id)).length;
  const sessions = Math.max(Math.ceil(remaining / 3), 1);
  const date = new Date();
  date.setDate(date.getDate() + sessions * 2);
  return date.toLocaleDateString();
}

export function applyConditionalAnswers(documents, answers = {}) {
  return documents.filter((doc) => {
    if (!doc.condition || !doc.condition.field) return true;
    const answer = answers[doc.condition.field];
    if (answer === undefined) return true;
    return answer === doc.condition.value;
  });
}
