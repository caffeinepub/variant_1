// Stub hook — backend interface has no active methods.
// Returns a typed null actor so App.tsx compiles without errors.
// The actor guard (if actor && identity) will never execute since actor is always null.

export interface ActorStub {
  saveSession: (
    sessionId: string,
    question: string,
    settings: {
      decimalPrecision: bigint;
      integerOnly: boolean;
      quantity: bigint;
      fractionMode: boolean;
    },
    variants: Array<{
      questionText: string;
      optionA: string;
      optionB: string;
      optionC: string;
      correctOption: string;
    }>,
  ) => Promise<void>;
}

export function useActor(): { actor: ActorStub | null; isFetching: boolean } {
  return { actor: null, isFetching: false };
}
