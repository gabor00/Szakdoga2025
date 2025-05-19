export interface Change {
  service: string;
  type: string;
}

export interface Release {
  tag: string;
  commit: string;
  status: string;
  date: string;
  author: string;
  changes: Change[];
}

export interface GitHubTag {
  name: string;
  commit: {
    sha: string;
  };
}
