import { Project } from '../types';

export const CORE_DOCUMENT_KEYS = [
  'rfp',
  'eOfficeFile',
  'agreement',
  'purchaseOrder',
  'bg',
  'ip',
  'bills',
] as const;

export function countCoreDocuments(project: Project): number {
  return CORE_DOCUMENT_KEYS.reduce(
    (count, key) => count + (project[key] ? 1 : 0),
    0
  );
}

export function countProjectDocuments(project: Project): number {
  return countCoreDocuments(project) + (project.otherDocuments?.length ?? 0);
}
