export interface Change {
  service: string;
  type: string;
}

export interface Release {
  tag: string;
  commit: string;
}

export interface GitHubTag {
  name: string;
  commit: {
    author: string;
    sha: string;
  };
}
