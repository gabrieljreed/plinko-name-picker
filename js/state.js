const DEFAULT_SETTINGS = {
  physicsMode: false,
  fullBoard: false,
  aimingMode: false,
  bumperPads: true,
  slidingBumper: false,
  ballSize: 30,
};

function cloneEntrant(entrant) {
  return { ...entrant };
}

function cloneEntrants(entrants) {
  return entrants.map(cloneEntrant);
}

function parseLabels(text) {
  return text
    .split('\n')
    .map((label) => label.trim())
    .filter(Boolean);
}

function createEntrant(id, label) {
  return { id, label };
}

function nextEntrantIdValue(state) {
  return state.nextEntrantId ?? 1;
}

function findReusableEntrantIndex(entrants, label) {
  return entrants.findIndex((entrant) => entrant.label === label);
}

function buildEntrants(previousEntrants, labels, nextEntrantId) {
  const reusable = [...previousEntrants];
  const entrants = [];
  let nextId = nextEntrantId;

  for (const label of labels) {
    const matchIndex = findReusableEntrantIndex(reusable, label);
    if (matchIndex !== -1) {
      entrants.push(reusable.splice(matchIndex, 1)[0]);
      continue;
    }

    entrants.push(createEntrant(`e${nextId}`, label));
    nextId += 1;
  }

  return { entrants, nextEntrantId: nextId };
}

function activeEntrantIdSet(state) {
  return new Set(state.entrants.map((entrant) => entrant.id));
}

function reconcileOrder(order, activeIds) {
  return order.filter((id) => activeIds.has(id));
}

function defaultShuffleIndices(count, random = Math.random) {
  const indices = Array.from({ length: count }, (_, index) => index);
  for (let i = indices.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return indices;
}

function shuffledIds(entrants, shuffleIndices) {
  const indices = shuffleIndices(entrants.length);
  return indices.map((index) => entrants[index].id);
}

export function createInitialState(overrides = {}) {
  return {
    entrants: [],
    slotOrder: [],
    stableSlotOrder: [],
    originalEntrants: null,
    pendingWinnerId: null,
    dropInFlight: false,
    nextEntrantId: 1,
    settings: {
      ...DEFAULT_SETTINGS,
      ...overrides.settings,
    },
    ...overrides,
  };
}

export function createShuffledIndices(count, random = Math.random) {
  return defaultShuffleIndices(count, random);
}

export function setEntrantsFromText(state, text) {
  const labels = parseLabels(text);
  const { entrants, nextEntrantId } = buildEntrants(
    state.entrants,
    labels,
    nextEntrantIdValue(state),
  );
  const activeIds = new Set(entrants.map((entrant) => entrant.id));

  return {
    ...state,
    entrants,
    nextEntrantId,
    slotOrder: reconcileOrder(state.slotOrder, activeIds),
    stableSlotOrder: reconcileOrder(state.stableSlotOrder, activeIds),
    pendingWinnerId: activeIds.has(state.pendingWinnerId) ? state.pendingWinnerId : null,
  };
}

export function syncSlotOrder(state, shuffleIndices = createShuffledIndices) {
  if (state.entrants.length === 0) {
    return {
      ...state,
      slotOrder: [],
      stableSlotOrder: [],
    };
  }

  const activeIds = activeEntrantIdSet(state);
  const currentOrder = reconcileOrder(state.slotOrder, activeIds);
  const missingEntrants = state.entrants.filter((entrant) => !currentOrder.includes(entrant.id));

  if (missingEntrants.length === 0 && currentOrder.length === state.entrants.length) {
    const stableSlotOrder = state.stableSlotOrder.length === currentOrder.length
      ? reconcileOrder(state.stableSlotOrder, activeIds)
      : [...currentOrder];
    return {
      ...state,
      slotOrder: currentOrder,
      stableSlotOrder,
    };
  }

  const slotOrder = [
    ...currentOrder,
    ...shuffledIds(missingEntrants, shuffleIndices),
  ];

  return {
    ...state,
    slotOrder,
    stableSlotOrder: [...slotOrder],
  };
}

export function beginRound(state, shuffleIndices = createShuffledIndices) {
  const nextState = syncSlotOrder(state, shuffleIndices);
  return {
    ...nextState,
    originalEntrants: nextState.originalEntrants ?? cloneEntrants(nextState.entrants),
    stableSlotOrder: [...nextState.slotOrder],
    dropInFlight: true,
  };
}

export function markPendingWinner(state, winnerId) {
  return {
    ...state,
    pendingWinnerId: winnerId,
    dropInFlight: false,
  };
}

export function cancelPendingWinner(state) {
  return {
    ...state,
    pendingWinnerId: null,
    dropInFlight: false,
  };
}

export function confirmPendingWinner(state) {
  if (!state.pendingWinnerId) {
    return state;
  }

  return {
    ...state,
    entrants: state.entrants.filter((entrant) => entrant.id !== state.pendingWinnerId),
    slotOrder: [],
    stableSlotOrder: [],
    pendingWinnerId: null,
    dropInFlight: false,
  };
}

export function restartRound(state) {
  if (!state.originalEntrants) {
    return {
      ...state,
      pendingWinnerId: null,
      dropInFlight: false,
    };
  }

  return {
    ...state,
    entrants: cloneEntrants(state.originalEntrants),
    slotOrder: [],
    stableSlotOrder: [],
    originalEntrants: null,
    pendingWinnerId: null,
    dropInFlight: false,
  };
}

export function updateSettings(state, settingsPatch) {
  return {
    ...state,
    settings: {
      ...state.settings,
      ...settingsPatch,
    },
  };
}

export function getEntrantsText(state) {
  return state.entrants.map((entrant) => entrant.label).join('\n');
}

export function getEntrantById(state, entrantId) {
  return state.entrants.find((entrant) => entrant.id === entrantId) ?? null;
}

export function getEntrantLabel(state, entrantId) {
  return getEntrantById(state, entrantId)?.label ?? '';
}

export function getSlotEntrants(state) {
  const entrantsById = new Map(state.entrants.map((entrant) => [entrant.id, entrant]));
  return state.slotOrder
    .map((entrantId) => entrantsById.get(entrantId))
    .filter(Boolean);
}

export function getStableSlotEntrants(state) {
  const entrantsById = new Map(state.entrants.map((entrant) => [entrant.id, entrant]));
  return state.stableSlotOrder
    .map((entrantId) => entrantsById.get(entrantId))
    .filter(Boolean);
}
