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

export type TaskOption = { id: string; text: string };

export type Task = {
  id: string;
  topic_id: string;
  type: string;
  question_text: string;
  question_image_url: string | null;
  options: TaskOption[] | null;
  difficulty: number;
};

export type AnswerResult = {
  correct: boolean;
  dialogue_id: string | null;
};

export type TodaySession = {
  session_id: string;
  tasks: Task[];
};

export type PathNode = {
  topic_id: string;
  title: string;
  subtopic_number: string;
  task_number: number;
  state: "completed" | "current" | "locked";
  attempts_count: number;
  correct_count: number;
};

export type TaskSection = {
  task_number: number;
  title: string;
  difficulty: number;
  nodes: PathNode[];
};

export type SessionPath = {
  sections: TaskSection[];
};

export type SubtopicSession = {
  tasks: Task[];
};
