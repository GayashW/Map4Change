export function getUserId() {
  let uid = localStorage.getItem('userId');
  if (!uid) {
    uid = 'user-' + Math.random().toString(36).substring(2);
    localStorage.setItem('userId', uid);
  }
  return uid;
}
