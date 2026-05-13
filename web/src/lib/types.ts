export type User = {
  id: string;
  email: string;
  name: string | null;
  grade: number | null;
  target_score: number | null;
  exam_date: string | null;
};

export type TokenPair = {
  access_token: string;
  refresh_token: string;
  token_type: string;
};

export type AuthResponse = {
  user: User;
  tokens: TokenPair;
  needs_onboarding: boolean;
};

export type ApiErrorBody = {
  detail: string | Array<{ msg: string; loc: (string | number)[] }>;
};
