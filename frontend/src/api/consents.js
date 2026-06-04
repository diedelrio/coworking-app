import api from './axiosClient';

export function getActiveConsents() {
  return api.get('/consents/active');
}

export function acceptConsent(consentId, accepted = true) {
  return api.post(`/consents/${consentId}/accept`, { accepted, source: 'USER_PROFILE' });
}

export function consentDocumentUrl(documentId) {
  return `${api.defaults.baseURL}/consents/documents/${documentId}/download`;
}
