/**
 * Build chat history for AI after persisting a user message.
 * The in-memory conversation entity is stale after addMessage() updates JSONB in DB,
 * so the current user message must be appended explicitly.
 */
export function buildChatHistoryAfterUserMessage<
  T extends { role: string; content: string },
>(
  staleMessagesJsonb: T[] | null | undefined,
  userContent: string,
  userRole: string,
): T[] {
  return [
    ...(staleMessagesJsonb ?? []),
    { role: userRole, content: userContent } as T,
  ];
}
