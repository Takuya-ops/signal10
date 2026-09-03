export type NewsCategory =
  | 'モデル'
  | 'プロダクト'
  | 'ビジネス'
  | '政策・社会'
  | '研究'
  | '開発者向け'
  | '安全性';

export type VerificationLevel = '公式発表' | '複数ソース' | '信頼できる報道';

export type RelatedSource = {
  name: string;
  url: string;
};

export type Story = {
  id: string;
  rank: number;
  title: string;
  originalTitle: string;
  summary: string;
  points: string[];
  whyItMatters: string;
  source: string;
  sourceType: 'official' | 'media' | 'research';
  category: NewsCategory;
  publishedAt: string;
  url: string;
  impactScore: number;
  impactLabel: '特大' | '大' | '中';
  verification: VerificationLevel;
  relatedSources: RelatedSource[];
  eventUrls?: string[];
  eventTitles?: string[];
};

export type Digest = {
  edition: string;
  generatedAt: string;
  periodStart: string;
  status: 'live' | 'sample' | 'degraded';
  checkedSources: number;
  successfulSources: number;
  freshSources?: number;
  coreSources?: number;
  coreSuccessfulSources?: number;
  coreFreshSources?: number;
  candidateCount: number;
  editorialNote: string;
  repositoryUrl?: string;
  stories: Story[];
};
