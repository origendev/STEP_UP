export const API_BASE = window.STEPUP_API_BASE_URL || window.STEPUP_API_URL || 'http://localhost:3000/api';

export function getToken(){ return localStorage.getItem('stepupStudentToken'); }
export function setSession(data){
  localStorage.setItem('stepupStudentToken', data.token);
  localStorage.setItem('stepupStudent', JSON.stringify(data.student));
}
export function clearSession(){
  localStorage.removeItem('stepupStudentToken');
  localStorage.removeItem('stepupStudent');
}
export async function api(path, options={}){
  const headers={ 'Content-Type':'application/json', ...(options.headers||{}) };
  const token=getToken();
  if(token) headers.Authorization=`Bearer ${token}`;
  const res=await fetch(`${API_BASE}${path}`, {...options,headers});
  let body={};
  try{ body=await res.json(); }catch{}
  if(!res.ok) throw new Error(body.error || 'Something went wrong.');
  return body;
}
