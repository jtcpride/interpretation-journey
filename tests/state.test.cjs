'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createState, transition, serialize, deserialize, selectedChoice, canAdvance } = require('../src/state.js');

const story = {
  loops: [{}, {}, {}],
  scenes: Array.from({ length: 6 }, (_, scene) => ({
    id: 'scene-' + scene,
    perspectives: Array.from({ length: 3 }, (_, loop) => ({
      choices: ['a', 'b', 'c'].map((id) => ({ id, label: id, text: `Inner ${loop}:${scene}:${id}` }))
    })),
    evidenceIds: scene === 1 ? ['letter'] : scene === 4 ? ['clock'] : []
  })),
  evidence: [{ id: 'letter' }, { id: 'clock' }],
  puzzle: { answer: 'planned', requiredEvidence: ['letter', 'clock'] },
  endings: ['carry', 'leave', 'open'].map((id) => ({ id }))
};
const act = (state, type, extra = {}) => transition(state, { type, ...extra }, story);
const roundTrip = (state) => assert.deepEqual(deserialize(serialize(state), story), state);
const choose = (state, choiceId = 'a') => act(state, 'CHOOSE', { choiceId });
function reachReflection(collect = true) {
  let state = act(createState(), 'BEGIN');
  for (let loop = 0; loop < 3; loop += 1) {
    for (let scene = 0; scene < 6; scene += 1) {
      if (collect) for (const evidenceId of story.scenes[scene].evidenceIds) state = act(state, 'INSPECT', { evidenceId });
      state = act(choose(state), 'NEXT');
    }
    if (loop < 2) state = act(state, 'REPEAT');
  }
  return state;
}

test('initial state, immutable transitions, and unknown actions', () => {
  const initial = createState();
  const before = serialize(initial);
  assert.equal(initial.screen, 'intro');
  roundTrip(initial);
  for (const type of ['NEXT', 'REPEAT', 'BACK', 'END', 'CHOOSE', 'SOLVE', 'unknown']) assert.strictEqual(act(initial, type), initial);
  assert.strictEqual(transition(initial, null, story), initial);
  const playing = act(initial, 'BEGIN');
  assert.equal(serialize(initial), before);
  assert.deepEqual(playing.read, ['0:0']);
  assert.equal(canAdvance(playing, story), false);
  assert.strictEqual(act(playing, 'NEXT'), playing);
  assert.strictEqual(choose(playing, '<script>'), playing);
  const chosen = choose(playing);
  assert.equal(playing.choices['0:0'], undefined);
  assert.equal(selectedChoice(chosen, story).id, 'a');
  assert.equal(canAdvance(chosen, story), true);
  roundTrip(chosen);
});

test('all 18 pages, interludes, and every screen survive save and reload', () => {
  let state = act(createState(), 'BEGIN');
  for (let loop = 0; loop < 3; loop += 1) {
    for (let scene = 0; scene < 6; scene += 1) {
      assert.equal(state.loop, loop);
      assert.equal(state.scene, scene);
      assert.equal(state.screen, 'play');
      state = choose(state, ['a', 'b', 'c'][loop]);
      roundTrip(state);
      state = act(state, 'NEXT');
    }
    assert.equal(state.screen, loop < 2 ? 'interlude' : 'reflection');
    roundTrip(state);
    if (loop < 2) state = act(state, 'REPEAT');
  }
  assert.equal(state.read.length, 18);
  assert.equal(Object.keys(state.choices).length, 18);
  assert.strictEqual(act(state, 'NEXT'), state);
  assert.strictEqual(act(state, 'REPEAT'), state);
});

test('changing inner monologue never changes physical position or story', () => {
  const originalStory = JSON.stringify(story);
  const state = act(createState(), 'BEGIN');
  const chosen = choose(choose(state), 'c');
  assert.equal(chosen.scene, state.scene);
  assert.equal(chosen.loop, state.loop);
  assert.deepEqual(chosen.evidence, state.evidence);
  assert.equal(chosen.history.length, state.history.length);
  assert.deepEqual(chosen.readChoices, ['0:0:a', '0:0:c']);
  assert.equal(JSON.stringify(story), originalStory);
  assert.strictEqual(choose(chosen, 'c'), chosen);
});

test('inspect is scene-bound and idempotent; BACK retains memory and permits reselection', () => {
  let state = act(createState(), 'BEGIN');
  assert.strictEqual(act(state, 'INSPECT', { evidenceId: 'letter' }), state);
  state = act(choose(state), 'NEXT');
  state = act(state, 'INSPECT', { evidenceId: 'letter' });
  assert.deepEqual(state.evidence, ['letter']);
  assert.strictEqual(act(state, 'INSPECT', { evidenceId: 'letter' }), state);
  assert.strictEqual(act(state, 'INSPECT', { evidenceId: 'fake' }), state);
  state = choose(state, 'b');
  state = act(state, 'BACK');
  assert.equal(state.scene, 0);
  assert.equal(selectedChoice(state, story).id, 'a');
  assert.deepEqual(state.evidence, ['letter']);
  assert.ok(state.read.includes('0:1'));
  assert.ok(state.readChoices.includes('0:1:b'));
  assert.equal(state.choices['0:1'], undefined);
  state = choose(state, 'c');
  roundTrip(state);
  state = act(state, 'BACK');
  assert.equal(state.screen, 'intro');
  assert.deepEqual(state.evidence, ['letter']);
  roundTrip(state);
});

test('puzzle requires correct hypothesis and exactly both distinct inspected clues', () => {
  const state = reachReflection();
  for (const [hypothesis, evidenceIds] of [['accident', ['letter', 'clock']], ['planned', ['letter']], ['planned', ['letter', 'letter']], ['planned', ['letter', 'clock', 'fake']]]) {
    const failed = act(state, 'SOLVE', { hypothesis, evidenceIds });
    assert.equal(failed.solved, false);
    assert.equal(failed.attempts, 1);
    assert.equal(failed.scene, 5);
    assert.equal(failed.screen, 'reflection');
    roundTrip(failed);
  }
  const unseen = act(reachReflection(false), 'SOLVE', { hypothesis: 'planned', evidenceIds: ['letter', 'clock'] });
  assert.equal(unseen.solved, false);
  const solved = act(state, 'SOLVE', { hypothesis: 'planned', evidenceIds: ['clock', 'letter'] });
  assert.equal(solved.solved, true);
  assert.equal(solved.attempts, 1);
  assert.equal(state.solved, false);
  roundTrip(solved);
  assert.strictEqual(act(solved, 'SOLVE', { hypothesis: 'planned', evidenceIds: [] }), solved);
});

test('all endings are reachable only after solving, and BACK restores reflection', () => {
  const state = reachReflection();
  assert.strictEqual(act(state, 'END', { endingId: 'carry' }), state);
  const solved = act(state, 'SOLVE', { hypothesis: 'planned', evidenceIds: ['letter', 'clock'] });
  assert.strictEqual(act(solved, 'END', { endingId: 'unknown' }), solved);
  for (const endingId of ['carry', 'leave', 'open']) {
    const ending = act(solved, 'END', { endingId });
    assert.equal(ending.screen, 'ending');
    assert.equal(ending.ending, endingId);
    roundTrip(ending);
    const back = act(ending, 'BACK');
    assert.equal(back.screen, 'reflection');
    assert.equal(back.solved, true);
    assert.equal(back.ending, null);
    roundTrip(back);
  }
});

test('reflection allows missed evidence to be inspected and the puzzle completed', () => {
  let state = reachReflection(false);
  assert.deepEqual(state.evidence, []);
  for (const evidenceId of ['clock', 'letter']) state = act(state, 'INSPECT', { evidenceId });
  state = act(state, 'SOLVE', { hypothesis: 'planned', evidenceIds: ['letter', 'clock'] });
  assert.equal(state.solved, true);
  assert.equal(state.screen, 'reflection');
  roundTrip(state);
});

test('transitions accept frozen state and story without mutation', () => {
  const freeze = (value) => {
    if (value && typeof value === 'object') {
      Object.values(value).forEach(freeze);
      Object.freeze(value);
    }
    return value;
  };
  const frozenStory = freeze(JSON.parse(JSON.stringify(story)));
  let state = freeze(createState());
  for (const action of [{ type: 'BEGIN' }, { type: 'CHOOSE', choiceId: 'a' }, { type: 'NEXT' }, { type: 'INSPECT', evidenceId: 'letter' }, { type: 'BACK' }]) {
    state = freeze(transition(state, action, frozenStory));
  }
  assert.equal(state.scene, 0);
  assert.deepEqual(state.evidence, ['letter']);
});

test('BACK crosses interludes and final reflection consistently', () => {
  let state = reachReflection();
  state = act(state, 'BACK');
  assert.equal(state.screen, 'play');
  assert.equal(state.loop, 2);
  assert.equal(state.scene, 5);
  roundTrip(state);
  while (!(state.screen === 'play' && state.loop === 2 && state.scene === 0)) state = act(state, 'BACK');
  state = act(state, 'BACK');
  assert.equal(state.screen, 'interlude');
  assert.equal(state.loop, 1);
  roundTrip(state);
  state = act(state, 'BACK');
  assert.equal(state.screen, 'play');
  assert.equal(state.scene, 5);
  assert.equal(state.read.length, 18);
  roundTrip(state);
});

test('deserialize rejects corruption, unknown schemas, forged ids, and unsafe payloads', () => {
  const valid = choose(act(createState(), 'BEGIN'));
  for (const raw of [null, '', '{', 'null', '[]', '0', '"hello"', ' '.repeat(250001)]) assert.equal(deserialize(raw, story), null);
  const corruptions = [
    (s) => { s.version = 2; }, (s) => { s.scene = 6; }, (s) => { s.loop = -1; },
    (s) => { s.screen = 'hacked'; }, (s) => { s.extra = true; }, (s) => { delete s.read; },
    (s) => { s.choices['0:0'] = '<img onerror=alert(1)>'; }, (s) => { s.choices['2:5'] = 'a'; },
    (s) => { s.evidence = ['unknown']; }, (s) => { s.read = ['bad']; },
    (s) => { s.readChoices = ['0:0:bogus']; }, (s) => { s.attempts = -1; },
    (s) => { s.solved = true; }, (s) => { s.ending = 'carry'; },
    (s) => { s.history = Array(151).fill(s.history[0]); },
    (s) => { s.history[0].history = []; }, (s) => { s.history[0].version = 42; },
    (s) => { s.evidence = ['letter', 'letter']; }, (s) => { s.screen = 'reflection'; },
    (s) => { s.choices = JSON.parse('{"__proto__":{"polluted":true}}'); }
  ];
  for (const change of corruptions) {
    const state = JSON.parse(serialize(valid));
    change(state);
    assert.equal(deserialize(JSON.stringify(state), story), null);
  }
  assert.equal({}.polluted, undefined);
});

test('decoded state owns its arrays and bounded history caps at 150', () => {
  let state = choose(act(createState(), 'BEGIN'));
  const restored = deserialize(serialize(state), story);
  restored.choices['0:0'] = 'b';
  assert.equal(state.choices['0:0'], 'a');
  // Seed a long valid history to exercise the cap without cycling UI navigation.
  state.history = Array(150).fill(createState()).map(({ history, ...entry }) => entry);
  state = act(state, 'NEXT');
  assert.equal(state.history.length, 150);
  roundTrip(state);
});
