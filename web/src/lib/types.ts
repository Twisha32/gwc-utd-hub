export type Role = 'member' | 'officer';

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  major: string | null;
  gradYear: number | null;
  createdAt: string;
}

export interface EventItem {
  id: string;
  title: string;
  description: string;
  location: string;
  startsAt: string;
  endsAt: string;
  capacity: number | null;
  goingCount: number;
  waitlistCount: number;
  attendedCount: number;
  myStatus: 'going' | 'waitlist' | null;
  checkedIn: boolean;
  checkinOpen: boolean;
  checkinCode?: string;
}

export interface RosterRow {
  id: string;
  name: string;
  email: string;
  rsvpStatus: 'going' | 'waitlist' | null;
  checkedInAt: string | null;
  checkInMethod: 'code' | 'officer' | null;
}

export interface Challenge {
  id: string;
  title: string;
  category: string;
  description: string;
  points: number;
  hint: string | null;
  published: boolean;
  solveCount: number;
  solved: boolean;
  solvedAt: string | null;
}

export interface LeaderRow {
  rank: number;
  id: string;
  name: string;
  points: number;
  solves: number;
  lastSolveAt: string;
  isMe: boolean;
}

export interface MemberRow {
  id: string;
  name: string;
  email: string;
  role: Role;
  major: string | null;
  gradYear: number | null;
  createdAt: string;
}

export interface Stats {
  totals: {
    members: number;
    newMembers: number;
    upcomingEvents: number;
    pastEvents: number;
    challenges: number;
    solves: number;
    solvers: number;
  };
  recentEvents: { id: string; title: string; startsAt: string; rsvps: number; attended: number }[];
}

export interface Summary {
  attended: number;
  upcomingRsvps: number;
  ctfPoints: number;
  ctfSolves: number;
}

export const CATEGORIES = ['web', 'crypto', 'forensics', 'reverse', 'osint', 'pwn', 'misc'] as const;
