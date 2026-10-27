'use client';

import { useState } from 'react';
import { PlayerToken } from '@/components/Avatar';
import { BASE_WORLD } from '@/engine/career';
import { formatMoney } from '@/engine/state';
import { marketValue, TRANSFER_CONFIG } from '@/engine/transfer';
import { useGameStore } from '@/store/gameStore';
import { pendingOffers } from '@/store/flow';
import type { GameState, PlayingTime, TransferOffer } from '@/types/game';
import { OFFER_TYPE_LABELS, playingTimeLabel, seasonLabel } from '../format';
import { Button, cx, fieldClass, Tag } from '../ui';

const FIELD_TIMES: PlayingTime[] = ['KEY', 'STARTER', 'ROTATION', 'BACKUP', 'RESERVE'];
const GK_TIMES: PlayingTime[] = ['GK_FIRST', 'GK_SECOND', 'GK_THIRD'];

function OfferRow({ offer, game }: { offer: TransferOffer; game: GameState }) {
  const acceptOffer = useGameStore((s) => s.acceptOffer);
  const rejectOffer = useGameStore((s) => s.rejectOffer);
  const club = BASE_WORLD.clubs[offer.clubId];
  const league = BASE_WORLD.leagues[game.clubs[offer.clubId].leagueId];
  const stronger = offer.competitors.filter((c) => c.ovr > game.player.ovr).length;
  const best = offer.competitors.reduce((m, c) => Math.max(m, c.ovr), 0);

  return (
    <li className="px-inset m-[2px] flex flex-col gap-2 p-2.5">
      <div className="flex items-center gap-2">
        <PlayerToken kit={club.kitColors} size={20} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-zinc-50">{club.nameKo}</p>
          <p className="truncate text-[11px] text-zinc-400">
            {league.nameKo}
            {league.moneyLeague ? ' · 자본 리그' : ''}
          </p>
        </div>
        <Tag tone={offer.type === 'RENEWAL' ? 'emerald' : offer.type === 'LOAN' ? 'sky' : 'violet'}>{OFFER_TYPE_LABELS[offer.type]}</Tag>
      </div>
      <p className="text-[11px] text-zinc-300">
        출전 <b className="text-zinc-50">{playingTimeLabel(offer.terms.playingTime)}</b> · 연봉 <b className="text-zinc-50">{formatMoney(offer.terms.wage)}</b> ·{' '}
        {offer.type === 'LOAN' ? '임대 1년' : `${offer.terms.years}년`}
        {offer.transferFee ? ` · 이적료 ${formatMoney(offer.transferFee)}` : ''}
      </p>
      <p className={cx('text-[11px]', stronger ? 'text-rose-300' : 'text-emerald-300')}>
        같은 포지션 {offer.competitors.length}명{offer.competitors.length ? ` · 최고 OVR ${best}` : ''}
        {stronger ? ` · 나보다 강한 선수 ${stronger}명` : ' · 주전 경쟁 유리'}
      </p>
      {offer.note ? <p className="text-[11px] text-amber-300">{offer.note}</p> : null}
      <div className="flex gap-1">
        <Button variant="primary" className="flex-1" onClick={() => acceptOffer(offer.id)}>
          수락
        </Button>
        <Button onClick={() => rejectOffer(offer.id)}>거절</Button>
      </div>
    </li>
  );
}

/** 5단계: 이적 — 받은 제안 수락·거절, 역제의 · 재계약 요청 */
export function TransferStep({ game }: { game: GameState }) {
  const requestTransfer = useGameStore((s) => s.requestTransfer);
  const requestRenewal = useGameStore((s) => s.requestContractRenewal);
  const { player, negotiation } = game;
  const offers = pendingOffers(game);
  const [open, setOpen] = useState(offers.length === 0);
  const times = player.profile.role.position === 'GK' ? GK_TIMES : FIELD_TIMES;
  const contract = player.contract;
  const [clubId, setClubId] = useState(() => Object.keys(BASE_WORLD.clubs).find((id) => id !== contract?.clubId) ?? '');
  const [type, setType] = useState<'TRANSFER' | 'LOAN'>('TRANSFER');
  const [desired, setDesired] = useState<PlayingTime>(times[2] ?? times[0]);
  const remaining = TRANSFER_CONFIG.maxCounterOffers - negotiation.counterOffersUsed;
  const leagueGroups = Object.values(BASE_WORLD.leagues).map((league) => ({
    league,
    clubs: Object.values(game.clubs)
      .filter((c) => c.leagueId === league.id && c.clubId !== contract?.clubId)
      .map((c) => BASE_WORLD.clubs[c.clubId])
      .sort((a, b) => b.power - a.power),
  }));
  const leagueId = game.clubs[clubId]?.leagueId ?? leagueGroups[0]?.league.id;
  const leagueClubs = leagueGroups.find((g) => g.league.id === leagueId)?.clubs ?? [];

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[11px] text-zinc-400">
        {contract
          ? `현재 계약 ~${seasonLabel(contract.endSeason)} · 연봉 ${formatMoney(contract.wage)} · 보장 ${playingTimeLabel(contract.playingTime)} · 시장 가치 ${formatMoney(marketValue(player.ovr, player.age))}`
          : 'FA 신분입니다. 매 턴 최대 5개 팀의 제안을 받을 수 있습니다.'}
        {offers.length ? ' · 답하지 않은 제안은 다음 턴 시작 때 사라집니다.' : ''}
      </p>

      {offers.length ? (
        <ul className="grid gap-1 sm:grid-cols-2">
          {offers.map((offer) => (
            <OfferRow key={offer.id} offer={offer} game={game} />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-zinc-300">받은 제안이 없습니다.</p>
      )}

      <div className="px-inset m-[2px] p-2.5">
        <button type="button" onClick={() => setOpen((v) => !v)} className="px-focus flex w-full items-center justify-between text-xs font-bold text-emerald-300">
          <span>직접 협상 · 역제의 {remaining}/{TRANSFER_CONFIG.maxCounterOffers}회</span>
          <span>{open ? '▲' : '▼'}</span>
        </button>
        {open ? (
          <div className="mt-2 flex flex-col gap-2">
            <div className="grid gap-1.5 sm:grid-cols-2">
              <select
                aria-label="리그"
                className={fieldClass}
                value={leagueId}
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
              <select aria-label="구단" className={fieldClass} value={clubId} onChange={(e) => setClubId(e.target.value)}>
                {leagueClubs.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nameKo}
                  </option>
                ))}
              </select>
              <select aria-label="요청" className={fieldClass} value={type} onChange={(e) => setType(e.target.value as 'TRANSFER' | 'LOAN')}>
                <option value="TRANSFER">완전 이적</option>
                <option value="LOAN">임대 (23세 이하)</option>
              </select>
              <select aria-label="희망 출전시간" className={fieldClass} value={desired} onChange={(e) => setDesired(e.target.value as PlayingTime)}>
                {times.map((t) => (
                  <option key={t} value={t}>
                    희망 출전: {playingTimeLabel(t)}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap gap-1">
              <Button variant="primary" disabled={remaining <= 0 || !clubId} onClick={() => requestTransfer(clubId, type, desired)}>
                역제의 보내기
              </Button>
              <Button disabled={!contract || negotiation.renewalRequested} onClick={requestRenewal}>
                재계약 요청{negotiation.renewalRequested ? ' (사용함)' : ''}
              </Button>
            </div>
            {negotiation.log.length ? (
              <ul className="flex flex-col gap-0.5 text-[11px]">
                {negotiation.log.map((entry, i) => (
                  <li key={i} className={entry.accepted ? 'text-emerald-300' : 'text-zinc-400'}>
                    {entry.message}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
