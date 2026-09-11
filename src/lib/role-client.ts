'use client';

import { useEffect, useState } from 'react';
import type { RoleKey } from '@/lib/flow';

export const ROLE_STORAGE_KEY = 'rr-hub-role';
export const DEFAULT_ROLE: RoleKey = 'creator';

export function getStoredRole(): RoleKey {
  if (typeof window === 'undefined') return DEFAULT_ROLE;
  const value = window.localStorage.getItem(ROLE_STORAGE_KEY);
  return isRole(value) ? value : DEFAULT_ROLE;
}

export function setStoredRole(role: RoleKey) {
  window.localStorage.setItem(ROLE_STORAGE_KEY, role);
  window.dispatchEvent(new Event('rr-hub-role-change'));
}

export function useActiveRole(): RoleKey {
  const [role, setRole] = useState<RoleKey>(DEFAULT_ROLE);
  useEffect(() => {
    const refresh = () => setRole(getStoredRole());
    refresh();
    window.addEventListener('rr-hub-role-change', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('rr-hub-role-change', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);
  return role;
}

export function isRole(value: string | null): value is RoleKey {
  return ['owner', 'creator', 'camera', 'model', 'editor', 'publisher', 'media_buyer', 'client_approver', 'client_viewer'].includes(value ?? '');
}
