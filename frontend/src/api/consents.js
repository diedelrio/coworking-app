import api from './axiosClient';

export function getActiveConsents() {
  return api.get('/consents/active');
}

export function acceptConsent(consentId, accepted = true, source = 'USER_PROFILE') {
  return api.post(`/consents/${consentId}/accept`, { accepted, source });
}

export function consentDocumentUrl(documentId) {
  return `${api.defaults.baseURL}/consents/public-documents/${documentId}/download`;
}