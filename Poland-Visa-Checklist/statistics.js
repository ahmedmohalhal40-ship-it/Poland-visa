// Statistics and summary calculations for the visa checklist app.
import { DOCUMENT_DATABASE } from './data.js';
import { getEstimatedCompletionDate, computeVisibleDocuments } from './state.js';

export function getStatsSummary(state, visibleDocuments = computeVisibleDocuments(DOCUMENT_DATABASE, state)) {
  const completed = visibleDocuments.filter((doc) => state.completedIds.includes(doc.id)).length;
  const remaining = Math.max(visibleDocuments.length - completed, 0);
  const percentage = visibleDocuments.length ? Math.round((completed / visibleDocuments.length) * 100) : 0;
  const estimatedSessions = Math.max(Math.ceil(remaining / 3), 1);
  return {
    totalDocuments: visibleDocuments.length,
    completed,
    remaining,
    percentage,
    estimatedSessions,
    estimatedCompletionDate: getEstimatedCompletionDate(state, DOCUMENT_DATABASE)
  };
}
