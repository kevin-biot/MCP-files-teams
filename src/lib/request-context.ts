let currentUserId: string | null = null;
let currentTeamId: string | null = null;

export const RequestContext = {
  set(userId?: string | null, teamId?: string | null) {
    currentUserId = userId || null;
    currentTeamId = teamId || null;
  },
  clear() {
    currentUserId = null;
    currentTeamId = null;
  },
  userId(): string | null { return currentUserId; },
  teamId(): string | null { return currentTeamId; }
};

