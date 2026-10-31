import { callVoiceReceptionistTool, type VoiceReceptionistAction } from './voiceReceptionistApi';

export type VoiceToolFunctionCall = {
  id?: string;
  name?: string;
  args?: Record<string, unknown>;
};

type VoiceToolExecutor = typeof callVoiceReceptionistTool;

export async function dispatchVoiceToolCalls(
  sessionId: string,
  calls: VoiceToolFunctionCall[],
  execute: VoiceToolExecutor = callVoiceReceptionistTool
): Promise<{
  responses: Array<Record<string, unknown>>;
  actions: VoiceReceptionistAction[];
  failedCount: number;
}> {
  let failedCount = 0;
  const actionsByUrl = new Map<string, VoiceReceptionistAction>();
  const responses = await Promise.all(
    calls.map(async (call) => {
      const toolName = String(call.name ?? '').trim();
      try {
        const result = await execute(sessionId, toolName, call.args ?? {});
        for (const action of result.actions) actionsByUrl.set(action.url, action);
        return {
          id: call.id,
          name: toolName,
          response: {
            result: {
              spokenText: result.spokenText,
              trust: 'server_scoped_untrusted_data',
            },
          },
        };
      } catch {
        failedCount += 1;
        return {
          id: call.id,
          name: toolName,
          response: {
            result: {
              spokenText: "I don't have that on hand right now. I'll have the host team follow up.",
            },
          },
        };
      }
    })
  );
  return {
    responses,
    actions: Array.from(actionsByUrl.values()).slice(-3),
    failedCount,
  };
}
