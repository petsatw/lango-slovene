// The domain id of a stored line: `domainId`, or `scenarioId` where the line has only that key.
export const domainIdOf = (o: any): string | undefined => o?.domainId ?? o?.scenarioId;
