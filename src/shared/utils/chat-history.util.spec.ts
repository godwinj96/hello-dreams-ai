import { buildChatHistoryAfterUserMessage } from './chat-history.util';

describe('buildChatHistoryAfterUserMessage', () => {
  it('appends the current user message to stale in-memory history', () => {
    const stale = [
      { role: 'user', content: 'First message' },
      { role: 'assistant', content: 'Reply to first' },
    ];

    const result = buildChatHistoryAfterUserMessage(
      stale,
      'Second message',
      'user',
    );

    expect(result).toHaveLength(3);
    expect(result[2]).toEqual({ role: 'user', content: 'Second message' });
  });

  it('handles empty stale history', () => {
    const result = buildChatHistoryAfterUserMessage(null, 'Hello', 'user');
    expect(result).toEqual([{ role: 'user', content: 'Hello' }]);
  });
});
