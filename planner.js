// Planner logic that turns user input into a tailored visa preparation plan.
import { getDynamicPriority } from './state.js';

export function buildPlanner(documents, state) {
  const pending = documents.filter((doc) => !state.completedIds.includes(doc.id));
  const sorted = pending.slice().sort((a, b) => {
    const priorityA = getDynamicPriority(a, state);
    const priorityB = getDynamicPriority(b, state);
    const rank = { URGENT: 0, HIGH: 1, NORMAL: 2, LOW: 3 };
    return rank[priorityA] - rank[priorityB];
  }).slice(0, 8);

  return sorted.map((doc) => ({
    title: doc.title_en || doc.title_ar || 'Document',
    reason: getPlannerExplanation(doc, state)
  }));
}

export function getPlannerExplanation(doc, state) {
  const appointment = state.planner?.appointmentDate;
  const travel = state.planner?.travelDate;
  if (appointment && doc.category === 'embassy') {
    return 'This document should be completed first because it is tied directly to the embassy appointment.';
  }
  if (travel && doc.category === 'travel') {
    return 'This document should be completed early because travel logistics often require several business days.';
  }
  if (doc.category === 'financial') {
    return 'This document should be completed soon because financial proof can take time to prepare.';
  }
  if (doc.category === 'identity') {
    return 'This document should be completed first because identity paperwork often has processing delays.';
  }
  if (doc.priority === 'urgent') {
    return 'This document is time-sensitive and should be handled before lower-priority items.';
  }
  return 'This item is recommended next based on your current checklist and visa timeline.';
}
