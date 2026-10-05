'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const story = require('../src/story.js');
const engine = require('../src/state.js');
const act = (state, type, payload = {}) => engine.transition(state, { type, ...payload }, story);
const choose = (state, choice = 0) => act(state, 'CHOOSE', { choiceId: story.scenes[state.scene].perspectives[state.loop].choices[choice].id });
const restore = (state) => {
  const decoded = engine.deserialize(engine.serialize(state), story);
  assert.deepEqual(decoded, state, `restore ${state.screen}:${state.loop}:${state.scene}`);
  return decoded;
};
const facts = () => story.scenes.map(({ id, fact, evidenceIds, time, place }) => ({ id, fact, evidenceIds, time, place }));
function reflection() {
  let state = act(engine.createState(), 'BEGIN');
  while (state.screen !== 'reflection') {
    state = state.screen === 'interlude' ? act(state, 'REPEAT') : act(choose(state), 'NEXT');
  }
  return state;
}
function solve(state) {
  for (const evidenceId of story.puzzle.requiredEvidence) state = act(state, 'INSPECT', { evidenceId });
  return act(state, 'SOLVE', { hypothesis: story.puzzle.answer, evidenceIds: story.puzzle.requiredEvidence });
}

test('actual STORY supplies all scene, perspective, evidence, puzzle, and UI key contracts', () => {
  const text = (value) => assert.ok(typeof value === 'string' && value.trim().length > 0);
  const paragraphs = (value) => { assert.ok(Array.isArray(value) && value.length > 0); value.forEach(text); };
  text(story.title); text(story.subtitle); paragraphs(story.intro); paragraphs(story.outro);
  assert.equal(story.loops.length, 3);
  assert.equal(story.scenes.length, 6);
  assert.equal(new Set(story.scenes.map((scene) => scene.id)).size, 6);
  const evidenceIds = story.evidence.map((item) => item.id);
  assert.equal(new Set(evidenceIds).size, evidenceIds.length);
  story.evidence.forEach((item) => { text(item.id); text(item.title); text(item.subtitle); paragraphs(item.body); });
  story.loops.forEach((loop) => { text(loop.name); text(loop.subtitle); text(loop.intro); paragraphs(loop.interlude); });
  const choiceIds = [];
  story.scenes.forEach((scene) => {
    ['id', 'title', 'time', 'place', 'art'].forEach((key) => text(scene[key]));
    paragraphs(scene.fact);
    assert.equal(new Set(scene.evidenceIds).size, scene.evidenceIds.length);
    scene.evidenceIds.forEach((id) => assert.ok(evidenceIds.includes(id), id));
    assert.equal(scene.perspectives.length, 3);
    scene.perspectives.forEach((perspective) => {
      paragraphs(perspective.intro); text(perspective.prompt);
      assert.equal(perspective.choices.length, 3);
      perspective.choices.forEach((choice) => {
        text(choice.id); text(choice.label); paragraphs(choice.text);
        assert.match(choice.id, /^[a-z0-9-]+$/);
        choiceIds.push(choice.id);
      });
    });
  });
  assert.equal(choiceIds.length, 54);
  assert.equal(new Set(choiceIds).size, 54);
  assert.deepEqual(story.puzzle.requiredEvidence, ['program', 'device']);
  assert.equal(story.puzzle.answer, 'planned');
  assert.ok(story.puzzle.hypotheses.some((item) => item.id === story.puzzle.answer));
  story.puzzle.hypotheses.forEach((item) => { text(item.id); text(item.label); text(item.feedback); });
  text(story.puzzle.question); text(story.puzzle.hint); paragraphs(story.puzzle.explanation);
  assert.deepEqual(story.endings.map((ending) => ending.id), ['carry', 'leave', 'open']);
  story.endings.forEach((ending) => { text(ending.label); text(ending.title); paragraphs(ending.text); });
});

test('all 54 actual choices retain physical facts and evidence and round-trip with UI readChoices keys', () => {
  const originalStory = JSON.stringify(story);
  const originalFacts = JSON.stringify(facts());
  let state = act(engine.createState(), 'BEGIN');
  let count = 0;
  for (let loop = 0; loop < 3; loop += 1) {
    for (let scene = 0; scene < 6; scene += 1) {
      assert.equal(state.loop, loop); assert.equal(state.scene, scene);
      const beforeEvidence = state.evidence.slice();
      const beforeHistory = engine.serialize(state.history);
      for (const choice of story.scenes[scene].perspectives[loop].choices) {
        const old = engine.serialize(state);
        const next = act(state, 'CHOOSE', { choiceId: choice.id });
        assert.equal(engine.serialize(state), old);
        state = restore(next);
        assert.equal(state.screen, 'play'); assert.equal(state.loop, loop); assert.equal(state.scene, scene);
        assert.deepEqual(state.evidence, beforeEvidence);
        assert.equal(engine.serialize(state.history), beforeHistory);
        assert.deepEqual(engine.selectedChoice(state, story), choice);
        assert.ok(engine.canAdvance(state, story));
        assert.ok(state.read.includes(`${loop}:${scene}`));
        assert.ok(state.readChoices.includes(`${loop}:${scene}:${choice.id}`));
        assert.equal(JSON.stringify(facts()), originalFacts);
        count += 1;
      }
      state = restore(act(state, 'NEXT'));
    }
    if (loop < 2) state = restore(act(state, 'REPEAT'));
  }
  assert.equal(count, 54);
  assert.equal(state.readChoices.length, 54);
  assert.equal(state.read.length, 18);
  assert.equal(JSON.stringify(story), originalStory);
});

test('all evidence is available during the first loop, independent of inner choice', () => {
  for (let choice = 0; choice < 3; choice += 1) {
    let state = act(engine.createState(), 'BEGIN');
    for (let scene = 0; scene < 6; scene += 1) {
      for (const evidenceId of story.scenes[scene].evidenceIds) state = act(state, 'INSPECT', { evidenceId });
      state = act(choose(state, choice), 'NEXT');
    }
    assert.equal(state.screen, 'interlude'); assert.equal(state.loop, 0);
    assert.deepEqual(state.evidence.slice().sort(), story.evidence.map((item) => item.id).sort());
    restore(state);
  }
});

test('actual STORY save regression covers every screen and every unselected/selected play page', () => {
  const screens = new Set();
  const checkpoints = [];
  const check = (state) => { screens.add(state.screen); checkpoints.push(`${state.screen}:${state.loop}:${state.scene}`); return restore(state); };
  let state = check(engine.createState());
  state = check(act(state, 'BEGIN'));
  while (state.screen !== 'reflection') {
    if (state.screen === 'interlude') state = check(act(state, 'REPEAT'));
    else { state = check(choose(state)); state = check(act(state, 'NEXT')); }
  }
  state = check(act(state, 'SOLVE', { hypothesis: 'lever', evidenceIds: [] }));
  assert.equal(state.solved, false);
  state = check(solve(state));
  assert.equal(state.solved, true);
  for (const ending of story.endings) check(act(state, 'END', { endingId: ending.id }));
  assert.deepEqual([...screens].sort(), ['intro', 'play', 'interlude', 'reflection', 'ending'].sort());
  assert.equal(checkpoints.filter((key) => key.startsWith('play:')).length, 36);
  assert.equal(checkpoints.filter((key) => key.startsWith('interlude:')).length, 2);
});

test('three actual endings remain reachable and ending notebook can inspect all unread evidence', () => {
  const state = solve(reflection());
  assert.equal(state.evidence.length, 2);
  for (const ending of story.endings) {
    let endState = act(state, 'END', { endingId: ending.id });
    assert.equal(endState.screen, 'ending'); assert.equal(endState.ending, ending.id);
    for (const evidence of story.evidence) endState = act(endState, 'INSPECT', { evidenceId: evidence.id });
    assert.equal(endState.evidence.length, story.evidence.length);
    assert.equal(endState.ending, ending.id);
    restore(endState);
    const back = restore(act(endState, 'BACK'));
    assert.equal(back.screen, 'reflection'); assert.equal(back.solved, true);
    assert.equal(back.evidence.length, story.evidence.length);
  }
});

test('actual choice reads survive BACK and saved reload while current interpretation can change', () => {
  let state = act(engine.createState(), 'BEGIN');
  const first = story.scenes[0].perspectives[0].choices[0];
  state = act(state, 'CHOOSE', { choiceId: first.id });
  state = act(state, 'NEXT');
  const second = story.scenes[1].perspectives[0].choices[1];
  state = act(state, 'CHOOSE', { choiceId: second.id });
  state = restore(act(state, 'BACK'));
  assert.equal(state.scene, 0);
  assert.ok(state.readChoices.includes(`0:0:${first.id}`));
  assert.ok(state.readChoices.includes(`0:1:${second.id}`));
  assert.equal(state.choices['0:1'], undefined);
  const alternative = story.scenes[0].perspectives[0].choices[2];
  state = restore(act(state, 'CHOOSE', { choiceId: alternative.id }));
  assert.equal(engine.selectedChoice(state, story).id, alternative.id);
  assert.ok(state.readChoices.includes(`0:0:${first.id}`));
  assert.ok(state.readChoices.includes(`0:0:${alternative.id}`));
});
