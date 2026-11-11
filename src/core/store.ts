// Persistence. Every read and write is wrapped: a private window, blocked storage or a full
// quota must never break the app. In preview mode (?pratinjau=) nothing is written at all.

const KEY = 'cloudstead:v1';

