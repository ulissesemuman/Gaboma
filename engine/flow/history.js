import state from '../core/state.js';

export function registerStateEvent({
  chapterId,
  events = [],
  effects = [],
  source = "choice", // choice | onEnter | system | combat | undo | auto
  choiceId = null
}) {
  const bookId = state.currentBookId;

  if (!bookId) {
    throw new Error("No current book selected");
  }

  const bookState = state.bookState[bookId];
  const progress = bookState.progress;
  const metadata = bookState.metadata;

  // 🔹 sequence sempre incrementa
  const nextSequence = (progress.sequence ?? 0) + 1;

  // 🔹 turn só incrementa se for escolha do jogador
  const nextTurn =
    source === "choice"
      ? progress.turn + 1
      : progress.turn;

  const entry = {
    sequence: nextSequence,
    turn: nextTurn,
    chapter: chapterId,
    source,
    choiceId,
    timeStamp: Date.now(),
    events,
    effects
  };

  state.persistGameData(bookId, {
    progress: {
      sequence: nextSequence,
      turn: nextTurn,
      addHistory: entry
    },
    metadata: {
      started: true,
      startedAt: metadata.startedAt ?? Date.now(),
      lastPlayedAt: Date.now()
    }
  });
}

export const History = {
  registerStateEvent
}