export const getToken = () => localStorage.getItem('token');
export const getUser  = () => {
  try { return JSON.parse(localStorage.getItem('user') || 'null'); }
  catch { return null; }
};
export const logout = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = '/';
};
