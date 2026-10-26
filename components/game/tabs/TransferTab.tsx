'use client';

import { useState } from 'react';
import { PlayerToken } from '@/components/Avatar';
import { BASE_WORLD } from '@/engine/career';
import { formatMoney } from '@/engine/state';
import { marketValue, TRANSFER_CONFIG } from '@/engine/transfer';
import { useGameStore } from '@/store/gameStore';
import type { GameState, PlayingTime, TransferOffer } from '@/types/game';
import { clubLabel, OFFER_TYPE_LABELS, playingTimeLabel, seasonLabel } from '../format';
import { Button, Card, Field, fieldClass, Tag } from '../ui';

const FIELD_TIMES: PlayingTime[] = ['KEY', 'STARTER', 'ROTATION', 'BACKUP', 'RESERVE'];
const GK_TIMES: PlayingTime[] = ['GK_FIRST', 'GK_SECOND', 'GK_THIRD'];

function OfferCard({ offer, game }: { offer: TransferOffer; game: GameState }) {
  const acceptOffer = useGameStore((s) => s.acceptOffer);
  const rejectOffer = useGameStore((s) => s.rejectOffer);
  const club = BASE_WORLD.clubs[offer.clubId];
  const state = game.clubs[offer.clubId];
  const league = BASE_WORLD.leagues[state.leagueId];
  const pending = offer.status === 'PENDING';

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <PlayerToken kit={club.kitColors} size={26} />
          <div>
            <p className="font-semibold text-zinc-900 dark:text-zinc-100">{club.nameKo}</p>
            <p className="text-xs text-zinc-500">
              {league.nameKo}
              {league.moneyLeague ? ' · 자본 리그' : ''}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Tag tone={offer.type === 'RENEWAL' ? 'emerald' : offer.type === 'LOAN' ? 'sky' : 'violet'}>{OFFER_TYPE_LABELS[offer.type]}</Tag>
          {offer.source === 'PLAYER_REQUEST' ? <Tag>역제의 수락</Tag> : null}
        </div>
      </div>
      {offer.note ? <p className="text-xs text-amber-700 dark:text-amber-400">{offer.note}</p> : null}
      <dl className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
        <div>
          <dt className="text-zinc-500">보장 출전</dt>
          <dd className="font-semibold text-zinc-900 dark:text-zinc-100">{playingTimeLabel(offer.terms.playingTime)}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">연봉</dt>
          <dd className="font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{formatMoney(offer.terms.wage)}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">기간</dt>
          <dd className="font-semibold text-zinc-900 dark:text-zinc-100">{offer.type === 'LOAN' ? '임대 1년' : `${offer.terms.years}년`}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">{offer.type === 'RENEWAL' ? '이적료' : '이적료(합의 완료)'}</dt>
          <dd className="font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{offer.transferFee ? formatMoney(offer.transferFee) : '-'}</dd>
        </div>
      </dl>
      <div>
        <p className="mb-1 text-xs font-semibold text-zinc-500">동 포지션 경쟁 선수 {offer.competitors.length}명</p>
        {offer.competitors.length ? (
          <table className="w-full text-xs tabular-nums">
            <thead className="text-zinc-500">
              <tr>
                <th className="text-left font-medium">이름</th>
                <th className="text-right font-medium">나이</th>
                <th className="text-right font-medium">OVR</th>
                <th className="text-right font-medium">입지</th>
              </tr>
            </thead>
            <tbody className="text-zinc-800 dark:text-zinc-200">
              {offer.competitors.map((c) => (
                <tr key={c.id}>
                  <td className="truncate">
                    {c.name} <span className="text-zinc-400">{BASE_WORLD.nations[c.nationality]?.nameKo ?? c.nationality}</span>
                  </td>
                  <td className="text-right">{c.age}</td>
                  <td className={`text-right ${c.ovr > game.player.ovr ? 'text-rose-600' : 'text-emerald-600'}`}>{c.ovr}</td>
                  <td className="text-right">{playingTimeLabel(c.playingTime)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-xs text-zinc-500">겹치는 경쟁자가 없다.</p>
        )}
      </div>
      {pending ? (
        <div className="flex gap-2">
          <Button variant="primary" className="flex-1" onClick={() => acceptOffer(offer.id)}>
            수락
          </Button>
          <Button variant="secondary" onClick={() => rejectOffer(offer.id)}>
            거절
          </Button>
        </div>
      ) : (
        <Tag tone={offer.status === 'ACCEPTED' ? 'emerald' : 'zinc'}>{offer.status === 'ACCEPTED' ? '수락함' : '거절함'}</Tag>
      )}
    </Card>
  );
}

export function TransferTab({ game }: { game: GameState }) {
  const requestTransfer = useGameStore((s) => s.requestTransfer);
  const requestRenewal = useGameStore((s) => s.requestContractRenewal);
  const { player, negotiation } = game;
  const isGK = player.profile.role.position === 'GK';
  const times = isGK ? GK_TIMES : FIELD_TIMES;
  const [clubId, setClubId] = useState(() => Object.keys(BASE_WORLD.clubs).find((id) => id !== player.contract?.clubId) ?? '');
  const [type, setType] = useState<'TRANSFER' | 'LOAN'>('TRANSFER');
  const [desired, setDesired] = useState<PlayingTime>(isGK ? 'GK_SECOND' : 'ROTATION');
  const contract = player.contract;
  const remaining = TRANSFER_CONFIG.maxCounterOffers - negotiation.counterOffersUsed;
  const leagueGroups = Object.values(BASE_WORLD.leagues).map((league) => ({
    league,
    clubs: Object.values(game.clubs)
      .filter((c) => c.leagueId === league.id && c.clubId !== contract?.clubId)
      .map((c) => BASE_WORLD.clubs[c.clubId])
      .sort((a, b) => b.power - a.power || a.nameKo.localeCompare(b.nameKo, 'ko')),
  }));
  const selectedLeagueId = game.clubs[clubId]?.leagueId ?? leagueGroups[0]?.league.id;
  const leagueClubs = leagueGroups.find((g) => g.league.id === selectedLeagueId)?.clubs ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="현재 계약">
          {contract ? (
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs text-zinc-500">소속</dt>
                <dd className="font-semibold text-zinc-900 dark:text-zinc-100">
                  {clubLabel(contract.clubId)} {contract.type === 'LOAN' ? `(임대, 원소속 ${clubLabel(contract.parentClubId)})` : ''}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">계약 만료</dt>
                <dd className="font-semibold text-zinc-900 dark:text-zinc-100">{seasonLabel(contract.endSeason)} 시즌 종료</dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">연봉</dt>
                <dd className="font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{formatMoney(contract.wage)}</dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">보장 출전시간</dt>
                <dd className="font-semibold text-zinc-900 dark:text-zinc-100">{playingTimeLabel(contract.playingTime)}</dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">추정 시장 가치</dt>
                <dd className="font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{formatMoney(marketValue(player.ovr, player.age))}</dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">FA 신분입니다. 매 턴 최대 5개 팀의 제안을 받을 수 있습니다.</p>
          )}
          <div className="mt-3">
            <Button variant="secondary" disabled={!contract || negotiation.renewalRequested} onClick={requestRenewal}>
              재계약 요청 {negotiation.renewalRequested ? '(사용함)' : ''}
            </Button>
          </div>
        </Card>

        <Card title={`역제의 (남은 횟수 ${remaining}/${TRANSFER_CONFIG.maxCounterOffers})`}>
          <div className="grid gap-2 sm:grid-cols-3">
            <Field label="리그" className="sm:col-span-3">
              <select
                className={fieldClass}
                value={selectedLeagueId}
                onChange={(e) => {
                  const first = leagueGroups.find((g) => g.league.id === e.target.value)?.clubs[0];
                  if (first) setClubId(first.id);
                }}
              >
                {leagueGroups.map(({ league }) => (
                  <option key={league.id} value={league.id}>
                    {BASE_WORLD.nations[league.nation]?.nameKo} · {league.nameKo}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={`구단 (${leagueClubs.length}개 · 실력순)`} className="sm:col-span-3">
              <select className={fieldClass} value={clubId} onChange={(e) => setClubId(e.target.value)}>
                {leagueClubs.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nameKo}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="요청">
              <select className={fieldClass} value={type} onChange={(e) => setType(e.target.value as 'TRANSFER' | 'LOAN')}>
                <option value="TRANSFER">완전 이적</option>
                <option value="LOAN">임대 (23세 이하)</option>
              </select>
            </Field>
            <Field label="희망 출전시간" className="sm:col-span-2">
              <select className={fieldClass} value={desired} onChange={(e) => setDesired(e.target.value as PlayingTime)}>
                {times.map((t) => (
                  <option key={t} value={t}>
                    {playingTimeLabel(t)}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="mt-3">
            <Button variant="primary" disabled={remaining <= 0 || !clubId} onClick={() => requestTransfer(clubId, type, desired)}>
              제안 보내기
            </Button>
          </div>
          {negotiation.log.length ? (
            <ul className="mt-3 flex flex-col gap-1 text-xs">
              {negotiation.log.map((entry, i) => (
                <li key={i} className={entry.accepted ? 'text-emerald-700 dark:text-emerald-400' : 'text-zinc-500'}>
                  {entry.message}
                </li>
              ))}
            </ul>
          ) : null}
        </Card>
      </div>

      <div>
        <h2 className="mb-3 inline-block bg-zinc-950/80 px-2 py-1 text-xs font-bold text-amber-300 shadow-[0_0_0_2px_rgb(5_8_15/0.6)]">
          받은 오퍼 ({game.offers.filter((o) => o.status === 'PENDING').length})
        </h2>
        {game.offers.length ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {game.offers.map((offer) => (
              <OfferCard key={offer.id} offer={offer} game={game} />
            ))}
          </div>
        ) : (
          <Card>
            <p className="text-sm text-zinc-500">이번 턴에는 들어온 제안이 없습니다. 턴이 끝날 때마다 0~3개 팀(FA는 최대 5개)에서 제안이 옵니다.</p>
          </Card>
        )}
      </div>
    </div>
  );
}
