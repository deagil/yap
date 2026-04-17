export interface Session {
  created: number;
  user: {
    id: string;
    username: string;
    email: string | undefined;
    avatar: string;
    name?: string;
    /** False until onboarding survey is submitted; undefined treated as true (legacy). */
    onboardingComplete?: boolean;
  };
}

export interface SessionUserInfo {
  user: Session["user"] | undefined;
  hasGitHub?: boolean;
  hasGitHubAccount?: boolean;
  /**
   * True when the active workspace has at least one GitHub App installation
   * (not filtered by which user synced the install).
   */
  hasGitHubInstallations?: boolean;
}
