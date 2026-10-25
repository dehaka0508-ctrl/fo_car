'use client';

import { useMemo, useState } from 'react';
import { Avatar, PlayerToken } from '@/components/Avatar';
import { EYE_COLORS, HAIR_COLORS, SKIN_TONES } from '@/data/appearance';
import { ATTRIBUTE_GROUP_LABELS, ATTRIBUTE_META } from '@/data/attributes';
import {
  COMPETITION_TYPE_LABELS,
  HIGHLIGHT_KIND_LABELS,
  PLAYING_TIME_LABELS,
  SQUAD_LEVEL_LABELS,
  TURN_PHASE_LABELS,
} from '@/data/labels';
import { PLAYSTYLE_DEFINITIONS, POSITION_META } from '@/data/playstyles';
import { createPlayer, determineInitialSquadStatus } from '@/engine/character';
import { calculateOVR, rankPlayStyleFit } from '@/engine/ovr';
import { runDemoSeason } from '@/engine/season-demo';
import { averageRating } from '@/engine/simulator';
import { createDefaultWorld } from '@/engine/world';
import {
  ATTRIBUTE_KEYS,
  COMPETITION_TYPES,
  PLAYSTYLES_BY_POSITION,
  POSITIONS,
  type AttributeGroup,
  type Attributes,
  type EyeColor,
  type HairColor,
  type PlayerRole,
  type PlayerState,
  type PlayStyle,
  type Position,
  type SkinTone,
  type TurnResult,
} from '@/types/game';

const world = createDefaultWorld();
const SEASON = 2026;

const nations = Object.values(world.nations).sort((a, b) => a.nameKo.localeCompare(b.nameKo, 'ko'));
const leagues = Object.values(world.leagues);
const clubsByLeague = leagues.map((league) => ({
  league,
  clubs: Object.values(world.clubs)
    .filter((club) => club.leagueId === league.id)
    .sort((a, b) => a.nameKo.localeCompare(b.nameKo, 'ko')),
}));

const fieldClass =
  'w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100';
const cardClass = 'rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900';

function Field({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`flex flex-col gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-400 ${className}`}>
      {label}
      {children}
    </label>
  );
}

function formatRating(value: number | null) {
  return value === null ? '-' : value.toFixed(2);
}

export function SimulationSandbox() {
  const [name, setName] = useState('김유망');
  const [nationality, setNationality] = useState('KOR');
  const [position, setPosition] = useState<Position>('ST');
  const [playStyle, setPlayStyle] = useState<PlayStyle>('POACHER');
  const [heightCm, setHeightCm] = useState(182);
  const [weightKg, setWeightKg] = useState(76);
  const [clubId, setClubId] = useState('ulsan');
  const [hair, setHair] = useState<HairColor>('BLACK');
  const [skin, setSkin] = useState<SkinTone>(3);
  const [eyes, setEyes] = useState<EyeColor>('DARK_BROWN');
  const [seed, setSeed] = useState(1);
  const [growth, setGrowth] = useState(0);

  const role = { position, playStyle } as PlayerRole;
  const club = world.clubs[clubId];

  const player = useMemo<PlayerState>(() => {
    const base = createPlayer(
      { name, nationality, role: { position, playStyle } as PlayerRole, heightCm, weightKg, appearance: { hair, skin, eyes }, clubId },
      world,
      { seed, startSeason: SEASON },
    );
    if (growth === 0) return base;
    // '성장 가정': 모든 능력치를 올린 뒤 OVR·입지를 다시 계산
    const attributes = Object.fromEntries(
      Object.entries(base.attributes).map(([key, value]) => [key, Math.min(99, value + growth)]),
    ) as Attributes;
    const ovr = calculateOVR(attributes, base.profile.role);
    return {
      ...base,
      attributes,
      ovr,
      age: 16 + Math.round(growth / 5),
      reputation: Math.min(80, 5 + growth * 1.5),
      squad: determineInitialSquadStatus(ovr, world.clubStates[clubId].power, position === 'GK'),
    };
  }, [name, nationality, position, playStyle, heightCm, weightKg, clubId, hair, skin, eyes, seed, growth]);

  const season = useMemo(() => runDemoSeason(player, world, { seed, season: SEASON }), [player, seed]);
  const fits = rankPlayStyleFit(player.attributes, position);

  const groups = new Map<AttributeGroup, Array<(typeof ATTRIBUTE_KEYS)[number]>>();
  for (const key of ATTRIBUTE_KEYS) {
    const group = ATTRIBUTE_META[key].group;
    if (group === 'GOALKEEPING' && position !== 'GK') continue;
    groups.set(group, [...(groups.get(group) ?? []), key]);
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">엔진 프로토타입</p>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">축구 커리어 시뮬레이터 — 샌드박스</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          캐릭터를 만들면 초기 능력치·OVR·시작 입지를 계산하고, {SEASON}/{(SEASON + 1) % 100} 시즌 3턴(전반기·후반기·프리시즌)을
          자동 진행합니다. 하이라이트 선택지는 AI가 대신 고릅니다.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        {/* 캐릭터 설정 */}
        <section className={`${cardClass} flex flex-col gap-3 self-start`} aria-label="캐릭터 설정">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">캐릭터 생성</h2>
          <Field label="이름">
            <input className={fieldClass} value={name} onChange={(e) => setName(e.target.value)} />
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
          <div className="grid grid-cols-2 gap-2">
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
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label={`키 ${heightCm}cm`}>
              <input type="range" min={155} max={205} value={heightCm} onChange={(e) => setHeightCm(Number(e.target.value))} />
            </Field>
            <Field label={`몸무게 ${weightKg}kg`}>
              <input type="range" min={50} max={105} value={weightKg} onChange={(e) => setWeightKg(Number(e.target.value))} />
            </Field>
          </div>
          <Field label="시작 팀">
            <select className={fieldClass} value={clubId} onChange={(e) => setClubId(e.target.value)}>
              {clubsByLeague.map(({ league, clubs }) => (
                <optgroup key={league.id} label={league.nameKo}>
                  {clubs.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nameKo}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-3 gap-2">
            <Field label="머리색">
              <select className={fieldClass} value={hair} onChange={(e) => setHair(e.target.value as HairColor)}>
                {Object.entries(HAIR_COLORS).map(([key, v]) => (
                  <option key={key} value={key}>
                    {v.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="피부색">
              <select className={fieldClass} value={skin} onChange={(e) => setSkin(Number(e.target.value) as SkinTone)}>
                {Object.entries(SKIN_TONES).map(([key, v]) => (
                  <option key={key} value={key} title={v.label}>
                    {key}단계
                  </option>
                ))}
              </select>
            </Field>
            <Field label="눈동자">
              <select className={fieldClass} value={eyes} onChange={(e) => setEyes(e.target.value as EyeColor)}>
                {Object.entries(EYE_COLORS).map(([key, v]) => (
                  <option key={key} value={key}>
                    {v.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="mt-2 border-t border-zinc-200 pt-3 dark:border-zinc-800">
            <h3 className="mb-2 text-xs font-semibold text-zinc-500">테스트 옵션</h3>
            <Field label={`성장 가정 (모든 능력치 +${growth})`}>
              <input type="range" min={0} max={40} value={growth} onChange={(e) => setGrowth(Number(e.target.value))} />
            </Field>
            <div className="mt-2 flex items-end gap-2">
              <Field label="시드" className="flex-1">
                <input
                  type="number"
                  className={fieldClass}
                  value={seed}
                  onChange={(e) => setSeed(Math.max(1, Number(e.target.value) || 1))}
                />
              </Field>
              <button
                type="button"
                className="whitespace-nowrap rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700"
                onClick={() => setSeed((s) => s + 1)}
              >
                다시 돌리기
              </button>
            </div>
          </div>
        </section>

        <div className="flex min-w-0 flex-col gap-6">
          {/* 프로필 */}
          <section className={`${cardClass} flex flex-col gap-4 sm:flex-row`} aria-label="선수 프로필">
            <div className="flex flex-col items-center gap-2">
              <Avatar appearance={player.profile.appearance} kitColor={club.colors.primary} size={112} />
              <span className="text-xs text-zinc-500">{club.nameKo}</span>
            </div>
            <div className="flex flex-1 flex-col gap-3">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">{player.profile.name}</h2>
                <span className="text-sm text-zinc-500">
                  {world.nations[nationality]?.nameKo} · {player.age}세 · {heightCm}cm / {player.weightKg}kg
                </span>
              </div>
              <div className="flex flex-wrap gap-4">
                <Stat label="OVR" value={String(player.ovr)} accent />
                <Stat label="포지션" value={`${position} · ${PLAYSTYLE_DEFINITIONS[role.playStyle].label}`} />
                <Stat label="시작 입지" value={`${SQUAD_LEVEL_LABELS[player.squad.level]} · ${PLAYING_TIME_LABELS[player.squad.playingTime]}`} />
                <Stat label="입지 점수" value={`${player.squad.standing} → ${season.player.squad.standing}`} />
                <Stat label="명성" value={`${Math.round(player.reputation)} → ${Math.round(season.player.reputation)}`} />
              </div>
              <div className="text-xs text-zinc-600 dark:text-zinc-400">
                스타일 적합도: {fits.map((f) => `${PLAYSTYLE_DEFINITIONS[f.playStyle].label} ${f.ovr}`).join(' · ')}
              </div>
            </div>
          </section>

          {/* 능력치 */}
          <section className={cardClass} aria-label="능력치">
            <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">세부 능력치</h2>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {[...groups.entries()].map(([group, keys]) => (
                <div key={group}>
                  <h3 className="mb-1 text-xs font-semibold text-zinc-500">{ATTRIBUTE_GROUP_LABELS[group]}</h3>
                  <ul className="flex flex-col gap-1">
                    {keys.map((key) => (
                      <li key={key} className="flex items-center gap-2 text-xs">
                        <span className="w-16 shrink-0 text-zinc-700 dark:text-zinc-300">{ATTRIBUTE_META[key].label}</span>
                        <span className="h-2 flex-1 overflow-hidden rounded bg-zinc-100 dark:bg-zinc-800">
                          <span
                            className="block h-full rounded bg-emerald-500"
                            style={{ width: `${player.attributes[key]}%` }}
                          />
                        </span>
                        <span className="w-6 text-right tabular-nums text-zinc-900 dark:text-zinc-100">
                          {player.attributes[key]}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          {/* 시즌 결과 */}
          <section className="flex flex-col gap-3" aria-label="시즌 시뮬레이션 결과">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">시즌 시뮬레이션</h2>
              <p className="text-xs text-zinc-600 dark:text-zinc-400">
                평균 평점 — 전반기 {formatRating(season.seasonRatings.firstHalf)} · 후반기{' '}
                {formatRating(season.seasonRatings.secondHalf)} · 시즌 {formatRating(season.seasonRatings.season)} · 컵{' '}
                {formatRating(season.seasonRatings.cups)}
              </p>
            </div>
            <div className="grid gap-4 xl:grid-cols-3">
              {season.turns.map((turn) => (
                <TurnCard key={turn.turn.phase} turn={turn} player={player} />
              ))}
            </div>
            <LeagueTable turn={season.turns[1]} clubId={clubId} />
          </section>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex flex-col">
      <span className="text-[11px] text-zinc-500">{label}</span>
      <span
        className={
          accent
            ? 'text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400'
            : 'text-sm font-semibold text-zinc-900 dark:text-zinc-100'
        }
      >
        {value}
      </span>
    </div>
  );
}

function TurnCard({ turn, player }: { turn: TurnResult; player: PlayerState }) {
  const rows = COMPETITION_TYPES.filter((type) => turn.playerStats[type].appearances > 0 || turn.teamStats[type]);
  const h = turn.highlight;
  const ourScore = h
    ? h.playerTeamSide === 'HOME'
      ? `${h.score.home} - ${h.score.away}`
      : `${h.score.away} - ${h.score.home}`
    : '';

  return (
    <article className={`${cardClass} flex flex-col gap-3`}>
      <header className="flex items-center justify-between">
        <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">{TURN_PHASE_LABELS[turn.turn.phase]}</h3>
        <span className="text-xs text-zinc-500">
          체력 {turn.condition.start} → {turn.condition.end} · 멘탈 {turn.mental.start} → {turn.mental.end}
        </span>
      </header>

      <table className="w-full text-xs tabular-nums">
        <thead className="text-zinc-500">
          <tr>
            <th className="text-left font-medium">대회</th>
            <th className="text-right font-medium">팀 승무패</th>
            <th className="text-right font-medium">출전</th>
            <th className="text-right font-medium">골</th>
            <th className="text-right font-medium">도움</th>
            <th className="text-right font-medium">평점</th>
          </tr>
        </thead>
        <tbody className="text-zinc-800 dark:text-zinc-200">
          {rows.map((type) => {
            const line = turn.playerStats[type];
            const team = turn.teamStats[type];
            return (
              <tr key={type}>
                <td className="py-0.5">{COMPETITION_TYPE_LABELS[type]}</td>
                <td className="text-right">{team ? `${team.wins}-${team.draws}-${team.losses}` : '-'}</td>
                <td className="text-right">
                  {line.appearances}
                  {team ? <span className="text-zinc-400">/{team.played}</span> : null}
                </td>
                <td className="text-right">{line.goals}</td>
                <td className="text-right">{line.assists}</td>
                <td className="text-right">{formatRating(averageRating(line))}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {h ? (
        <div className="rounded-lg bg-zinc-50 p-3 text-xs dark:bg-zinc-800/60">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">하이라이트 · {HIGHLIGHT_KIND_LABELS[h.kind]}</span>
            <span className="text-zinc-500">
              선택 성공 {h.successes}/{h.successes + h.failures}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <PlayerToken appearance={player.profile.appearance} label={player.profile.name} />
            <div className="text-center">
              <div className="text-lg font-bold tabular-nums text-zinc-900 dark:text-zinc-100">{ourScore}</div>
              <div className="text-zinc-500">vs {h.opponent.name}</div>
              {h.score.penalties ? <div className="text-zinc-500">승부차기</div> : null}
            </div>
            <PlayerToken label={h.opponent.name} color={world.clubs[h.opponent.id.split('#')[0]]?.colors.primary} />
          </div>
          {h.playerLine ? (
            <p className="mt-2 text-zinc-600 dark:text-zinc-300">
              {h.playerLine.minutes}분 · {h.playerLine.goals}골 {h.playerLine.assists}도움 · 평점 {h.playerLine.rating}
            </p>
          ) : null}
        </div>
      ) : null}

      <ul className="flex flex-wrap gap-1 text-[11px]">
        {turn.progress.map((p) => (
          <li key={p.competitionId} className="rounded bg-zinc-100 px-1.5 py-0.5 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
            {world.competitions[p.competitionId]?.nameKo ?? p.competitionId}: {p.stageReached}
            {p.status === 'CHAMPION' ? ' 🏆' : p.status === 'ELIMINATED' ? ' 탈락' : ''}
          </li>
        ))}
        {turn.trophies
          .filter((t) => t.competitionId === turn.leagueId)
          .map((t) => (
            <li key={t.competitionId} className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
              리그 우승 🏆
            </li>
          ))}
        {turn.nationalDuty ? (
          <li className="rounded bg-sky-100 px-1.5 py-0.5 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300">국가대표 차출</li>
        ) : null}
      </ul>

      <p className="text-[11px] text-zinc-500">
        명성 {turn.reputationDelta >= 0 ? '+' : ''}
        {turn.reputationDelta} · 입지 {turn.standingDelta >= 0 ? '+' : ''}
        {turn.standingDelta}
      </p>
    </article>
  );
}

function LeagueTable({ turn, clubId }: { turn: TurnResult; clubId: string }) {
  if (!turn.leagueTable.length || !turn.leagueId) return null;
  return (
    <section className={cardClass} aria-label="리그 최종 순위">
      <h3 className="mb-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        {world.leagues[turn.leagueId].nameKo} 최종 순위
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] text-xs tabular-nums">
          <thead className="text-zinc-500">
            <tr>
              <th className="w-8 text-left font-medium">#</th>
              <th className="text-left font-medium">팀</th>
              <th className="text-right font-medium">경기</th>
              <th className="text-right font-medium">승</th>
              <th className="text-right font-medium">무</th>
              <th className="text-right font-medium">패</th>
              <th className="text-right font-medium">득실</th>
              <th className="text-right font-medium">승점</th>
            </tr>
          </thead>
          <tbody>
            {turn.leagueTable.map((row) => (
              <tr
                key={row.clubId}
                className={
                  row.clubId === clubId
                    ? 'bg-emerald-50 font-semibold text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-200'
                    : 'text-zinc-800 dark:text-zinc-200'
                }
              >
                <td className="py-0.5">{row.position}</td>
                <td>{world.clubs[row.clubId]?.nameKo ?? row.clubId}</td>
                <td className="text-right">{row.played}</td>
                <td className="text-right">{row.wins}</td>
                <td className="text-right">{row.draws}</td>
                <td className="text-right">{row.losses}</td>
                <td className="text-right">{row.goalsFor - row.goalsAgainst}</td>
                <td className="text-right">{row.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
