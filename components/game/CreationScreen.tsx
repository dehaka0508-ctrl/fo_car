'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Avatar } from '@/components/Avatar';
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
              'px-focus size-7 shadow-[0_0_0_2px_#05080f]',
              o.key === value ? 'outline-2 outline-offset-2 outline-amber-300' : 'opacity-80 hover:opacity-100',
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
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-1 self-start bg-zinc-950/70 px-3 py-2 shadow-[0_0_0_2px_rgb(5_8_15/0.5)]">
        <p className="font-pixel text-xs font-bold text-emerald-400 drop-shadow-[2px_2px_0_#05080f]">NEW CAREER · 새 커리어</p>
        <h1 className="text-2xl font-bold text-zinc-50 drop-shadow-[3px_3px_0_#05080f]">16세 유망주를 만들어 주세요</h1>
        <p className="text-sm text-zinc-200 drop-shadow-[1px_1px_0_#05080f]">
          포지션·플레이 스타일·키·몸무게로 초기 능력치가 정해지고, 시작 팀 수준과 비교해 1군·B팀·유소년팀 중 출발점이 정해집니다.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card>
          <div className="grid gap-3 sm:grid-cols-2">
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
            <div className="grid gap-4 border-t-2 border-dashed border-zinc-700 pt-4 sm:col-span-2 sm:grid-cols-3">
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

        <Card className="order-first flex flex-col items-center gap-4 self-start text-center lg:order-none">
          <PlayerStage className="w-full">
            <Avatar appearance={input.appearance} kit={club.kitColors} size={150} idle />
          </PlayerStage>
          <div>
            <p className="font-pixel text-base font-bold text-zinc-50">{input.name}</p>
            <p className="text-xs text-zinc-400">
              {BASE_WORLD.nations[nationality]?.nameKo} · 16세 · {club.nameKo}
            </p>
          </div>
          <div className="grid w-full grid-cols-2 gap-3 text-left">
            <Stat label="초기 OVR (예상)" value={preview.ovr} accent />
            <Stat label="시작 입지" value={SQUAD_LEVEL_LABELS[preview.squad.level]} sub={PLAYING_TIME_LABELS[preview.squad.playingTime]} />
          </div>
          <Button variant="primary" className="w-full py-3 text-sm" onClick={() => newCareer(input)}>
            ▶ 커리어 시작
          </Button>
          <Link href="/sandbox" className="text-xs text-zinc-500 underline-offset-2 hover:underline">
            엔진 샌드박스 열기
          </Link>
        </Card>
      </div>
    </div>
  );
}
