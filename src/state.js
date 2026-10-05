(function () {
  'use strict';

  const VERSION = 1;
  const MAX_HISTORY = 150;
  const MAX_SAVE_BYTES = 250000;
  const MAX_ATTEMPTS = 1000000;
  const FIELDS = ['version', 'screen', 'loop', 'scene', 'choices', 'evidence', 'read', 'readChoices', 'solved', 'attempts', 'ending'];
  const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
  const keyFor = (state) => state.loop + ':' + state.scene;
  const unique = (items) => Array.from(new Set(items));

  function createState() {
    return {
      version: VERSION, screen: 'intro', loop: 0, scene: 0,
      choices: {}, evidence: [], read: [], readChoices: [],
      solved: false, attempts: 0, ending: null, history: []
    };
  }

  function currentChoices(state, story) {
    return story && story.scenes && story.scenes[state.scene] &&
      story.scenes[state.scene].perspectives[state.loop].choices;
  }

  function selectedChoice(state, story) {
    const choices = currentChoices(state, story);
    return choices ? choices.find((choice) => choice.id === state.choices[keyFor(state)]) || null : null;
  }

  function canAdvance(state, story) {
    return state.screen === 'play' && selectedChoice(state, story) !== null;
  }

  function snapshot(state) {
    const result = {};
    FIELDS.forEach((field) => { result[field] = state[field]; });
    result.choices = { ...state.choices };
    result.evidence = state.evidence.slice();
    result.read = state.read.slice();
    result.readChoices = state.readChoices.slice();
    return result;
  }

  function move(state, updates) {
    const next = { ...snapshot(state), ...updates, history: state.history.concat(snapshot(state)).slice(-MAX_HISTORY) };
    if (next.screen === 'play') next.read = unique(next.read.concat(keyFor(next)));
    return next;
  }

  // Navigation alone creates history. Changing an interpretation stays on its page.
  // BACK restores the earlier interpretation while retaining the reader's memory.
  function transition(state, action, story) {
    if (!state || !action || typeof action.type !== 'string') return state;
    switch (action.type) {
      case 'BEGIN':
        return state.screen === 'intro' ? move(state, { screen: 'play' }) : state;
      case 'CHOOSE': {
        if (state.screen !== 'play') return state;
        const choices = currentChoices(state, story);
        if (!choices || !choices.some((choice) => choice.id === action.choiceId)) return state;
        const key = keyFor(state);
        if (state.choices[key] === action.choiceId) return state;
        return { ...state, choices: { ...state.choices, [key]: action.choiceId }, readChoices: unique(state.readChoices.concat(key + ':' + action.choiceId)) };
      }
      case 'NEXT':
        if (!canAdvance(state, story)) return state;
        if (state.scene < story.scenes.length - 1) return move(state, { scene: state.scene + 1 });
        return move(state, { screen: state.loop < story.loops.length - 1 ? 'interlude' : 'reflection' });
      case 'REPEAT':
        return state.screen === 'interlude' && state.loop < story.loops.length - 1
          ? move(state, { screen: 'play', loop: state.loop + 1, scene: 0 }) : state;
      case 'INSPECT': {
        if (typeof action.evidenceId !== 'string' || !story.evidence.some((item) => item.id === action.evidenceId)) return state;
        const known = state.evidence.includes(action.evidenceId);
        const available = ['reflection', 'ending'].includes(state.screen) || (state.screen === 'play' && story.scenes[state.scene].evidenceIds.includes(action.evidenceId));
        if (known || !available) return state;
        return { ...state, evidence: state.evidence.concat(action.evidenceId) };
      }
      case 'SOLVE': {
        if (state.screen !== 'reflection' || state.solved || typeof action.hypothesis !== 'string' || !Array.isArray(action.evidenceIds) || action.evidenceIds.some((id) => typeof id !== 'string')) return state;
        const required = story.puzzle.requiredEvidence;
        const submitted = action.evidenceIds;
        const correct = action.hypothesis === story.puzzle.answer && submitted.length === required.length &&
          new Set(submitted).size === submitted.length && submitted.every((id) => required.includes(id) && state.evidence.includes(id));
        return { ...state, solved: correct, attempts: Math.min(MAX_ATTEMPTS, state.attempts + 1) };
      }
      case 'END':
        return state.screen === 'reflection' && state.solved && story.endings.some((ending) => ending.id === action.endingId)
          ? move(state, { screen: 'ending', ending: action.endingId }) : state;
      case 'BACK': {
        if (!state.history.length) return state;
        const previous = snapshot(state.history[state.history.length - 1]);
        return {
          ...previous, history: state.history.slice(0, -1),
          evidence: unique(previous.evidence.concat(state.evidence)),
          read: unique(previous.read.concat(state.read)),
          readChoices: unique(previous.readChoices.concat(state.readChoices))
        };
      }
      default: return state;
    }
  }

  function plain(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
  }

  function validStringArray(value, allowed) {
    return Array.isArray(value) && value.length <= allowed.size && new Set(value).size === value.length && value.every((item) => typeof item === 'string' && allowed.has(item));
  }

  function validSnapshot(value, story, withHistory) {
    if (!plain(value)) return false;
    const fields = withHistory ? FIELDS.concat('history') : FIELDS;
    if (Object.keys(value).length !== fields.length || !fields.every((field) => own(value, field))) return false;
    if (value.version !== VERSION || !Number.isInteger(value.loop) || value.loop < 0 || value.loop >= story.loops.length || !Number.isInteger(value.scene) || value.scene < 0 || value.scene >= story.scenes.length) return false;
    if (!['intro', 'play', 'interlude', 'reflection', 'ending'].includes(value.screen)) return false;
    const lastLoop = story.loops.length - 1;
    const lastScene = story.scenes.length - 1;
    if (value.screen === 'intro' && (value.loop !== 0 || value.scene !== 0)) return false;
    if (value.screen === 'interlude' && (value.loop === lastLoop || value.scene !== lastScene)) return false;
    if (['reflection', 'ending'].includes(value.screen) && (value.loop !== lastLoop || value.scene !== lastScene)) return false;
    if (typeof value.solved !== 'boolean' || !Number.isInteger(value.attempts) || value.attempts < 0 || value.attempts > MAX_ATTEMPTS) return false;
    if (!['reflection', 'ending'].includes(value.screen) && (value.solved || value.attempts !== 0)) return false;
    if (value.solved && value.attempts === 0) return false;
    if (value.screen === 'ending' ? !value.solved || !story.endings.some((item) => item.id === value.ending) : value.ending !== null) return false;

    const nodeIds = new Set();
    const choiceIds = new Set();
    const choicesByNode = new Map();
    story.loops.forEach((_, loop) => story.scenes.forEach((scene, index) => {
      const key = loop + ':' + index;
      nodeIds.add(key);
      const choices = scene.perspectives[loop].choices.map((choice) => choice.id);
      choicesByNode.set(key, choices);
      choices.forEach((id) => choiceIds.add(key + ':' + id));
    }));
    if (!validStringArray(value.evidence, new Set(story.evidence.map((item) => item.id))) ||
        !validStringArray(value.read, nodeIds) || !validStringArray(value.readChoices, choiceIds) || !plain(value.choices)) return false;
    const entries = Object.entries(value.choices);
    if (entries.length > nodeIds.size || entries.some(([key, id]) => !nodeIds.has(key) || !choicesByNode.get(key).includes(id) || !value.read.includes(key) || !value.readChoices.includes(key + ':' + id))) return false;
    if (value.readChoices.some((id) => !value.read.includes(id.split(':').slice(0, 2).join(':')))) return false;
    const position = value.loop * story.scenes.length + value.scene;
    const completed = ['interlude', 'reflection', 'ending'].includes(value.screen) ? position + 1 : position;
    for (let index = 0; index < completed; index += 1) {
      if (!own(value.choices, Math.floor(index / story.scenes.length) + ':' + index % story.scenes.length)) return false;
    }
    if (value.screen === 'intro' && entries.length) return false;
    if (entries.some(([key]) => {
      const parts = key.split(':').map(Number);
      return parts[0] * story.scenes.length + parts[1] > position;
    })) return false;
    if (value.screen === 'play' && !value.read.includes(keyFor(value))) return false;
    if (value.solved && !story.puzzle.requiredEvidence.every((id) => value.evidence.includes(id))) return false;
    return true;
  }

  function serialize(state) {
    return JSON.stringify(state);
  }

  function deserialize(raw, story) {
    if (typeof raw !== 'string' || raw.length > MAX_SAVE_BYTES) return null;
    try {
      // Count UTF-8 bytes without requiring browser or Node globals.
      if (encodeURIComponent(raw).replace(/%[A-F\d]{2}/g, 'x').length > MAX_SAVE_BYTES) return null;
      const state = JSON.parse(raw);
      if (!validSnapshot(state, story, true) || !Array.isArray(state.history) || state.history.length > MAX_HISTORY || state.history.some((entry) => !validSnapshot(entry, story, false))) return null;
      return state;
    } catch (_) {
      return null;
    }
  }

  globalThis.JourneyState = { createState, transition, serialize, deserialize, selectedChoice, canAdvance };
  if (typeof module !== 'undefined') module.exports = globalThis.JourneyState;
}());
