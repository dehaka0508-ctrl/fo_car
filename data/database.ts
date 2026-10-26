/**
 * 게임이 쓰는 구단 데이터베이스 = 내장 샘플(data/clubs.ts) + 외부 DB(data/external/)
 * 병합 규칙과 정규화는 data/dbLoader.ts 참고.
 */
import { buildDatabase, type GameDatabase } from './dbLoader';
import { EXTERNAL_DB_FILES } from './external';

/** FO_CAR_DB=sample 이면 외부 DB 없이 내장 샘플만 쓴다 (테스트가 샘플 구단 ID에 맞춰 고정되도록) */
const sampleOnly = typeof process !== 'undefined' && process.env?.FO_CAR_DB === 'sample';

export const DATABASE: GameDatabase = buildDatabase({ files: sampleOnly ? [] : EXTERNAL_DB_FILES });
