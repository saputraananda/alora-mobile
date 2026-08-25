import axios from 'axios';
import { currentMonthKeyWib } from '../utils/bugarLeaderboard.js';
import {
  HAID_WEEKLY_TARGET_KM,
  effectiveWeeklyTargetKm as effectiveWeeklyTargetKmUtil,
} from '../utils/bugarHaid.js';

const api = axios.create({
  baseURL: '/api',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('alora_auth_token') || localStorage.getItem('alora_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export function isBugarBodyComplete(profile) {
  if (!profile) return false;
  const h = Number(profile.height_cm);
  const w = Number(profile.weight_kg);
  return h >= 100 && h <= 250 && w >= 30 && w <= 250;
}

export const BUGAR_GOAL_WEEKLY_TARGET_KM = {
  diet: 20,
  maintenance: 12,
};

export { HAID_WEEKLY_TARGET_KM };

export function effectiveWeeklyTargetKm(profile) {
  return effectiveWeeklyTargetKmUtil(profile);
}

export function isBugarTargetComplete(profile) {
  if (!profile?.goal_focus) return false;
  const expected = BUGAR_GOAL_WEEKLY_TARGET_KM[profile.goal_focus];
  const t = Number(profile?.weekly_target_km);
  return expected != null && t === expected;
}

export async function fetchBugarProfile() {
  const { data } = await api.get('/bugar/profile');
  return data.profile;
}

export async function saveBugarProfile(body) {
  const { data } = await api.put('/bugar/profile', body);
  return data.profile;
}

export async function startBugarHaid({ duration_days } = {}) {
  const { data } = await api.put('/bugar/profile/haid/start', { duration_days });
  return data.profile;
}

export async function respondBugarHaidFollowUp({ still_on_period }) {
  const { data } = await api.put('/bugar/profile/haid/follow-up', { still_on_period });
  return data.profile;
}

export async function stopBugarHaid() {
  const { data } = await api.put('/bugar/profile/haid/stop');
  return data.profile;
}

export async function fetchBugarSessions(sport) {
  const { data } = await api.get('/bugar/sessions', { params: sport ? { sport } : {} });
  return data.sessions || [];
}

export async function postBugarSession(body) {
  const { data } = await api.post('/bugar/sessions', body);
  return data.session;
}

export async function fetchBugarStats(sport) {
  const { data } = await api.get('/bugar/stats', { params: { sport } });
  return data.stats;
}

export async function fetchBugarStatsAll() {
  const { data } = await api.get('/bugar/stats', { params: { sport: 'all' } });
  return data.stats;
}

export async function fetchBugarLeaderboard({ sort = 'km', month } = {}) {
  const params = { sort, month: month || currentMonthKeyWib() };
  const { data } = await api.get('/bugar/leaderboard', { params });
  return data;
}
