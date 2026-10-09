// @vitest-environment happy-dom
import { beforeEach, describe, expect, test } from 'vitest';
import { GAMES_BEFORE_NO_GUIDE, useCoach } from './coach';

beforeEach(() => {
  localStorage.clear();
  useCoach.setState({ seen: [], firstGameDone: false, gamesPlayed: 0, guided: false });
});

describe('the guided game offer', () => {
  test('goes away after a few finished games, and stays away after a reload', () => {
    for (let game = 1; game < GAMES_BEFORE_NO_GUIDE; game++) useCoach.getState().gamePlayed();
    expect(useCoach.getState().firstGameDone).toBe(false);
    useCoach.getState().gamePlayed();
    expect(useCoach.getState().firstGameDone).toBe(true);
    expect(JSON.parse(localStorage.getItem('playmat.coach')!)).toMatchObject({ firstGameDone: true, gamesPlayed: GAMES_BEFORE_NO_GUIDE });
  });

  test('goes away for good once dismissed', () => {
    useCoach.getState().finish();
    expect(useCoach.getState().firstGameDone).toBe(true);
    expect(JSON.parse(localStorage.getItem('playmat.coach')!)).toMatchObject({ firstGameDone: true });
  });
});
