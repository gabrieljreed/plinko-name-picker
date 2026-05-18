const DEFAULT_SETTINGS = {
  physicsMode: false,
  fullBoard: false,
  aimingMode: false,
  bumperPads: true,
  slidingBumper: false,
  ballSize: 30,
};

export const STORAGE_KEYS = {
  names: 'plinko-names',
  physicsMode: 'plinko-physics-mode',
  aimingMode: 'plinko-aiming-mode',
  fullBoard: 'plinko-full-board',
  bumperPads: 'plinko-bumper-pads',
  slidingBumper: 'plinko-sliding-bumper',
  ballSize: 'plinko-ball-size',
};

function readBoolean(value, fallback) {
  if (value === null) return fallback;
  return value === 'true';
}

function readNumber(value, fallback) {
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function normalizeSettings(settings = {}) {
  return {
    ...DEFAULT_SETTINGS,
    ...settings,
  };
}

export function loadAppSnapshot(storage = localStorage) {
  return {
    namesText: storage.getItem(STORAGE_KEYS.names) ?? '',
    settings: {
      physicsMode: readBoolean(storage.getItem(STORAGE_KEYS.physicsMode), DEFAULT_SETTINGS.physicsMode),
      fullBoard: readBoolean(storage.getItem(STORAGE_KEYS.fullBoard), DEFAULT_SETTINGS.fullBoard),
      aimingMode: readBoolean(storage.getItem(STORAGE_KEYS.aimingMode), DEFAULT_SETTINGS.aimingMode),
      bumperPads: readBoolean(storage.getItem(STORAGE_KEYS.bumperPads), DEFAULT_SETTINGS.bumperPads),
      slidingBumper: readBoolean(storage.getItem(STORAGE_KEYS.slidingBumper), DEFAULT_SETTINGS.slidingBumper),
      ballSize: readNumber(storage.getItem(STORAGE_KEYS.ballSize), DEFAULT_SETTINGS.ballSize),
    },
  };
}

export function saveAppSnapshot(storage = localStorage, snapshot) {
  const namesText = snapshot?.namesText ?? '';
  const settings = normalizeSettings(snapshot?.settings);

  storage.setItem(STORAGE_KEYS.names, namesText);
  storage.setItem(STORAGE_KEYS.physicsMode, String(settings.physicsMode));
  storage.setItem(STORAGE_KEYS.fullBoard, String(settings.fullBoard));
  storage.setItem(STORAGE_KEYS.aimingMode, String(settings.aimingMode));
  storage.setItem(STORAGE_KEYS.bumperPads, String(settings.bumperPads));
  storage.setItem(STORAGE_KEYS.slidingBumper, String(settings.slidingBumper));
  storage.setItem(STORAGE_KEYS.ballSize, String(settings.ballSize));
}
