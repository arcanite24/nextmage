import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { CAREER_SLEEVES } from '../ui/sleeveArt';
import type { ArtKind, RewardArt } from './careerArt';
import { SCHOOL_CRESTS } from './careerModesModel';
import { CAREER_AVATARS, CAREER_PLAYMATS } from './progressModel';

const client = new URL('../../../', import.meta.url);
const read = (path: string) => JSON.parse(readFileSync(new URL(path, client), 'utf8'));
const spec = (kind: ArtKind): string[] => read(`art/specs/${kind}.json`).items.map((item: { id: string }) => item.id);
const painted = (kind: ArtKind, id: string) => existsSync(new URL(`public/career-art/${kind}/${id}.webp`, client));

const KINDS: ArtKind[] = ['achievement', 'reward', 'frame', 'avatar', 'portrait', 'crest', 'sleeve', 'playmat'];
const REWARDS: RewardArt[] = [
  'coins', 'xp', 'wildcard-common', 'wildcard-uncommon', 'wildcard-rare', 'wildcard-mythic', 'pack', 'title', 'achievement', 'level',
  'graduate', 'unlock', 'lock', 'secret', 'sleeve', 'playmat',
];

describe('painted art', () => {
  test.each(KINDS)('every %s in its spec has its picture', (kind) => {
    expect(spec(kind).filter((id) => !painted(kind, id))).toEqual([]);
  });

  test('every Career achievement, avatar, sleeve, playmat and school has its picture', () => {
    const achievements: { id: string }[] = read('../Mage.Server/src/main/resources/career/achievements.json');
    expect(achievements.map((item) => item.id).filter((id) => !spec('achievement').includes(id))).toEqual([]);
    expect(Object.keys(CAREER_AVATARS).filter((id) => !spec('avatar').includes(id))).toEqual([]);
    expect(Object.keys(CAREER_SLEEVES).filter((id) => !spec('sleeve').includes(id))).toEqual([]);
    expect(CAREER_PLAYMATS.filter((id) => !spec('playmat').includes(id))).toEqual([]);
    expect(SCHOOL_CRESTS.filter((id) => !spec('crest').includes(id))).toEqual([]);
    expect(['W', 'U', 'B', 'R', 'G', 'C', 'M'].filter((id) => !spec('crest').includes(id))).toEqual([]);
    expect(['W', 'U', 'B', 'R', 'G', 'C'].flatMap((letter) => [letter, `${letter}-boss`]).filter((id) => !spec('portrait').includes(id))).toEqual([]);
    expect(REWARDS.filter((id) => !spec('reward').includes(id))).toEqual([]);
  });
});
