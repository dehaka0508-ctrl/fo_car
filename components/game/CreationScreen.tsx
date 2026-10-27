'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Avatar } from '@/components/Avatar';
import { PixelBall } from '@/components/pixel/PixelIcons';
import { PlayerStage } from '@/components/pixel/PlayerStage';
import { EYE_COLORS, HAIR_COLORS, SKIN_TONES } from '@/data/appearance';
import { PLAYING_TIME_LABELS, SQUAD_LEVEL_LABELS } from '@/data/labels';
import { PLAYSTYLE_DEFINITIONS, POSITION_META } from '@/data/playstyles';
import { BASE_WORLD } from '@/engine/career';
import { findClubId } from '@/engine/world';
import { createPlayer } from '@/engine/character';
import { useGameStore } from '@/store/gameStore';
import {
  PLAYSTYLES_BY_POSITION,
  POSITIONS,
  type EyeColor,
  type HairColor,
  type PlayerRole,
  type PlayStyle,
  type Position,
  type SkinTone,
} from '@/types/game';
import { Button, Card, Field, fieldClass, Stat } from './ui';

const nations = Object.values(BASE_WORLD.nations).sort((a, b) => a.nameKo.localeCompare(b.nameKo, 'ko'));
const leagues = Object.values(BASE_WORLD.leagues);
/** 기본 소속팀: 울산 (DB가 바뀌어도 이름으로 찾고, 없으면 첫 구단) */
const DEFAULT_CLUB = findClubId(BASE_WORLD.clubs, 'Ulsan', 'KOR') ?? Object.keys(BASE_WORLD.clubs)[0];
const clubsByLeague = leagues.map((league) => ({
  league,
  clubs: Object.values(BASE_WORLD.clubs)
    .filter((club) => club.leagueId === league.id)
    .sort((a, b) => b.power - a.power || a.nameKo.localeCompare(b.nameKo, 'ko')),
}));
const CONFEDERATION_LABELS: Record<string, string> = { UEFA: '유럽', AFC: '아시아', CONMEBOL: '남미', CONCACAF: '북중미', CAF: '아프리카' };
const leagueGroups = Object.entries(CONFEDERATION_LABELS)
  .map(([conf, label]) => ({ label, items: leagues.filter((l) => l.confederation === conf) }))
  .filter((g) => g.items.length);

/** 색 견본 버튼 (외형 선택) */
function Swatches<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<{ key: T; color: string; label: string }>;
  onChange: (key: T) => void;
}) {
  const current = options.find((o) => o.key === value);
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-zinc-400">
        {label} <span className="text-zinc-200">{current?.label}</span>
      </span>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.key}
            type="button"
            role="radio"
            aria-checked={o.key === value}
            aria-label={o.label}
            title={o.label}
            onClick={() => onChange(o.key)}
            className={[
              'px-focus size-7 rounded-full border border-white/20 transition',
              o.key === value ? 'outline-2 outline-offset-2 outline-emerald-300' : 'opacity-80 hover:opacity-100',
            ].join(' ')}
            style={{ background: o.color }}
          />
        ))}
      </div>
    </div>
  );
}

export function CreationScreen() {
  const newCareer = useGameStore((s) => s.newCareer);
  const [name, setName] = useState('김유망');
  const [nationality, setNationality] = useState('KOR');
  const [position, setPosition] = useState<Position>('ST');
  const [playStyle, setPlayStyle] = useState<PlayStyle>('POACHER');
  const [heightCm, setHeightCm] = useState(182);
  const [weightKg, setWeightKg] = useState(76);
  const [clubId, setClubId] = useState(DEFAULT_CLUB);
  const leagueId = BASE_WORLD.clubs[clubId]?.leagueId ?? leagues[0].id;
  const leagueClubs = clubsByLeague.find((g) => g.league.id === leagueId)?.clubs ?? [];
  const [hair, setHair] = useState<HairColor>('BLACK');
  const [skin, setSkin] = useState<SkinTone>(3);
  const [eyes, setEyes] = useState<EyeColor>('DARK_BROWN');

  const input = {
    name: name.trim() || '이름 없음',
    nationality,
    role: { position, playStyle } as PlayerRole,
    heightCm,
    weightKg,
    appearance: { hair, skin, eyes },
    clubId,
  };
  // 미리보기는 고정 시드로 (실제 시작 시에는 새 시드)
  const preview = useMemo(
    () => createPlayer(input, BASE_WORLD, { seed: 1, startSeason: 2026 }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [name, nationality, position, playStyle, heightCm, weightKg, clubId, hair, skin, eyes],
  );
  const club = BASE_WORLD.clubs[clubId];

  return (
    <div className="creation-shell">
      <div className="flex items-center gap-3 border-b border-zinc-800 pb-5">
        <span className="brand-mark"><PixelBall size={22} /></span>
        <span className="text-sm font-bold tracking-wide text-zinc-100">FOOTBALL CAREER</span>
        <span className="ml-auto text-xs text-zinc-400">나만의 축구 인생</span>
      </div>
      <header className="creation-intro">
        <p className="eyebrow">NEW CAREER / 01</p>
        <h1>당신의 축구 인생이<br />여기서 시작됩니다.</h1>
        <p>16세 유망주에서 구단의 레전드까지. 나만의 선수를 만들고,<br className="hidden sm:block" /> 그라운드 위에서 새로운 이야기를 써 내려가세요.</p>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Card title="선수 프로필" actions={<span className="text-xs text-zinc-500">PLAYER SETUP</span>} className="creation-form p-6">
          <p className="mb-5 text-xs leading-relaxed text-zinc-400">포지션과 신체 조건에 따라 초기 능력치가 달라집니다. 시작 팀의 수준에 맞춰 1군·B팀·유소년팀에서 커리어를 시작합니다.</p>
          <div className="grid gap-x-5 gap-y-5 sm:grid-cols-2">
            <Field label="이름">
              <input className={fieldClass} value={name} maxLength={20} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="국적">
              <select className={fieldClass} value={nationality} onChange={(e) => setNationality(e.target.value)}>
                {nations.map((n) => (
                  <option key={n.code} value={n.code}>
                    {n.nameKo}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="포지션">
              <select
                className={fieldClass}
                value={position}
                onChange={(e) => {
                  const next = e.target.value as Position;
                  setPosition(next);
                  setPlayStyle(PLAYSTYLES_BY_POSITION[next][0]);
                }}
              >
                {POSITIONS.map((p) => (
                  <option key={p} value={p}>
                    {p} · {POSITION_META[p].label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="플레이 스타일">
              <select className={fieldClass} value={playStyle} onChange={(e) => setPlayStyle(e.target.value as PlayStyle)}>
                {(PLAYSTYLES_BY_POSITION[position] as readonly PlayStyle[]).map((s) => (
                  <option key={s} value={s}>
                    {PLAYSTYLE_DEFINITIONS[s].label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={`키 ${heightCm}cm`}>
              <input type="range" min={155} max={205} value={heightCm} onChange={(e) => setHeightCm(Number(e.target.value))} />
            </Field>
            <Field label={`몸무게 ${weightKg}kg`}>
              <input type="range" min={50} max={105} value={weightKg} onChange={(e) => setWeightKg(Number(e.target.value))} />
            </Field>
            <Field label={`시작 리그 (${leagues.length}개)`}>
              <select
                className={fieldClass}
                value={leagueId}
                onChange={(e) => {
                  const first = clubsByLeague.find((g) => g.league.id === e.target.value)?.clubs[0];
                  if (first) setClubId(first.id);
                }}
              >
                {leagueGroups.map(({ label, items }) => (
                  <optgroup key={label} label={label}>
                    {items.map((league) => (
                      <option key={league.id} value={league.id}>
                        {BASE_WORLD.nations[league.nation]?.nameKo} · {league.nameKo}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </Field>
            <Field label={`시작 팀 (${leagueClubs.length}개 · 실력순)`}>
              <select className={fieldClass} value={clubId} onChange={(e) => setClubId(e.target.value)}>
                {leagueClubs.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nameKo}
                  </option>
                ))}
              </select>
            </Field>
            <div className="grid gap-5 border-t border-zinc-800 pt-5 sm:col-span-2 sm:grid-cols-3">
              <Swatches
                label="머리색"
                value={hair}
                onChange={setHair}
                options={Object.entries(HAIR_COLORS).map(([key, v]) => ({ key: key as HairColor, color: v.color, label: v.label }))}
              />
              <Swatches
                label="피부색"
                value={skin}
                onChange={setSkin}
                options={Object.entries(SKIN_TONES).map(([key, v]) => ({ key: Number(key) as SkinTone, color: v.color, label: `${key}단계 · ${v.label}` }))}
              />
              <Swatches
                label="눈동자"
                value={eyes}
                onChange={setEyes}
                options={Object.entries(EYE_COLORS).map(([key, v]) => ({ key: key as EyeColor, color: v.color, label: v.label }))}
              />
            </div>
          </div>
        </Card>

        <Card className="creation-preview flex flex-col items-center gap-5 self-start p-6 text-center">
          <p className="eyebrow self-start">YOUR PROSPECT</p>
          <PlayerStage className="w-full">
            <Avatar appearance={input.appearance} kit={club.kitColors} size={172} ball idle />
          </PlayerStage>
          <div>
            <p className="text-xl font-bold text-zinc-50">{input.name}</p>
            <p className="text-xs text-zinc-400">
              {BASE_WORLD.nations[nationality]?.nameKo} · 16세 · {club.nameKo}
            </p>
          </div>
          <div className="grid w-full grid-cols-2 gap-4 border-y border-zinc-800 py-5 text-left">
            <Stat label="초기 OVR (예상)" value={preview.ovr} accent />
            <Stat label="시작 입지" value={SQUAD_LEVEL_LABELS[preview.squad.level]} sub={PLAYING_TIME_LABELS[preview.squad.playingTime]} />
          </div>
          <Button variant="primary" className="w-full py-3 text-sm" onClick={() => newCareer(input)}>
            커리어 시작하기 →
          </Button>
          <Link href="/sandbox" className="text-xs text-zinc-500 underline-offset-2 hover:underline">
            시뮬레이션 샌드박스 ↗
          </Link>
        </Card>
      </div>
    </div>
  );
}
