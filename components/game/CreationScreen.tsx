'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
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


function CoachDialogue({ text }: { text: string }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let index = 0;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timer = window.setInterval(() => {
      index = Math.min(text.length, index + (reduced ? text.length : 1));
      setCount((previous) => Math.max(previous, index));
      if (index >= text.length) window.clearInterval(timer);
    }, reduced ? 1 : 22);
    return () => window.clearInterval(timer);
  }, [text]);
  return <div className="coach-dialogue">
    <p className="eyebrow mb-2">ACADEMY COACH</p>
    <p className="min-h-16 text-base leading-relaxed text-zinc-100" aria-live="polite"><span className="sr-only">{text}</span><span aria-hidden="true">{text.slice(0, count)}<span className="ml-1 text-emerald-300">▾</span></span></p>
    {count < text.length ? <button type="button" onClick={() => setCount(text.length)} className="mt-2 text-xs text-zinc-400 hover:text-zinc-100">대사 끝까지 보기</button> : null}
  </div>;
}

export function CreationScreen() {
  const newCareer = useGameStore((s) => s.newCareer);
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [nationality, setNationality] = useState('KOR');
  const [position, setPosition] = useState<Position>('ST');
  const [playStyle, setPlayStyle] = useState<PlayStyle>('POACHER');
  const [dominantFoot, setDominantFoot] = useState<'LEFT' | 'RIGHT'>('RIGHT');
  const [heightCm, setHeightCm] = useState(182);
  const [weightKg, setWeightKg] = useState(76);
  const [clubId, setClubId] = useState(DEFAULT_CLUB);
  const leagueId = BASE_WORLD.clubs[clubId]?.leagueId ?? leagues[0].id;
  const leagueClubs = clubsByLeague.find((g) => g.league.id === leagueId)?.clubs ?? [];
  const [hair, setHair] = useState<HairColor>('BLACK');
  const [skin, setSkin] = useState<SkinTone>(3);
  const [eyes, setEyes] = useState<EyeColor>('DARK_BROWN');
  const input = { name: name.trim() || '나의 선수', nationality, role: { position, playStyle } as PlayerRole, dominantFoot, heightCm, weightKg, appearance: { hair, skin, eyes }, clubId };
  const preview = useMemo(() => createPlayer({ name: '미리보기', nationality, role: { position, playStyle } as PlayerRole, dominantFoot, heightCm, weightKg, appearance: { hair, skin, eyes }, clubId }, BASE_WORLD, { seed: 1, startSeason: 2026 }), [nationality, position, playStyle, dominantFoot, heightCm, weightKg, hair, skin, eyes, clubId]);
  const club = BASE_WORLD.clubs[clubId];
  const steps = ['이름과 국적', '플레이와 주발', '시작 팀', '외모'];
  const dialogue = [
    '어서 와! 나는 네 커리어를 함께할 코치야. 그라운드에 나서기 전에 서로 알아볼까? 네 이름과 어느 나라에서 왔는지 알려 줘.',
    `${name.trim()}, 반가워! 어느 자리에서 뛰고 싶니? 처음의 강점을 고르고, 잘 쓰는 발도 알려 줘. 세부 역할은 시작 능력치만 정해 줄 거야.`,
    '이제 첫 유니폼을 고를 차례야. 어떤 리그, 어떤 팀에서 도전을 시작하고 싶니? 팀의 수준에 따라 1군이나 유소년팀에서 출발하게 될 거야.',
    '마지막으로 네 모습을 보여 줘. 좋아, 준비가 끝나면 함께 훈련장으로 가자. 이제부터 네 축구 이야기가 시작되는 거야!',
  ][step];
  return <div className="creation-shell coach-setup">
    <header className="flex items-center gap-3 border-b border-zinc-800 pb-5">
      <span className="brand-mark"><PixelBall size={22} /></span><span className="text-sm font-bold tracking-wide">FOOTBALL CAREER</span><span className="ml-auto text-xs text-zinc-400">첫 만남</span>
    </header>
    <div className="my-6 flex flex-wrap items-end justify-between gap-4"><div><p className="eyebrow">A NEW CHAPTER</p><h1 className="mt-2 text-2xl font-bold sm:text-3xl">코치와의 첫 만남</h1></div><p className="text-xs text-zinc-400">16세, 새로운 이야기를 시작하다.</p></div>
    <ol className="mb-6 grid grid-cols-4 gap-2" aria-label="선수 생성 단계">{steps.map((label, index) => <li key={label} aria-current={index === step ? 'step' : undefined} className={index === step ? 'coach-step active' : 'coach-step'}><span className="font-semibold">{index < step ? '✓' : `0${index + 1}`}</span><span>{label}</span></li>)}</ol>
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
      <section className="px-panel overflow-hidden">
        <div className="coach-scene" aria-label="훈련장에서 기다리는 코치"><div className="coach-field-line" /><div className="coach-character"><Avatar appearance={{ hair: 'BROWN', skin: 5, eyes: 'DARK_BROWN' }} outfit="TUXEDO" size={172} label="아카데미 코치" /></div><p className="coach-scene-caption">ACADEMY TRAINING GROUND</p></div>
        <CoachDialogue key={step} text={dialogue} />
        <form className="border-t border-zinc-800 p-5 sm:p-6" onSubmit={(e) => { e.preventDefault(); if (!name.trim()) return; if (step < 3) setStep(step + 1); else newCareer(input); }}>
          <h2 className="mb-4 text-sm font-semibold text-zinc-100">{steps[step]}</h2>
          {step === 0 ? <div className="grid gap-4 sm:grid-cols-2">
            <Field label="이름"><input autoFocus required maxLength={20} placeholder="선수 이름을 알려 주세요" className={fieldClass} value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <Field label="국적"><select className={fieldClass} value={nationality} onChange={(e) => setNationality(e.target.value)}>{nations.map((n) => <option key={n.code} value={n.code}>{n.nameKo}</option>)}</select></Field>
          </div> : null}
          {step === 1 ? <div className="grid gap-4 sm:grid-cols-2">
            <Field label="포지션"><select className={fieldClass} value={position} onChange={(e) => { const next = e.target.value as Position; setPosition(next); setPlayStyle(PLAYSTYLES_BY_POSITION[next][0]); }}>{POSITIONS.map((p) => <option key={p} value={p}>{p} · {POSITION_META[p].label}</option>)}</select></Field>
            <Field label="초기 능력치 분배"><select className={fieldClass} value={playStyle} onChange={(e) => setPlayStyle(e.target.value as PlayStyle)}>{(PLAYSTYLES_BY_POSITION[position] as readonly PlayStyle[]).map((style) => <option key={style} value={style}>{PLAYSTYLE_DEFINITIONS[style].label}</option>)}</select></Field>
            <fieldset className="sm:col-span-2"><legend className="mb-2 text-xs text-zinc-400">주발</legend><div className="grid grid-cols-2 gap-3">{(['LEFT', 'RIGHT'] as const).map((foot) => <button type="button" key={foot} aria-pressed={dominantFoot === foot} className={`px-btn py-3 text-sm ${dominantFoot === foot ? 'border-emerald-400 bg-emerald-400/10 text-emerald-300' : 'bg-zinc-950 text-zinc-300'}`} onClick={() => setDominantFoot(foot)}>{foot === 'LEFT' ? '왼발' : '오른발'}</button>)}</div></fieldset>
            <Field label={`키 ${heightCm}cm`}><input type="range" min={155} max={205} value={heightCm} onChange={(e) => setHeightCm(Number(e.target.value))} /></Field>
            <Field label={`몸무게 ${weightKg}kg`}><input type="range" min={50} max={105} value={weightKg} onChange={(e) => setWeightKg(Number(e.target.value))} /></Field>
            <p className="text-xs leading-relaxed text-zinc-400 sm:col-span-2">세부 역할은 시작 능력치 분배에만 사용됩니다. 이후에는 현재 포지션과 실제 능력치로 플레이합니다. 약발 숙련도는 40에서 시작하며 훈련으로 높일 수 있습니다.</p>
          </div> : null}
          {step === 2 ? <div className="grid gap-4 sm:grid-cols-2">
            <Field label="시작 리그"><select className={fieldClass} value={leagueId} onChange={(e) => { const first = clubsByLeague.find((g) => g.league.id === e.target.value)?.clubs[0]; if (first) setClubId(first.id); }}>{leagueGroups.map(({ label, items }) => <optgroup key={label} label={label}>{items.map((league) => <option key={league.id} value={league.id}>{BASE_WORLD.nations[league.nation]?.nameKo} · {league.nameKo}</option>)}</optgroup>)}</select></Field>
            <Field label="시작 팀"><select className={fieldClass} value={clubId} onChange={(e) => setClubId(e.target.value)}>{leagueClubs.map((c) => <option key={c.id} value={c.id}>{c.nameKo}</option>)}</select></Field>
          </div> : null}
          {step === 3 ? <div className="grid gap-5 sm:grid-cols-3">
            <Swatches label="머리색" value={hair} onChange={setHair} options={Object.entries(HAIR_COLORS).map(([key, v]) => ({ key: key as HairColor, color: v.color, label: v.label }))} />
            <Swatches label="피부색" value={skin} onChange={setSkin} options={Object.entries(SKIN_TONES).map(([key, v]) => ({ key: Number(key) as SkinTone, color: v.color, label: v.label }))} />
            <Swatches label="눈동자" value={eyes} onChange={setEyes} options={Object.entries(EYE_COLORS).map(([key, v]) => ({ key: key as EyeColor, color: v.color, label: v.label }))} />
          </div> : null}
          <div className="mt-6 flex items-center justify-between gap-3"><Button disabled={step === 0} onClick={() => setStep(step - 1)}>← 이전</Button><Button type="submit" variant="primary" disabled={!name.trim()} className="px-5 py-3">{step === 3 ? '커리어 시작하기 →' : '다음으로 →'}</Button></div>
        </form>
      </section>
      <Card className="creation-preview flex flex-col items-center gap-4 text-center">
        <p className="eyebrow self-start">YOUR PROSPECT</p><PlayerStage className="w-full"><Avatar appearance={input.appearance} kit={club.kitColors} size={172} ball /></PlayerStage>
        <div><p className="text-xl font-bold">{input.name}</p><p className="mt-1 text-xs text-zinc-400">{BASE_WORLD.nations[nationality]?.nameKo} · 16세 · {position}</p><p className="mt-1 text-xs text-zinc-300">{club.nameKo} · {dominantFoot === 'LEFT' ? '왼발' : '오른발'}</p></div>
        <div className="grid w-full grid-cols-2 gap-3 border-y border-zinc-800 py-4 text-left"><Stat label="초기 OVR (예상)" value={preview.ovr} accent /><Stat label="시작 입지" value={SQUAD_LEVEL_LABELS[preview.squad.level]} sub={PLAYING_TIME_LABELS[preview.squad.playingTime]} /></div>
        <p className="text-xs text-zinc-400">질문에 답하면 선수 카드가 완성됩니다.</p><Link href="/sandbox" className="text-xs text-zinc-500 hover:text-zinc-300">시뮬레이션 샌드박스 ↗</Link>
      </Card>
    </div>
  </div>;
}
