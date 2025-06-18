# Context Store Data Schemas

## MongoDB Document Schemas

### Document Context Schema
```typescript
interface DocumentContext {
  _id: ObjectId;
  documentId: string; // UUID
  userId: string;
  sessionId: string;
  metadata: {
    title: string;
    type: 'email' | 'document' | 'code' | 'web' | 'chat';
    language: string; // ISO 639-1 code
    encoding: string;
    fileSize: number;
    createdAt: Date;
    updatedAt: Date;
    version: number;
    tags: string[];
  };
  content: {
    raw: string; // Original text
    processed: string; // Cleaned/normalized text
    structure: {
      paragraphs: TextSegment[];
      sentences: TextSegment[];
      tokens: Token[];
      wordCount: number;
      characterCount: number;
    };
    checksum: string; // Content hash for change detection
  };
  analysis: {
    grammarIssues: GrammarIssue[];
    styleMetrics: StyleMetrics;
    patterns: WritingPattern[];
    readabilityScores: ReadabilityScores;
    sentiment: SentimentAnalysis;
  };
  userInteractions: UserInteraction[];
  contextLinks: DocumentLink[];
  processingMetadata: {
    analysisVersion: string;
    processingTime: number;
    confidence: number;
    flags: string[];
  };
}

interface TextSegment {
  text: string;
  start: number;
  end: number;
  type: 'paragraph' | 'sentence';
}

interface Token {
  text: string;
  pos: string; // Part of speech
  lemma: string;
  start: number;
  end: number;
  isStopWord: boolean;
}

interface GrammarIssue {
  id: string;
  type: string; // 'grammar', 'spelling', 'punctuation', 'style'
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  rule: string;
  position: {
    start: number;
    end: number;
    line?: number;
    column?: number;
  };
  original: string;
  suggestion: string;
  alternatives: string[];
  explanation: string;
  confidence: number;
  appliedAt?: Date;
  userAction?: 'accepted' | 'rejected' | 'modified';
}

interface StyleMetrics {
  readabilityScore: number;
  fleschKincaid: number;
  complexityIndex: number;
  tonality: 'formal' | 'informal' | 'neutral' | 'academic' | 'casual';
  passiveVoiceRatio: number;
  averageSentenceLength: number;
  vocabularyComplexity: number;
}

interface WritingPattern {
  type: string;
  frequency: number;
  contexts: string[];
  examples: string[];
  impact: 'positive' | 'negative' | 'neutral';
}

interface ReadabilityScores {
  fleschReading: number;
  fleschKincaid: number;
  gunningFog: number;
  smog: number;
  automatedReadability: number;
  colemanLiau: number;
}

interface SentimentAnalysis {
  polarity: number; // -1 to 1
  subjectivity: number; // 0 to 1
  emotions: {
    joy: number;
    anger: number;
    fear: number;
    sadness: number;
    surprise: number;
    trust: number;
    disgust: number;
    anticipation: number;
  };
}

interface UserInteraction {
  id: string;
  action: 'accept' | 'reject' | 'modify' | 'ignore' | 'feedback';
  suggestionId: string;
  timestamp: Date;
  context: {
    surroundingText: string;
    cursorPosition: number;
    selectionRange?: { start: number; end: number };
  };
  userInput?: string;
  feedback?: string;
}

interface DocumentLink {
  linkedDocumentId: string;
  relationship: 'revision' | 'template' | 'similar' | 'reference' | 'translation';
  similarity: number;
  linkStrength: number;
  createdAt: Date;
  metadata: Record<string, any>;
}
```

### Session Context Schema
```typescript
interface SessionContext {
  _id: ObjectId;
  sessionId: string;
  userId: string;
  startTime: Date;
  endTime?: Date;
  status: 'active' | 'paused' | 'closed' | 'expired';
  documentIds: string[];
  metadata: {
    device: string;
    platform: string;
    userAgent: string;
    ipAddress: string;
    location?: {
      country: string;
      region: string;
      timezone: string;
    };
  };
  analysisMetrics: {
    totalSuggestions: number;
    acceptedSuggestions: number;
    rejectedSuggestions: number;
    modifiedSuggestions: number;
    avgProcessingTime: number;
    totalProcessingTime: number;
    documentsProcessed: number;
  };
  learningData: {
    userPreferences: UserPreferences;
    commonPatterns: WritingPattern[];
    customRules: CustomRule[];
    adaptations: Adaptation[];
  };
  performance: {
    cacheHitRate: number;
    avgResponseTime: number;
    errorCount: number;
    warnings: string[];
  };
}

interface UserPreferences {
  writingStyle: 'formal' | 'informal' | 'academic' | 'business' | 'creative';
  formality: 'very_formal' | 'formal' | 'neutral' | 'informal' | 'very_informal';
  domain: 'academic' | 'business' | 'casual' | 'technical' | 'creative';
  language: string;
  dialect?: string;
  customDictionary: string[];
  ignoredRules: string[];
  enabledFeatures: string[];
  confidenceThreshold: number;
  autoCorrect: boolean;
  realTimeAnalysis: boolean;
}

interface CustomRule {
  id: string;
  name: string;
  pattern: string;
  replacement: string;
  category: string;
  isRegex: boolean;
  isActive: boolean;
  createdAt: Date;
  usage: number;
}

interface Adaptation {
  type: 'preference' | 'pattern' | 'rule';
  change: string;
  reason: string;
  confidence: number;
  appliedAt: Date;
  impact: number;
}
```

### User Profile Schema
```typescript
interface UserProfile {
  _id: ObjectId;
  userId: string;
  email?: string;
  createdAt: Date;
  updatedAt: Date;
  preferences: UserPreferences;
  stats: {
    totalDocuments: number;
    totalSessions: number;
    totalSuggestions: number;
    totalWordsProcessed: number;
    improvementScore: number;
    streakDays: number;
    lastActiveDate: Date;
  };
  learningProfile: {
    commonMistakes: MistakePattern[];
    strengthAreas: string[];
    weaknessAreas: string[];
    progressMetrics: ProgressMetrics;
    skillLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  };
  subscription: {
    tier: 'free' | 'premium' | 'enterprise';
    features: string[];
    expiresAt?: Date;
    usage: {
      documentsThisMonth: number;
      wordsThisMonth: number;
      apiCallsThisMonth: number;
    };
  };
  privacy: {
    dataRetention: number; // days
    anonymizeData: boolean;
    shareUsageStats: boolean;
    allowML: boolean;
  };
}

interface MistakePattern {
  type: string;
  frequency: number;
  examples: string[];
  improvement: number;
  lastSeen: Date;
}

interface ProgressMetrics {
  weeklyImprovement: number;
  monthlyImprovement: number;
  overallTrend: 'improving' | 'stable' | 'declining';
  milestones: Milestone[];
}

interface Milestone {
  name: string;
  achievedAt: Date;
  metric: string;
  value: number;
}
```

## Redis Cache Schemas

### Cache Key Patterns
```typescript
const CACHE_KEYS = {
  // Document Analysis Cache
  ANALYSIS: `doc:analysis:{documentId}`,
  SUGGESTIONS: `doc:suggestions:{documentId}`,
  METRICS: `doc:metrics:{documentId}`,
  CONTENT: `doc:content:{documentId}`,
  
  // Session Data
  SESSION: `session:{sessionId}`,
  SESSION_DOCS: `session:{sessionId}:docs`,
  SESSION_METRICS: `session:{sessionId}:metrics`,
  
  // User Context
  USER_PROFILE: `user:{userId}:profile`,
  USER_PREFERENCES: `user:{userId}:prefs`,
  USER_STATS: `user:{userId}:stats`,
  USER_SESSIONS: `user:{userId}:sessions`,
  
  // Grammar Rules Cache
  RULES: `grammar:rules:{language}`,
  PATTERNS: `grammar:patterns:{domain}`,
  DICTIONARY: `dict:{language}:{word}`,
  
  // Processing Queue
  QUEUE: `queue:processing`,
  PRIORITY_QUEUE: `queue:priority`,
  RETRY_QUEUE: `queue:retry`,
  
  // Real-time Analysis
  LIVE_DOC: `live:doc:{documentId}`,
  TYPING_CONTEXT: `typing:{sessionId}:{documentId}`,
  DIFF_BUFFER: `diff:{documentId}`,
  
  // Rate Limiting
  RATE_LIMIT: `rate:{userId}:{endpoint}`,
  
  // Analytics
  DAILY_STATS: `stats:daily:{date}`,
  USER_ACTIVITY: `activity:{userId}:{date}`
};
```

### Cached Data Structures
```typescript
// Document Analysis Cache (Hash)
interface CachedAnalysis {
  documentId: string;
  lastAnalyzed: string; // ISO timestamp
  version: number;
  grammarScore: number;
  suggestions: string; // JSON serialized GrammarIssue[]
  metrics: string; // JSON serialized StyleMetrics
  processingTime: number;
  confidence: number;
  ttl: number;
}

// Session Cache (Hash)
interface CachedSession {
  sessionId: string;
  userId: string;
  startTime: string;
  status: string;
  activeDocuments: number;
  totalSuggestions: number;
  lastActivity: string;
  preferences: string; // JSON serialized
}

// Real-time Typing Context (String with TTL)
interface TypingContext {
  documentId: string;
  sessionId: string;
  cursor: number;
  lastChange: string; // ISO timestamp
  changeType: 'insert' | 'delete' | 'replace';
  buffer: string; // Recent text changes
  pendingAnalysis: boolean;
}

// Processing Queue Item (List)
interface QueueItem {
  id: string;
  documentId: string;
  sessionId?: string;
  userId: string;
  priority: number; // 1-10, higher = more priority
  task: 'analyze' | 'reanalyze' | 'batch_process';
  timestamp: string;
  retryCount: number;
  metadata: Record<string, any>;
}

// User Activity Cache (Sorted Set)
interface UserActivity {
  userId: string;
  timestamp: number; // Unix timestamp
  action: string;
  documentId?: string;
  sessionId?: string;
  score: number; // For sorted set ranking
}
```

## API Response Schemas

### Analysis Response
```typescript
interface AnalysisResponse {
  documentId: string;
  analysisId: string;
  timestamp: string;
  status: 'success' | 'partial' | 'failed';
  processingTime: number;
  results: {
    grammarIssues: GrammarIssue[];
    styleMetrics: StyleMetrics;
    readabilityScores: ReadabilityScores;
    suggestions: Suggestion[];
  };
  metadata: {
    version: string;
    model: string;
    confidence: number;
    flags: string[];
  };
  caching: {
    cached: boolean;
    cacheHit: boolean;
    ttl: number;
  };
}

interface Suggestion {
  id: string;
  type: 'grammar' | 'style' | 'clarity' | 'conciseness';
  severity: 'info' | 'warning' | 'error';
  position: { start: number; end: number };
  original: string;
  suggested: string;
  explanation: string;
  confidence: number;
  category: string;
  rule: string;
}
```

### Session Response
```typescript
interface SessionResponse {
  sessionId: string;
  status: 'active' | 'created' | 'closed';
  documents: {
    total: number;
    active: number;
    processed: number;
  };
  metrics: {
    totalSuggestions: number;
    acceptanceRate: number;
    avgProcessingTime: number;
    cacheHitRate: number;
  };
  duration: number; // seconds
  lastActivity: string;
}
```

## Error Schemas

### Error Response
```typescript
interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record<string, any>;
    timestamp: string;
    requestId: string;
  };
  context?: {
    documentId?: string;
    sessionId?: string;
    userId?: string;
    operation?: string;
  };
}

// Common Error Codes
const ERROR_CODES = {
  DOCUMENT_NOT_FOUND: 'DOCUMENT_NOT_FOUND',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  ANALYSIS_FAILED: 'ANALYSIS_FAILED',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  INVALID_DOCUMENT_FORMAT: 'INVALID_DOCUMENT_FORMAT',
  CACHE_MISS: 'CACHE_MISS',
  DATABASE_ERROR: 'DATABASE_ERROR',
  AUTHENTICATION_FAILED: 'AUTHENTICATION_FAILED',
  INSUFFICIENT_PRIVILEGES: 'INSUFFICIENT_PRIVILEGES',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE'
};
```

## Migration Schemas

### Schema Version
```typescript
interface SchemaVersion {
  version: string;
  appliedAt: Date;
  description: string;
  migrations: Migration[];
}

interface Migration {
  id: string;
  type: 'add_field' | 'remove_field' | 'rename_field' | 'change_type' | 'add_index';
  collection: string;
  field?: string;
  oldValue?: any;
  newValue?: any;
  rollbackQuery?: any;
}
```

This comprehensive schema definition provides the foundation for implementing the document context store with proper data structure, caching strategies, and error handling.