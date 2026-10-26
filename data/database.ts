/**
 * 게임이 쓰는 구단 데이터베이스 = 내장 샘플(data/clubs.ts) + 외부 DB(data/external/)
 * 병합 규칙과 정규화는 data/dbLoader.ts 참고.
 */
import { buildDatabase, type GameDatabase } from './dbLoader';
import { EXTERNAL_DB_FILES } from './external';

export const DATABASE: GameDatabase = buildDatabase({ files: EXTERNAL_DB_FILES });
