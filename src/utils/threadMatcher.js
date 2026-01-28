/**
 * Thread Matcher Utility
 * Handles robust email thread matching with multiple fallback strategies
 */

// Prefixes to remove from subjects for normalization
const SUBJECT_PREFIXES = [
  /^re:\s*/gi,
  /^res:\s*/gi,
  /^fw:\s*/gi,
  /^fwd:\s*/gi,
  /^enc:\s*/gi,
  /^r:\s*/gi,
  /^sv:\s*/gi, // Swedish
  /^aw:\s*/gi, // German
  /^tr:\s*/gi, // French
  /^wg:\s*/gi, // German
];

// Pattern to match bracketed tags like [TICKET-123] or [External]
const BRACKET_TAG_PATTERN = /\[[^\]]+\]/g;

// Pattern to match parenthetical references like (was: old subject)
const PAREN_PATTERN = /\([^)]+\)$/g;

// Time window for sender-based matching (24 hours in milliseconds)
const SENDER_MATCH_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Normalizes an email subject for comparison
 * - Removes Re:, Fwd:, etc. prefixes
 * - Removes [tags] and (parentheticals)
 * - Trims and converts to lowercase
 * @param {string} subject - Original subject line
 * @returns {string} - Normalized subject
 */
export function normalizeSubject(subject) {
  if (!subject || typeof subject !== 'string') {
    return '';
  }

  let normalized = subject.trim().toLowerCase();

  // Remove all reply/forward prefixes (may be stacked: "Re: RE: Fwd:")
  let previousLength;
  do {
    previousLength = normalized.length;
    for (const prefix of SUBJECT_PREFIXES) {
      normalized = normalized.replace(prefix, '');
    }
    normalized = normalized.trim();
  } while (normalized.length !== previousLength);

  // Remove bracketed tags
  normalized = normalized.replace(BRACKET_TAG_PATTERN, '');

  // Remove trailing parentheticals
  normalized = normalized.replace(PAREN_PATTERN, '');

  // Clean up whitespace
  normalized = normalized.replace(/\s+/g, ' ').trim();

  return normalized;
}

/**
 * Extracts the In-Reply-To message ID from email headers
 * @param {Object} headers - Email headers object
 * @returns {string|null} - Message ID or null
 */
export function extractInReplyTo(headers) {
  if (!headers || typeof headers !== 'object') {
    return null;
  }

  // Try different header formats
  const inReplyTo = headers['In-Reply-To'] || headers['in-reply-to'] || headers.inReplyTo;

  if (!inReplyTo) {
    return null;
  }

  // Clean the message ID (remove angle brackets if present)
  return inReplyTo.replace(/^<|>$/g, '').trim();
}

/**
 * Extracts References message IDs from email headers
 * @param {Object} headers - Email headers object
 * @returns {string[]} - Array of message IDs
 */
export function extractReferences(headers) {
  if (!headers || typeof headers !== 'object') {
    return [];
  }

  const references = headers['References'] || headers['references'] || headers.references;

  if (!references) {
    return [];
  }

  // References can be space-separated message IDs
  return references
    .split(/\s+/)
    .map((ref) => ref.replace(/^<|>$/g, '').trim())
    .filter(Boolean);
}

/**
 * Thread matching strategies in order of reliability
 */
const MATCHING_STRATEGIES = {
  /**
   * Strategy 1: Exact thread_id match (Gmail/provider thread ID)
   */
  threadId: {
    name: 'thread_id',
    priority: 1,
    match: (email, existingThreads) => {
      if (!email.thread_id) return null;

      return existingThreads.find((t) => t.thread_id === email.thread_id) || null;
    },
  },

  /**
   * Strategy 2: In-Reply-To header match
   */
  inReplyTo: {
    name: 'in_reply_to',
    priority: 2,
    match: (email, existingThreads, existingMessages) => {
      const inReplyTo = extractInReplyTo(email.headers);
      if (!inReplyTo) return null;

      // Find message with this ID
      const parentMessage = existingMessages.find((m) => m.message_id === inReplyTo);
      if (!parentMessage) return null;

      // Return the thread containing this message
      return existingThreads.find((t) => t.id === parentMessage.thread_id) || null;
    },
  },

  /**
   * Strategy 3: References header match
   */
  references: {
    name: 'references',
    priority: 3,
    match: (email, existingThreads, existingMessages) => {
      const references = extractReferences(email.headers);
      if (references.length === 0) return null;

      // Try to find any referenced message
      for (const ref of references) {
        const referencedMessage = existingMessages.find((m) => m.message_id === ref);
        if (referencedMessage) {
          const thread = existingThreads.find((t) => t.id === referencedMessage.thread_id);
          if (thread) return thread;
        }
      }

      return null;
    },
  },

  /**
   * Strategy 4: Subject matching (normalized)
   */
  subject: {
    name: 'subject',
    priority: 4,
    match: (email, existingThreads) => {
      const normalizedSubject = normalizeSubject(email.subject);
      if (!normalizedSubject || normalizedSubject.length < 3) return null;

      // Find threads with matching normalized subject
      const matchingThreads = existingThreads.filter((t) => {
        const threadSubject = normalizeSubject(t.subject);
        return threadSubject === normalizedSubject;
      });

      if (matchingThreads.length === 0) return null;

      // If multiple matches, return the most recent one
      return matchingThreads.sort(
        (a, b) => new Date(b.lastMessageAt || b.createdAt) - new Date(a.lastMessageAt || a.createdAt)
      )[0];
    },
  },

  /**
   * Strategy 5: Sender + timeframe matching
   */
  senderTimeframe: {
    name: 'sender_timeframe',
    priority: 5,
    match: (email, existingThreads, existingMessages) => {
      if (!email.from || !email.date) return null;

      const emailDate = new Date(email.date);
      const windowStart = new Date(emailDate.getTime() - SENDER_MATCH_WINDOW_MS);
      const windowEnd = new Date(emailDate.getTime() + SENDER_MATCH_WINDOW_MS);

      // Find messages from same sender within timeframe
      const recentFromSameSender = existingMessages.filter((m) => {
        if (m.from !== email.from) return false;
        const msgDate = new Date(m.date);
        return msgDate >= windowStart && msgDate <= windowEnd;
      });

      if (recentFromSameSender.length === 0) return null;

      // Get unique thread IDs from these messages
      const threadIds = [...new Set(recentFromSameSender.map((m) => m.thread_id))];

      if (threadIds.length === 1) {
        return existingThreads.find((t) => t.id === threadIds[0]) || null;
      }

      // Multiple threads - too ambiguous, return null
      return null;
    },
  },
};

/**
 * Finds the best matching thread for an email using cascade strategy
 * @param {Object} email - Email object to match
 * @param {Object[]} existingThreads - Array of existing thread objects
 * @param {Object[]} existingMessages - Array of existing message objects
 * @param {Object} options - Matching options
 * @param {string[]} options.strategies - Which strategies to use (default: all)
 * @returns {Object} - { thread: Object|null, strategy: string|null, confidence: number }
 */
export function findMatchingThread(email, existingThreads = [], existingMessages = [], options = {}) {
  const {
    strategies = ['threadId', 'inReplyTo', 'references', 'subject', 'senderTimeframe'],
  } = options;

  // Try each strategy in priority order
  for (const strategyName of strategies) {
    const strategy = MATCHING_STRATEGIES[strategyName];
    if (!strategy) continue;

    const matchedThread = strategy.match(email, existingThreads, existingMessages);

    if (matchedThread) {
      return {
        thread: matchedThread,
        strategy: strategy.name,
        confidence: 1 - (strategy.priority - 1) * 0.15, // Higher priority = higher confidence
      };
    }
  }

  return {
    thread: null,
    strategy: null,
    confidence: 0,
  };
}

/**
 * Groups emails into threads
 * @param {Object[]} emails - Array of email objects to group
 * @param {Object} options - Grouping options
 * @returns {Map<string, Object[]>} - Map of thread ID to emails
 */
export function groupEmailsIntoThreads(emails, options = {}) {
  const threads = new Map();
  const processedEmails = [];
  let nextThreadId = 1;

  // Sort emails by date (oldest first)
  const sortedEmails = [...emails].sort((a, b) => new Date(a.date) - new Date(b.date));

  for (const email of sortedEmails) {
    // Build thread array from current state
    const existingThreads = [];
    for (const [threadId, threadEmails] of threads) {
      existingThreads.push({
        id: threadId,
        thread_id: threadEmails[0]?.thread_id,
        subject: threadEmails[0]?.subject,
        lastMessageAt: threadEmails[threadEmails.length - 1]?.date,
        createdAt: threadEmails[0]?.date,
      });
    }

    const result = findMatchingThread(email, existingThreads, processedEmails, options);

    let threadId;
    if (result.thread) {
      threadId = result.thread.id;
    } else {
      // Create new thread
      threadId = `thread_${nextThreadId++}`;
      threads.set(threadId, []);
    }

    // Add email to thread
    const threadEmails = threads.get(threadId);
    threadEmails.push({ ...email, matched_thread_id: threadId });
    processedEmails.push({ ...email, thread_id: threadId });
  }

  return threads;
}

/**
 * Detects if an email is part of a reply chain
 * @param {Object} email - Email object
 * @returns {boolean} - True if email appears to be a reply
 */
export function isReply(email) {
  if (!email) return false;

  // Check headers
  if (extractInReplyTo(email.headers)) return true;
  if (extractReferences(email.headers).length > 0) return true;

  // Check subject for reply indicators
  if (email.subject) {
    const subject = email.subject.toLowerCase();
    if (/^(re|res|r|sv|aw):/i.test(subject)) return true;
  }

  return false;
}

/**
 * Detects if an email is a forwarded message
 * @param {Object} email - Email object
 * @returns {boolean} - True if email appears to be forwarded
 */
export function isForward(email) {
  if (!email) return false;

  // Check subject for forward indicators
  if (email.subject) {
    if (/^(fwd?|enc|tr|wg):/i.test(email.subject)) return true;
  }

  // Check content for forward markers
  if (email.content || email.body) {
    const content = email.content || email.body;
    const forwardPatterns = [
      /---------- Forwarded message ----------/i,
      /---------- Mensagem encaminhada ----------/i,
      /----- Forwarded Message -----/i,
      /Begin forwarded message:/i,
    ];
    if (forwardPatterns.some((p) => p.test(content))) return true;
  }

  return false;
}

export default {
  normalizeSubject,
  extractInReplyTo,
  extractReferences,
  findMatchingThread,
  groupEmailsIntoThreads,
  isReply,
  isForward,
};
