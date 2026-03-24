import { ByteConverter, convertToBytes } from '../../utils/util';

export interface GithubHttpResponseHeaders {
  headers: {
    'x-ratelimit-limit': string;
    'x-ratelimit-remaining': string;
    'x-ratelimit-reset': string; // timestamp
    'x-ratelimit-used': string;
  };
}

interface IGithubRateLimitData {
  requestRateLimit: number;
  requestRemainingCount: number;
  requestUsedCount: number;
  requestResetDate: Date;
}

export class GithubRateLimitData implements IGithubRateLimitData {
  requestRateLimit: number;
  requestRemainingCount: number;
  requestResetDate: Date;
  requestUsedCount: number;

  constructor(githubHttpResponseHeaders: GithubHttpResponseHeaders) {
    this.requestRateLimit = +githubHttpResponseHeaders.headers[
      'x-ratelimit-limit'
    ];
    this.requestRemainingCount = +githubHttpResponseHeaders.headers[
      'x-ratelimit-remaining'
    ];
    this.requestUsedCount = +githubHttpResponseHeaders.headers[
      'x-ratelimit-used'
    ];
    this.requestResetDate = new Date(
      +githubHttpResponseHeaders.headers['x-ratelimit-reset'] * 1000,
    );
  }
}

export interface GithubIssueData {
  html_url: string;
  number: number;
  labels: {
    name: string;
  }[];
  state: string;
  body: string;
  created_at: string;
  closed_at?: string;
  user: {
    login: string;
    id: number;
  };
}

export interface GithubUserData {
  login: string;
  id: number;
  avatar_url: string;
  html_url: string;
}

export interface GithubHttpUserResponse extends GithubHttpResponseHeaders {
  data: GithubUserData;
}
export interface GithubHttpIssuesResponse extends GithubHttpResponseHeaders {
  data: {
    total_count: number;
    items: GithubIssueData[];
  };
}

interface IGithubIssuesScrapedData extends IGithubRateLimitData {
  issues: GithubIssueData[];
  issuesTotalCount: number;
}

export class GithubIssuesScrapedData
  extends GithubRateLimitData
  implements IGithubIssuesScrapedData {
  issues: GithubIssueData[];
  issuesTotalCount: number;

  constructor(githubHttpResponse: any) {
    super(githubHttpResponse);
    this.issues = githubHttpResponse.data;
    this.issuesTotalCount = githubHttpResponse.data.length;
  }
}

export interface GithubCommentData {
  html_url: string;
  created_at: string;
  updated_at: string;
  user: {
    login: string;
    id: number;
  };
  body: string;
}
export interface GithubHttpCommentsResponse extends GithubHttpResponseHeaders {
  data: GithubCommentData[];
}

interface IGithubCommentsScrapedData extends IGithubRateLimitData {
  comments: GithubCommentData[];
}

export class GithubCommentsScrapedData
  extends GithubRateLimitData
  implements IGithubCommentsScrapedData {
  comments: GithubCommentData[];

  constructor(githubHttpResponse: GithubHttpCommentsResponse) {
    super(githubHttpResponse);
    this.comments = githubHttpResponse.data;
  }
}

export class GithubUserScrapedData
  extends GithubRateLimitData
  implements GithubUserData {
  login: string;
  id: number;
  avatar_url: string;
  html_url: string;

  constructor(githubHttpResponse: GithubHttpUserResponse) {
    super(githubHttpResponse);
    this.login = githubHttpResponse.data.login;
    this.id = githubHttpResponse.data.id;
    this.avatar_url = githubHttpResponse.data.avatar_url;
    this.html_url = githubHttpResponse.data.html_url;
  }
}

export const govTeamMemberGhIds: Record<string, number> = {
  'galen-mcandrew': 85587348,
  dkkabur: 2343218,
  'Kevin-FF-USA': 94004586,
  raghavrmadya: 91579519,
  Sunnyiscoming: 105098820,
  simonkim0515: 59632896,
  panges2: 96081835,
  kevzak: 102751751,
};

export function getBytes(commentString: string): number | null {
  const valueArr = commentString.match(/(\d*\.)?\d+/g);
  if (!valueArr) {
    return null;
  }
  const value = valueArr[0];

  let unit = commentString.split(value)[1];
  if (!unit) {
    return null;
  }
  unit = unit.trim();

  if (!Object.keys(ByteConverter).includes(unit)) {
    return null;
  }

  return +convertToBytes(value.trim(), ByteConverter[unit]).toString();
}

export function getIssueBodyDatacapRequestedAttributes(
  issue: GithubIssueData,
): {
  datacapRequestedRaw: string | null;
  datacapRequested: number | null;
} {
  if (!issue.body) {
    return {
      datacapRequestedRaw: null,
      datacapRequested: null,
    };
  }
  const oldFormatRegex = /(?<=Total amount of DataCap being requested \(between 500 TiB and 5 PiB\):).*/i;
  const currentFormatRegex = /(?<=Total amount of DataCap being requested)(?:\s*)(.*)/i;
  const oldFormatValue = issue.body.match(oldFormatRegex)?.[0];

  if (oldFormatValue) {
    return {
      datacapRequestedRaw: oldFormatValue,
      datacapRequested: getBytes(oldFormatValue),
    };
  }

  const currentFormatValue = issue.body.match(currentFormatRegex)?.[1];

  if (currentFormatValue) {
    return {
      datacapRequestedRaw: currentFormatValue,
      datacapRequested: getBytes(currentFormatValue),
    };
  }

  return {
    datacapRequestedRaw:
      'No match found, check issue format and regex expressions',
    datacapRequested: null,
  };
}

export interface KeykoNotary {
  id: number;
  organization: string;
  name: string;
  election_round: string;
  status: string;
  use_case: string;
  location: string;
  website: string;
  email: string[];
  fill_slack_id: string;
  github_user: string[];
  ldn_config: {
    active_signer: boolean;
    signing_address: string;
  };
  direct_config: {
    active_signer: boolean;
    signing_address: string;
  };
  previous_config: {
    signing_address: string;
  };
}
