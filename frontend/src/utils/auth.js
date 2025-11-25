export function getCurrentUser() {
  try {
    const data = localStorage.getItem('user');
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}
