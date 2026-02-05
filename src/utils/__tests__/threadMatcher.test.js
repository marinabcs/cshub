import { describe, it, expect } from 'vitest';
import {
  normalizeSubject,
  extractInReplyTo,
  extractReferences,
  findMatchingThread,
  groupEmailsIntoThreads,
  isReply,
  isForward,
} from '../threadMatcher';

// ============================================
// NORMALIZE SUBJECT
// ============================================

describe('normalizeSubject', () => {
  it('remove Re: prefix', () => {
    expect(normalizeSubject('Re: Hello')).toBe('hello');
  });

  it('remove stacked Re: prefixes', () => {
    expect(normalizeSubject('Re: RE: Re: Hello')).toBe('hello');
  });

  it('remove Fwd: prefix', () => {
    expect(normalizeSubject('Fwd: Hello')).toBe('hello');
  });

  it('remove Fw: prefix', () => {
    expect(normalizeSubject('Fw: Hello')).toBe('hello');
  });

  it('remove Enc: prefix (Portuguese forward)', () => {
    expect(normalizeSubject('Enc: Hello')).toBe('hello');
  });

  it('remove Res: prefix (Portuguese reply)', () => {
    expect(normalizeSubject('Res: Hello')).toBe('hello');
  });

  it('remove SV: prefix (Swedish)', () => {
    expect(normalizeSubject('SV: Hello')).toBe('hello');
  });

  it('remove AW: prefix (German)', () => {
    expect(normalizeSubject('AW: Hello')).toBe('hello');
  });

  it('remove bracketed tags', () => {
    expect(normalizeSubject('[TICKET-123] Hello World')).toBe('hello world');
  });

  it('remove trailing parentheticals', () => {
    expect(normalizeSubject('Hello (was: old subject)')).toBe('hello');
  });

  it('normalizes whitespace', () => {
    expect(normalizeSubject('  Hello   World  ')).toBe('hello world');
  });

  it('converts to lowercase', () => {
    expect(normalizeSubject('HELLO WORLD')).toBe('hello world');
  });

  it('returns empty for null/undefined', () => {
    expect(normalizeSubject(null)).toBe('');
    expect(normalizeSubject(undefined)).toBe('');
    expect(normalizeSubject('')).toBe('');
  });

  it('handles non-string input', () => {
    expect(normalizeSubject(123)).toBe('');
  });

  it('removes mixed prefixes and tags', () => {
    expect(normalizeSubject('Re: Fwd: [External] Meeting Notes')).toBe('meeting notes');
  });
});

// ============================================
// EXTRACT IN-REPLY-TO
// ============================================

describe('extractInReplyTo', () => {
  it('extracts from In-Reply-To header', () => {
    const headers = { 'In-Reply-To': '<msg123@mail.com>' };
    expect(extractInReplyTo(headers)).toBe('msg123@mail.com');
  });

  it('extracts from lowercase header', () => {
    const headers = { 'in-reply-to': '<msg456@mail.com>' };
    expect(extractInReplyTo(headers)).toBe('msg456@mail.com');
  });

  it('extracts from camelCase header', () => {
    const headers = { inReplyTo: 'msg789@mail.com' };
    expect(extractInReplyTo(headers)).toBe('msg789@mail.com');
  });

  it('returns null for missing header', () => {
    expect(extractInReplyTo({})).toBeNull();
  });

  it('returns null for null/undefined', () => {
    expect(extractInReplyTo(null)).toBeNull();
    expect(extractInReplyTo(undefined)).toBeNull();
  });
});

// ============================================
// EXTRACT REFERENCES
// ============================================

describe('extractReferences', () => {
  it('extracts space-separated references', () => {
    const headers = { References: '<msg1@mail.com> <msg2@mail.com>' };
    const refs = extractReferences(headers);
    expect(refs).toEqual(['msg1@mail.com', 'msg2@mail.com']);
  });

  it('handles single reference', () => {
    const headers = { references: '<msg1@mail.com>' };
    expect(extractReferences(headers)).toEqual(['msg1@mail.com']);
  });

  it('returns empty array for missing', () => {
    expect(extractReferences({})).toEqual([]);
  });

  it('returns empty array for null', () => {
    expect(extractReferences(null)).toEqual([]);
  });
});

// ============================================
// FIND MATCHING THREAD
// ============================================

describe('findMatchingThread', () => {
  it('matches by thread_id (strategy 1)', () => {
    const email = { thread_id: 'thread-abc' };
    const threads = [{ id: 't1', thread_id: 'thread-abc' }];
    const result = findMatchingThread(email, threads, []);
    expect(result.thread).not.toBeNull();
    expect(result.strategy).toBe('thread_id');
    expect(result.confidence).toBe(1);
  });

  it('matches by In-Reply-To (strategy 2)', () => {
    const email = { headers: { 'In-Reply-To': '<msg1@mail.com>' } };
    const threads = [{ id: 't1' }];
    const messages = [{ message_id: 'msg1@mail.com', thread_id: 't1' }];
    const result = findMatchingThread(email, threads, messages);
    expect(result.thread.id).toBe('t1');
    expect(result.strategy).toBe('in_reply_to');
    expect(result.confidence).toBe(0.85);
  });

  it('matches by References (strategy 3)', () => {
    const email = { headers: { References: '<ref1@mail.com>' } };
    const threads = [{ id: 't1' }];
    const messages = [{ message_id: 'ref1@mail.com', thread_id: 't1' }];
    const result = findMatchingThread(email, threads, messages);
    expect(result.thread.id).toBe('t1');
    expect(result.strategy).toBe('references');
  });

  it('matches by subject (strategy 4)', () => {
    const email = { subject: 'Re: Project Update' };
    const threads = [{ id: 't1', subject: 'Project Update' }];
    const result = findMatchingThread(email, threads, []);
    expect(result.thread.id).toBe('t1');
    expect(result.strategy).toBe('subject');
  });

  it('returns null when no match', () => {
    const email = { subject: 'Completely new topic' };
    const threads = [{ id: 't1', subject: 'Different topic' }];
    const result = findMatchingThread(email, threads, []);
    expect(result.thread).toBeNull();
    expect(result.strategy).toBeNull();
    expect(result.confidence).toBe(0);
  });

  it('respects strategy order (thread_id > in_reply_to)', () => {
    const email = {
      thread_id: 'thread-abc',
      headers: { 'In-Reply-To': '<msg1@mail.com>' },
    };
    const threads = [
      { id: 't1', thread_id: 'thread-abc' },
      { id: 't2' },
    ];
    const messages = [{ message_id: 'msg1@mail.com', thread_id: 't2' }];
    const result = findMatchingThread(email, threads, messages);
    expect(result.thread.id).toBe('t1'); // thread_id takes priority
  });

  it('can limit strategies used', () => {
    const email = { thread_id: 'thread-abc', subject: 'Re: Hello' };
    const threads = [
      { id: 't1', thread_id: 'thread-abc' },
      { id: 't2', subject: 'Hello' },
    ];
    const result = findMatchingThread(email, threads, [], {
      strategies: ['subject'], // Only use subject strategy
    });
    expect(result.thread.id).toBe('t2');
    expect(result.strategy).toBe('subject');
  });

  it('subject too short (<3 chars) does not match', () => {
    const email = { subject: 'Re: AB' };
    const threads = [{ id: 't1', subject: 'AB' }];
    const result = findMatchingThread(email, threads, [], {
      strategies: ['subject'],
    });
    expect(result.thread).toBeNull();
  });
});

// ============================================
// GROUP EMAILS INTO THREADS
// ============================================

describe('groupEmailsIntoThreads', () => {
  it('groups emails with same thread_id', () => {
    const emails = [
      { thread_id: 'th1', subject: 'Hello', date: '2026-01-01' },
      { thread_id: 'th1', subject: 'Re: Hello', date: '2026-01-02' },
    ];
    const threads = groupEmailsIntoThreads(emails);
    expect(threads.size).toBe(1);
  });

  it('creates new threads for unmatched emails', () => {
    const emails = [
      { subject: 'Topic A', date: '2026-01-01' },
      { subject: 'Topic B', date: '2026-01-02' },
    ];
    const threads = groupEmailsIntoThreads(emails);
    expect(threads.size).toBe(2);
  });

  it('sorts emails by date (oldest first)', () => {
    const emails = [
      { subject: 'B', date: '2026-01-02', thread_id: 'th1' },
      { subject: 'A', date: '2026-01-01', thread_id: 'th1' },
    ];
    const threads = groupEmailsIntoThreads(emails);
    const threadEmails = [...threads.values()][0];
    expect(new Date(threadEmails[0].date) < new Date(threadEmails[1].date)).toBe(true);
  });
});

// ============================================
// IS REPLY
// ============================================

describe('isReply', () => {
  it('detects by In-Reply-To header', () => {
    expect(isReply({ headers: { 'In-Reply-To': '<msg@mail.com>' } })).toBe(true);
  });

  it('detects by References header', () => {
    expect(isReply({ headers: { References: '<msg@mail.com>' } })).toBe(true);
  });

  it('detects by Re: subject', () => {
    expect(isReply({ subject: 'Re: Hello' })).toBe(true);
  });

  it('detects by Res: subject', () => {
    expect(isReply({ subject: 'Res: Hello' })).toBe(true);
  });

  it('returns false for non-reply', () => {
    expect(isReply({ subject: 'Hello' })).toBe(false);
  });

  it('returns false for null', () => {
    expect(isReply(null)).toBe(false);
  });
});

// ============================================
// IS FORWARD
// ============================================

describe('isForward', () => {
  it('detects by Fwd: subject', () => {
    expect(isForward({ subject: 'Fwd: Hello' })).toBe(true);
  });

  it('detects by Fw: subject', () => {
    expect(isForward({ subject: 'Fw: Hello' })).toBe(true);
  });

  it('detects by Enc: subject', () => {
    expect(isForward({ subject: 'Enc: Hello' })).toBe(true);
  });

  it('detects by content marker (English)', () => {
    expect(isForward({ subject: 'Hello', content: '---------- Forwarded message ----------' })).toBe(true);
  });

  it('detects by content marker (Portuguese)', () => {
    expect(isForward({ subject: 'Hello', body: '---------- Mensagem encaminhada ----------' })).toBe(true);
  });

  it('returns false for non-forward', () => {
    expect(isForward({ subject: 'Hello', content: 'Normal email' })).toBe(false);
  });

  it('returns false for null', () => {
    expect(isForward(null)).toBe(false);
  });
});
